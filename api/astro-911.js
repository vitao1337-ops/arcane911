import {
  ASTRO911_INSTRUCTIONS,
  ASTRO911_SCHEMA_VERSION,
  Astro911ValidationError,
  auditAstro911Document,
  buildAstro911ModelInput,
  createAstro911ResponseSchema,
  factLabelsForResponse,
  normalizeAstro911Document,
  parseGeminiAstroOutput,
  validateAstro911Request,
} from "../server/astro911-core.js";

export const config = { maxDuration: 60 };

const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 8;
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const bucketStore = globalThis.__arcane911AstroRateBuckets ?? new Map();
globalThis.__arcane911AstroRateBuckets = bucketStore;

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
  if (typeof request.body === "string" && request.body.length <= 64_000) return JSON.parse(request.body);
  throw new Astro911ValidationError("Corpo da requisição ausente.");
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

function firstSecret(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
}

function cleanModelName(value, fallback = "") {
  const model = String(value ?? fallback).trim();
  return /^[a-zA-Z0-9._-]+$/u.test(model) ? model : fallback;
}

function resolveGemini() {
  const key = firstSecret(
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
  const model = cleanModelName(process.env.ASTRO911_MODEL ?? process.env.GEMINI_MODEL, DEFAULT_MODEL);
  const rawFallback = String(
    process.env.ASTRO911_FALLBACK_MODEL
      ?? process.env.GEMINI_FALLBACK_MODEL
      ?? DEFAULT_FALLBACK_MODEL,
  ).trim();
  const fallbackModel = ["", "none", "off", "false"].includes(rawFallback.toLowerCase())
    ? ""
    : cleanModelName(rawFallback, DEFAULT_FALLBACK_MODEL);
  return { key, model, fallbackModel: fallbackModel === model ? "" : fallbackModel };
}

function providerFailure(payload, status) {
  const error = new Error(String(payload?.error?.status || payload?.error?.code || `gemini_${status}`));
  error.status = status;
  error.providerCode = String(payload?.error?.status ?? payload?.error?.code ?? "unknown").slice(0, 80);
  error.providerMessage = String(payload?.error?.message ?? "").slice(0, 240);
  return error;
}

function shouldTryFallback(error) {
  return error?.status === 404 || error?.status === 429 || Number(error?.status) >= 500;
}

function repairInstruction(reasons) {
  if (!reasons.length) return "";
  return `\n\nREVISÃO OBRIGATÓRIA: a primeira versão falhou nestes controles: ${reasons.join(", ")}. Reescreva o documento inteiro, preserve apenas posições e aspectos do catálogo, aprofunde as combinações e cumpra exatamente quantidades, ordem, âncoras e limites. Não mencione revisão ou auditoria.`;
}

async function callGemini(normalized, provider, repairReasons = []) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("provider_timeout", "AbortError")),
    48_000,
  );
  const models = [provider.model, provider.fallbackModel].filter(Boolean);
  const allowedFactIds = normalized.facts.map((fact) => fact.id);

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
                parts: [{ text: ASTRO911_INSTRUCTIONS + repairInstruction(repairReasons) }],
              },
              contents: [{
                role: "user",
                parts: [{ text: buildAstro911ModelInput(normalized, repairReasons) }],
              }],
              generationConfig: {
                candidateCount: 1,
                maxOutputTokens: 10_240,
                responseMimeType: "application/json",
                responseJsonSchema: createAstro911ResponseSchema(allowedFactIds),
                thinkingConfig: {
                  includeThoughts: false,
                  thinkingLevel: "MINIMAL",
                },
                temperature: 0.76,
                topP: 0.9,
              },
            }),
            signal: controller.signal,
          },
        );
        const payload = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) throw providerFailure(payload, providerResponse.status);
        return {
          document: parseGeminiAstroOutput(payload),
          model,
          usedFallbackModel: index > 0,
        };
      } catch (error) {
        const canUseFallback = index === 0 && models.length > 1 && shouldTryFallback(error);
        if (!canUseFallback) throw error;
        console.warn("astro911_model_fallback", {
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  const rate = consumeRateLimit(requestIp(request));
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1_000)),
  };
  if (!rate.allowed) return sendJson(response, 429, { error: "rate_limit" }, rateHeaders);

  const provider = resolveGemini();
  if (!provider.key) return sendJson(response, 503, { error: "astro_not_configured" }, rateHeaders);

  try {
    const normalized = validateAstro911Request(parseBody(request));
    let providerResult = await callGemini(normalized, provider);
    let document = normalizeAstro911Document(providerResult.document);
    let audit = auditAstro911Document(document, normalized);

    if (!audit.ok) {
      providerResult = await callGemini(normalized, provider, audit.reasons);
      document = normalizeAstro911Document(providerResult.document);
      audit = auditAstro911Document(document, normalized);
    }

    if (!audit.ok) {
      console.error("astro911_audit_failed", {
        requestId: normalized.requestId,
        reasons: audit.reasons,
      });
      return sendJson(response, 502, { error: "document_not_grounded" }, rateHeaders);
    }

    const usedFactIds = [
      ...document.audit.usedFactIds,
      ...document.sections.flatMap((section) => section.anchors),
    ];
    return sendJson(response, 200, {
      document,
      factLabels: factLabelsForResponse(normalized, usedFactIds),
      meta: {
        schemaVersion: ASTRO911_SCHEMA_VERSION,
        grounded: true,
        provider: "gemini",
        model: providerResult.model,
        usedFallbackModel: providerResult.usedFallbackModel,
        rawBirthDataSent: false,
      },
    }, rateHeaders);
  } catch (error) {
    if (error instanceof Astro911ValidationError) {
      return sendJson(response, 400, { error: error.code, message: error.message }, rateHeaders);
    }

    const providerAuthError = error?.status === 401 || error?.status === 403;
    const providerQuotaError = error?.status === 429;
    const providerModelError = error?.status === 404
      || /model.*(?:not|access|exist)|does not exist/iu.test(`${error?.providerCode} ${error?.providerMessage}`);
    const providerRequestError = error?.status === 400;
    const timedOut = error?.name === "AbortError" || error?.message === "provider_timeout";
    console.error("astro911_request_failed", {
      type: providerAuthError ? "provider_auth"
        : providerQuotaError ? "provider_quota"
          : providerModelError ? "provider_model"
            : providerRequestError ? "provider_request"
              : timedOut ? "timeout" : "provider_error",
      status: Number(error?.status) || null,
      providerCode: String(error?.providerCode ?? "unknown").slice(0, 80),
      message: String(error?.message ?? "unknown").slice(0, 160),
    });

    if (providerAuthError) return sendJson(response, 503, { error: "provider_auth" }, rateHeaders);
    if (providerQuotaError) return sendJson(response, 503, { error: "provider_quota" }, rateHeaders);
    if (providerModelError) return sendJson(response, 503, { error: "provider_model" }, rateHeaders);
    if (providerRequestError) return sendJson(response, 502, { error: "provider_request" }, rateHeaders);
    if (timedOut) return sendJson(response, 504, { error: "provider_timeout" }, rateHeaders);
    return sendJson(response, 502, { error: "astro_unavailable" }, rateHeaders);
  }
}
