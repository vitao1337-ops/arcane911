import {
  AGENT911_INSTRUCTIONS,
  AGENT911_MAX_FOLLOW_UPS,
  AGENT911_SCHEMA_VERSION,
  Agent911ValidationError,
  auditAgent911Response,
  buildAgent911ModelInput,
  createAgent911ResponseSchema,
  parseOpenAIOutput,
  validateAgent911Request,
} from "../server/agent911-core.js";

export const config = { maxDuration: 60 };

const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 24;
const bucketStore = globalThis.__arcane911RateBuckets ?? new Map();
globalThis.__arcane911RateBuckets = bucketStore;

function sendJson(response, status, payload, extraHeaders = {}) {
  Object.entries({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  }).forEach(([key, value]) => response.setHeader(key, value));
  return response.status(status).json(payload);
}

function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body.length <= 64_000) {
    return JSON.parse(request.body);
  }
  throw new Agent911ValidationError("Corpo da requisição ausente.");
}

function requestIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return forwarded || request.socket?.remoteAddress || "unknown";
}

function consumeRateLimit(key) {
  const now = Date.now();
  const current = bucketStore.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : current;

  bucket.count += 1;
  bucketStore.set(key, bucket);

  if (bucketStore.size > 2_000) {
    for (const [bucketKey, value] of bucketStore.entries()) {
      if (value.resetAt <= now) bucketStore.delete(bucketKey);
    }
  }

  return {
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "")
      .split(",")[0]
      .trim();
    if (originUrl.host === host) return true;

    const configured = String(process.env.ARCANE911_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return configured.includes(originUrl.origin);
  } catch {
    return false;
  }
}

async function callOpenAI(normalized, repairReasons = []) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("provider_timeout", "AbortError")),
    48_000,
  );
  const model = String(process.env.OPENAI_MODEL ?? "gpt-5.6-terra").trim();
  const isSummary = normalized.action === "opening_summary" || normalized.action === "complete_summary";
  const repairInstruction = repairReasons.length
    ? `\n\nCORREÇÃO OBRIGATÓRIA: a auditoria anterior rejeitou a resposta por: ${repairReasons.join(", ")}. Refaça a leitura corrigindo esses pontos, sem comentar a auditoria.`
    : "";

  try {
    const providerResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: isSummary ? "low" : normalized.reading.cardSlugs.length === 7 ? "medium" : "low" },
        instructions: AGENT911_INSTRUCTIONS + repairInstruction,
        input: buildAgent911ModelInput(normalized),
        max_output_tokens: isSummary
          ? normalized.reading.cardSlugs.length === 7 ? 1_500 : 1_000
          : normalized.reading.cardSlugs.length === 7 ? 3_200 : 2_200,
        text: {
          format: {
            type: "json_schema",
            name: "agent911_tarot_reading",
            strict: true,
            schema: createAgent911ResponseSchema(normalized.reading.cardSlugs),
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      const providerCode = payload?.error?.code || `openai_${providerResponse.status}`;
      const error = new Error(providerCode);
      error.status = providerResponse.status;
      throw error;
    }

    return parseOpenAIOutput(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  if (!originIsAllowed(request)) {
    return sendJson(response, 403, { error: "origin_not_allowed" });
  }

  const rate = consumeRateLimit(requestIp(request));
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1_000)),
  };
  if (!rate.allowed) {
    return sendJson(response, 429, { error: "rate_limit" }, rateHeaders);
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, 503, { error: "agent_not_configured" }, rateHeaders);
  }

  try {
    const normalized = validateAgent911Request(parseBody(request));
    let reading = await callOpenAI(normalized);
    let audit = auditAgent911Response(reading, normalized);

    if (!audit.ok) {
      reading = await callOpenAI(normalized, audit.reasons);
      audit = auditAgent911Response(reading, normalized);
    }

    if (!audit.ok) {
      console.error("agent911_audit_failed", {
        requestId: normalized.requestId,
        reasons: audit.reasons,
      });
      return sendJson(response, 502, { error: "reading_not_grounded" }, rateHeaders);
    }

    const questionsRemaining = normalized.action === "follow_up"
      ? Math.max(0, AGENT911_MAX_FOLLOW_UPS - normalized.questionsUsed - 1)
      : AGENT911_MAX_FOLLOW_UPS;

    return sendJson(response, 200, {
      conversationId: normalized.requestId || `a911-${Date.now()}`,
      answer: reading.synthesis,
      reading,
      followUps: reading.suggestedQuestions,
      questionsRemaining,
      meta: {
        schemaVersion: AGENT911_SCHEMA_VERSION,
        grounded: true,
      },
    }, rateHeaders);
  } catch (error) {
    if (error instanceof Agent911ValidationError) {
      return sendJson(response, 400, { error: error.code, message: error.message }, rateHeaders);
    }

    const providerAuthError = error?.status === 401 || error?.status === 403;
    const timedOut = error?.name === "AbortError" || error?.message === "provider_timeout";
    console.error("agent911_request_failed", {
      type: providerAuthError ? "provider_auth" : timedOut ? "timeout" : "provider_error",
      message: String(error?.message ?? "unknown").slice(0, 160),
    });

    if (providerAuthError) {
      return sendJson(response, 503, { error: "provider_auth" }, rateHeaders);
    }
    if (timedOut) {
      return sendJson(response, 504, { error: "provider_timeout" }, rateHeaders);
    }
    return sendJson(response, 502, { error: "agent_unavailable" }, rateHeaders);
  }
}
