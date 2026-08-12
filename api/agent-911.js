import {
  AGENT911_INSTRUCTIONS,
  AGENT911_MAX_FOLLOW_UPS,
  AGENT911_SCHEMA_VERSION,
  Agent911ValidationError,
  auditAgent911Response,
  buildAgent911ModelInput,
  createAgent911ResponseSchema,
  createGeminiResponseSchema,
  parseGeminiOutput,
  parseOpenAIOutput,
  validateAgent911Request,
} from "../server/agent911-core.js";

export const config = { maxDuration: 60 };

const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 24;
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
const GEMINI_DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
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

function cleanModelName(value, fallback = "") {
  const model = String(value ?? fallback).trim();
  return /^[a-zA-Z0-9._-]+$/u.test(model) ? model : fallback;
}

function firstSecret(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
}

function resolveProvider() {
  const requested = String(process.env.AGENT911_PROVIDER ?? "auto").trim().toLowerCase();
  const geminiKey = firstSecret(
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
  const openAIKey = firstSecret(process.env.OPENAI_API_KEY);

  if (requested === "openai") {
    return {
      id: "openai",
      key: openAIKey,
      model: cleanModelName(process.env.OPENAI_MODEL, "gpt-5.6-terra"),
    };
  }

  if (requested === "gemini" || (requested === "auto" && geminiKey)) {
    const model = cleanModelName(process.env.GEMINI_MODEL, GEMINI_DEFAULT_MODEL);
    const rawFallback = String(process.env.GEMINI_FALLBACK_MODEL ?? GEMINI_DEFAULT_FALLBACK_MODEL)
      .trim()
      .toLowerCase();
    const fallbackModel = ["", "none", "off", "false"].includes(rawFallback)
      ? ""
      : cleanModelName(process.env.GEMINI_FALLBACK_MODEL, GEMINI_DEFAULT_FALLBACK_MODEL);
    return {
      id: "gemini",
      key: geminiKey,
      model,
      fallbackModel: fallbackModel === model ? "" : fallbackModel,
    };
  }

  if (requested === "auto" && openAIKey) {
    return {
      id: "openai",
      key: openAIKey,
      model: cleanModelName(process.env.OPENAI_MODEL, "gpt-5.6-terra"),
    };
  }

  return {
    id: requested === "openai" ? "openai" : "gemini",
    key: "",
    model: requested === "openai"
      ? cleanModelName(process.env.OPENAI_MODEL, "gpt-5.6-terra")
      : cleanModelName(process.env.GEMINI_MODEL, GEMINI_DEFAULT_MODEL),
    fallbackModel: "",
  };
}

function outputTokenLimit(normalized) {
  const isSummary = normalized.action === "opening_summary" || normalized.action === "complete_summary";
  return isSummary
    ? normalized.reading.cardSlugs.length === 7 ? 6_144 : 4_096
    : normalized.reading.cardSlugs.length === 7 ? 8_192 : 6_144;
}

function repairInstruction(repairReasons) {
  if (!repairReasons.length) return "";

  const guidance = repairReasons.map((reason) => {
    if (reason === "question_not_reflected") {
      return "A leitura respondeu ao tema por paráfrase, mas precisa conter naturalmente ao menos uma palavra ou expressão concreta presente na pergunta do consulente.";
    }
    if (reason === "selected_card_names_missing") {
      return "Nomeie as cartas selecionadas dentro da interpretação, conectando-as entre si em vez de apenas listá-las.";
    }
    if (reason === "generic_opening") {
      return "Troque a abertura genérica por uma frase de reconhecimento ligada ao conflito humano e a esta combinação de cartas.";
    }
    if (reason === "repetitive_language") {
      return "Varie verbos, cadência e construção; não apoie a leitura inteira em mostra, pede, indica ou revela.";
    }
    return `Corrija o requisito técnico ${reason}.`;
  }).join(" ");

  return `\n\nCORREÇÃO OBRIGATÓRIA: ${guidance} Refaça a leitura sem comentar a auditoria nem soar mecânica.`;
}

const repairableStyleReasons = new Set([
  "question_not_reflected",
  "generic_opening",
  "repetitive_language",
]);

function hasOnlyRepairableStyleIssues(audit) {
  return audit?.ok === false
    && audit.reasons?.length > 0
    && audit.reasons.every((reason) => repairableStyleReasons.has(reason));
}

function providerFailure(payload, status, provider) {
  const providerCode = provider === "gemini"
    ? payload?.error?.status || payload?.error?.code || `gemini_${status}`
    : payload?.error?.code || `openai_${status}`;
  const error = new Error(String(providerCode));
  error.status = status;
  error.provider = provider;
  error.providerCode = String(providerCode).slice(0, 80);
  error.providerType = String(payload?.error?.type ?? payload?.error?.status ?? "unknown").slice(0, 80);
  error.providerMessage = String(payload?.error?.message ?? "").slice(0, 240);
  return error;
}

async function callOpenAI(normalized, provider, repairReasons = []) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("provider_timeout", "AbortError")),
    48_000,
  );
  const model = provider.model;
  const isSummary = normalized.action === "opening_summary" || normalized.action === "complete_summary";

  try {
    const providerResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: {
          effort: normalized.action === "complete_summary"
            ? "medium"
            : isSummary ? "low" : normalized.reading.cardSlugs.length === 7 ? "medium" : "low",
        },
        instructions: AGENT911_INSTRUCTIONS + repairInstruction(repairReasons),
        input: buildAgent911ModelInput(normalized),
        max_output_tokens: outputTokenLimit(normalized),
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
      throw providerFailure(payload, providerResponse.status, "openai");
    }

    return {
      reading: parseOpenAIOutput(payload),
      provider: "openai",
      model,
      usedFallbackModel: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldTryGeminiFallback(error) {
  return error?.status === 404 || error?.status === 429 || Number(error?.status) >= 500;
}

async function callGemini(normalized, provider, repairReasons = []) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("provider_timeout", "AbortError")),
    48_000,
  );
  const models = [provider.model, provider.fallbackModel].filter(Boolean);

  try {
    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      try {
        const providerResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": provider.key,
            },
            body: JSON.stringify({
              store: false,
              systemInstruction: {
                parts: [{ text: AGENT911_INSTRUCTIONS + repairInstruction(repairReasons) }],
              },
              contents: [{
                role: "user",
                parts: [{ text: buildAgent911ModelInput(normalized) }],
              }],
              generationConfig: {
                candidateCount: 1,
                maxOutputTokens: outputTokenLimit(normalized),
                responseMimeType: "application/json",
                responseJsonSchema: createGeminiResponseSchema(normalized.reading.cardSlugs),
                thinkingConfig: {
                  includeThoughts: false,
                  thinkingLevel: "MINIMAL",
                },
                temperature: normalized.action === "complete_summary" ? 1.05 : 0.95,
                topP: 0.95,
              },
            }),
            signal: controller.signal,
          },
        );

        const payload = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) {
          throw providerFailure(payload, providerResponse.status, "gemini");
        }

        return {
          reading: parseGeminiOutput(payload),
          provider: "gemini",
          model,
          usedFallbackModel: index > 0,
        };
      } catch (error) {
        const canUseFallback = index === 0 && models.length > 1 && shouldTryGeminiFallback(error);
        if (!canUseFallback) throw error;
        console.warn("agent911_model_fallback", {
          provider: "gemini",
          fromModel: model,
          toModel: models[index + 1],
          status: Number(error?.status) || null,
          providerCode: String(error?.providerCode ?? "unknown").slice(0, 80),
        });
      }
    }
    throw new Error("empty_model_output");
  } finally {
    clearTimeout(timeout);
  }
}

function callProvider(normalized, provider, repairReasons = []) {
  return provider.id === "openai"
    ? callOpenAI(normalized, provider, repairReasons)
    : callGemini(normalized, provider, repairReasons);
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

  const provider = resolveProvider();
  if (!provider.key) {
    return sendJson(response, 503, { error: "agent_not_configured" }, rateHeaders);
  }

  try {
    const normalized = validateAgent911Request(parseBody(request));
    let providerResult = await callProvider(normalized, provider);
    let reading = providerResult.reading;
    let audit = auditAgent911Response(reading, normalized);

    if (!audit.ok) {
      providerResult = await callProvider(normalized, provider, audit.reasons);
      reading = providerResult.reading;
      audit = auditAgent911Response(reading, normalized);
    }

    if (hasOnlyRepairableStyleIssues(audit)) {
      console.warn("agent911_audit_style_warning", {
        requestId: normalized.requestId,
        reasons: audit.reasons,
      });
      audit = { ok: true, reasons: [], warnings: audit.reasons };
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
        provider: providerResult.provider,
        model: providerResult.model,
        usedFallbackModel: providerResult.usedFallbackModel,
      },
    }, rateHeaders);
  } catch (error) {
    if (error instanceof Agent911ValidationError) {
      return sendJson(response, 400, { error: error.code, message: error.message }, rateHeaders);
    }

    const providerAuthError = error?.status === 401 || error?.status === 403;
    const providerQuotaError = error?.status === 429;
    const providerModelError = error?.status === 404
      || /model.*(?:not|access|exist)|does not exist/iu.test(`${error?.providerCode} ${error?.providerMessage}`);
    const providerRequestError = error?.status === 400;
    const timedOut = error?.name === "AbortError" || error?.message === "provider_timeout";
    console.error("agent911_request_failed", {
      type: providerAuthError ? "provider_auth"
        : providerQuotaError ? "provider_quota"
          : providerModelError ? "provider_model"
            : providerRequestError ? "provider_request"
              : timedOut ? "timeout" : "provider_error",
      status: Number(error?.status) || null,
      providerCode: String(error?.providerCode ?? "unknown").slice(0, 80),
      providerType: String(error?.providerType ?? "unknown").slice(0, 80),
      provider: String(error?.provider ?? provider.id ?? "unknown").slice(0, 20),
      message: String(error?.message ?? "unknown").slice(0, 160),
    });

    if (providerAuthError) {
      return sendJson(response, 503, { error: "provider_auth" }, rateHeaders);
    }
    if (providerQuotaError) {
      return sendJson(response, 503, { error: "provider_quota" }, rateHeaders);
    }
    if (providerModelError) {
      return sendJson(response, 503, { error: "provider_model" }, rateHeaders);
    }
    if (providerRequestError) {
      return sendJson(response, 502, { error: "provider_request" }, rateHeaders);
    }
    if (timedOut) {
      return sendJson(response, 504, { error: "provider_timeout" }, rateHeaders);
    }
    return sendJson(response, 502, { error: "agent_unavailable" }, rateHeaders);
  }
}
