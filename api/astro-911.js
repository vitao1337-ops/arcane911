import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
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
  parseOpenAIAstroOutput,
  validateAstro911Request,
} from "../server/astro911-core.js";
import { createProductCatalog } from "../src/config/productCatalog.js";
import {
  PaymentLedgerError,
  readPaidContent,
  completePaidContent,
  claimPaymentEntitlement,
  settlePaymentEntitlement,
} from "../server/payment-ledger.js";

export const config = { maxDuration: 60 };

const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_RATE_LIMIT = 8;
const DEFAULT_PROVIDER_TIMEOUT_MS = 35_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 55_000;
const DEFAULT_QUOTA_COOLDOWN_MS = 60_000;
const DEFAULT_PROVIDER_COOLDOWN_MS = 15_000;
const DEFAULT_DEDUPE_TTL_MS = 10 * 60 * 1_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;
const DEFAULT_MAX_COST_BRL = 2;
const DEFAULT_USD_BRL_BUDGET_RATE = 6;
const MAX_PROVIDER_CALLS = 3;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const bucketStore = globalThis.__arcane911AstroRateBuckets ?? new Map();
const inFlightStore = globalThis.__arcane911AstroInFlight ?? new Map();
const responseStore = globalThis.__arcane911AstroResponses ?? new Map();
const providerCooldownStore = globalThis.__arcane911AstroProviderCooldowns ?? new Map();
globalThis.__arcane911AstroRateBuckets = bucketStore;
globalThis.__arcane911AstroInFlight = inFlightStore;
globalThis.__arcane911AstroResponses = responseStore;
globalThis.__arcane911AstroProviderCooldowns = providerCooldownStore;

const softAuditReasons = new Set(["person_not_reflected", "self_audit_invalid"]);
const structuralRepairReasons = new Set([
  "document_too_shallow",
  "section_contract_invalid",
  "section_too_shallow",
  "section_anchors_invalid",
  "practices_invalid",
  "questions_invalid",
  "closing_too_shallow",
  "insufficient_chart_grounding",
  "unknown_fact_id",
]);

class Astro911ProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "Astro911ProviderError";
    Object.assign(this, details);
  }
}

function integerEnv(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function decimalEnv(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function rateLimitConfig() {
  return {
    limit: integerEnv("ASTRO911_RATE_LIMIT", DEFAULT_RATE_LIMIT, 1, 1_000),
    windowMs: integerEnv(
      "ASTRO911_RATE_WINDOW_MS",
      DEFAULT_RATE_WINDOW_MS,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
  };
}

function runtimeConfig() {
  return {
    providerTimeoutMs: integerEnv(
      "ASTRO911_PROVIDER_TIMEOUT_MS",
      DEFAULT_PROVIDER_TIMEOUT_MS,
      3_000,
      50_000,
    ),
    totalTimeoutMs: integerEnv("ASTRO911_TOTAL_TIMEOUT_MS", DEFAULT_TOTAL_TIMEOUT_MS, 10_000, 58_000),
    quotaCooldownMs: integerEnv(
      "ASTRO911_QUOTA_COOLDOWN_MS",
      DEFAULT_QUOTA_COOLDOWN_MS,
      1_000,
      60 * 60 * 1_000,
    ),
    providerCooldownMs: integerEnv(
      "ASTRO911_PROVIDER_COOLDOWN_MS",
      DEFAULT_PROVIDER_COOLDOWN_MS,
      1_000,
      10 * 60 * 1_000,
    ),
    dedupeTtlMs: integerEnv(
      "ASTRO911_DEDUPE_TTL_MS",
      DEFAULT_DEDUPE_TTL_MS,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
    maxOutputTokens: integerEnv(
      "ASTRO911_MAX_OUTPUT_TOKENS",
      DEFAULT_MAX_OUTPUT_TOKENS,
      4_096,
      12_288,
    ),
    maxCostBrl: decimalEnv("ASTRO911_MAX_COST_BRL", DEFAULT_MAX_COST_BRL, 0.1, 20),
    usdBrlBudgetRate: decimalEnv(
      "ASTRO911_USD_BRL_BUDGET_RATE",
      DEFAULT_USD_BRL_BUDGET_RATE,
      1,
      20,
    ),
  };
}

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
  try {
    const body = request.body && typeof request.body === "object"
      ? request.body
      : typeof request.body === "string" ? JSON.parse(request.body) : null;
    if (!body || Array.isArray(body)) throw new Error("body_missing");
    if (JSON.stringify(body).length > 64_000) throw new Error("body_too_large");
    return body;
  } catch {
    throw new Astro911ValidationError("Corpo da requisição inválido.", "invalid_payload");
  }
}

function requestIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return forwarded || request.socket?.remoteAddress || "unknown";
}

function consumeRateLimit(key, currentConfig) {
  const now = Date.now();
  const bucketKey = `${currentConfig.limit}:${currentConfig.windowMs}:${key}`;
  const current = bucketStore.get(bucketKey);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + currentConfig.windowMs }
    : current;
  bucket.count += 1;
  bucketStore.set(bucketKey, bucket);

  if (bucketStore.size > 2_000) {
    for (const [storedKey, value] of bucketStore.entries()) {
      if (value.resetAt <= now) bucketStore.delete(storedKey);
    }
  }

  return {
    allowed: bucket.count <= currentConfig.limit,
    remaining: Math.max(0, currentConfig.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function rateHeaders(currentConfig, rate) {
  return {
    "X-RateLimit-Limit": String(currentConfig.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1_000)),
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

function resolveProviderPlan() {
  const rawRequested = String(process.env.ASTRO911_PROVIDER ?? "gemini").trim().toLowerCase();
  const requested = ["gemini", "openai"].includes(rawRequested) ? rawRequested : "gemini";
  const geminiKey = firstSecret(
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
  const openAIKey = firstSecret(process.env.OPENAI_API_KEY);
  const openAIModel = cleanModelName(
    process.env.ASTRO911_OPENAI_MODEL ?? process.env.OPENAI_MODEL,
    "gpt-5.6-terra",
  );

  if (requested === "openai") {
    return openAIKey
      ? [{ id: "openai", key: openAIKey, model: openAIModel, role: "primary" }]
      : [];
  }
  if (!geminiKey) return [];

  const model = cleanModelName(
    process.env.ASTRO911_MODEL ?? process.env.GEMINI_MODEL,
    DEFAULT_GEMINI_MODEL,
  );
  const rawFallback = String(
    process.env.ASTRO911_FALLBACK_MODEL
      ?? process.env.GEMINI_FALLBACK_MODEL
      ?? DEFAULT_GEMINI_FALLBACK_MODEL,
  ).trim();
  const fallbackModel = ["", "none", "off", "false"].includes(rawFallback.toLowerCase())
    ? ""
    : cleanModelName(rawFallback, DEFAULT_GEMINI_FALLBACK_MODEL);
  const candidates = [{ id: "gemini", key: geminiKey, model, role: "primary" }];

  if (fallbackModel && fallbackModel !== model) {
    candidates.push({ id: "gemini", key: geminiKey, model: fallbackModel, role: "model_fallback" });
  }
  if (openAIKey) {
    candidates.push({ id: "openai", key: openAIKey, model: openAIModel, role: "provider_fallback" });
  }
  return candidates.slice(0, MAX_PROVIDER_CALLS);
}

export async function generateAstro911DocumentForReview({ context, questionnaire, requestId }) {
  const normalized = validateAstro911Request({
    agent: "astro-911",
    schemaVersion: ASTRO911_SCHEMA_VERSION,
    requestId: String(requestId || `review-${Date.now()}`).slice(0, 100),
    context: {
      experience: "astrology.natal-document.v1",
      chart: context,
      personalization: questionnaire,
    },
  });
  const providerPlan = resolveProviderPlan();
  if (!providerPlan.length) {
    throw new Astro911ProviderError("provider_unavailable", {
      kind: "unavailable",
      status: 503,
      providerCode: "provider_not_configured",
    });
  }
  return executeAstro911(normalized, providerPlan);
}

function repairInstruction(reasons) {
  if (!reasons.length) return "";
  const reasonList = reasons.map((reason) => String(reason).slice(0, 60)).join(", ");
  return `\n\nREPARO ESTRUTURAL ÚNICO: devolva o documento JSON inteiro, completo e válido no schema. Preserve exclusivamente posições e aspectos do catálogo recebido, cubra todos os capítulos e não mencione reparo ou auditoria. Motivos técnicos: ${reasonList}.`;
}

function parseRetryAfter(headers) {
  const rawValue = String(headers?.get?.("retry-after") ?? "").trim();
  if (!rawValue) return 0;
  const seconds = Number(rawValue);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(rawValue);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function providerFailure(payload, response, candidate) {
  const status = Number(response.status) || 0;
  const providerCode = candidate.id === "gemini"
    ? payload?.error?.status || payload?.error?.code || `gemini_${status}`
    : payload?.error?.code || `openai_${status}`;
  const quota = status === 429 || String(providerCode).toUpperCase() === "RESOURCE_EXHAUSTED";
  const unavailable = status === 404 || status === 408 || status === 425 || status >= 500;
  return new Astro911ProviderError(String(providerCode), {
    kind: quota ? "quota" : unavailable ? "unavailable" : status === 400 ? "invalid_response" : "unavailable",
    status,
    provider: candidate.id,
    model: candidate.model,
    candidate,
    providerCode: String(providerCode).slice(0, 80),
    providerType: String(payload?.error?.type ?? payload?.error?.status ?? "unknown").slice(0, 80),
    providerMessage: String(payload?.error?.message ?? "").slice(0, 240),
    recoverableFallback: quota || unavailable,
    repairable: false,
    retryAfterMs: parseRetryAfter(response.headers),
  });
}

function invalidProviderResponse(error, candidate) {
  return new Astro911ProviderError("provider_invalid_response", {
    kind: "invalid_response",
    status: 502,
    provider: candidate.id,
    model: candidate.model,
    candidate,
    providerCode: String(error?.message ?? "invalid_json").slice(0, 80),
    providerType: "invalid_output",
    recoverableFallback: false,
    repairable: true,
    retryAfterMs: 0,
  });
}

function networkProviderError(error, candidate, timedOut) {
  return new Astro911ProviderError(timedOut ? "provider_timeout" : "provider_unavailable", {
    kind: timedOut ? "timeout" : "unavailable",
    status: timedOut ? 504 : 503,
    provider: candidate.id,
    model: candidate.model,
    candidate,
    providerCode: timedOut ? "provider_timeout" : "network_error",
    providerType: timedOut ? "timeout" : "network_error",
    providerMessage: String(error?.message ?? "").slice(0, 240),
    recoverableFallback: true,
    repairable: false,
    retryAfterMs: 0,
  });
}

function usageNumber(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

function extractUsage(payload, provider) {
  if (provider === "gemini" && payload?.usageMetadata) {
    return {
      inputTokens: usageNumber(payload.usageMetadata.promptTokenCount),
      outputTokens: usageNumber(payload.usageMetadata.candidatesTokenCount),
      thinkingTokens: usageNumber(payload.usageMetadata.thoughtsTokenCount),
      totalTokens: usageNumber(payload.usageMetadata.totalTokenCount),
    };
  }
  if (provider === "openai" && payload?.usage) {
    return {
      inputTokens: usageNumber(payload.usage.input_tokens),
      outputTokens: usageNumber(payload.usage.output_tokens),
      thinkingTokens: usageNumber(payload.usage.output_tokens_details?.reasoning_tokens),
      totalTokens: usageNumber(payload.usage.total_tokens),
    };
  }
  return null;
}

function providerPrices(candidate) {
  if (candidate.id === "openai") {
    return {
      inputUsdPerMillion: decimalEnv("ASTRO911_OPENAI_INPUT_USD_PER_M", 2, 0, 100),
      outputUsdPerMillion: decimalEnv("ASTRO911_OPENAI_OUTPUT_USD_PER_M", 12, 0, 200),
    };
  }
  return {
    // O fallback Flash-Lite usa esta mesma reserva maior de propósito: o gate
    // permanece conservador mesmo quando o modelo barato entra.
    inputUsdPerMillion: decimalEnv("ASTRO911_GEMINI_INPUT_USD_PER_M", 1.5, 0, 100),
    outputUsdPerMillion: decimalEnv("ASTRO911_GEMINI_OUTPUT_USD_PER_M", 9, 0, 200),
  };
}

function estimatedCostBrl(candidate, inputTokens, outputTokens, exchangeRate) {
  const prices = providerPrices(candidate);
  const usd = ((Math.max(0, inputTokens) * prices.inputUsdPerMillion)
    + (Math.max(0, outputTokens) * prices.outputUsdPerMillion)) / 1_000_000;
  return usd * exchangeRate;
}

function projectedProviderCost(options, candidate, metrics) {
  const body = String(options?.body ?? "");
  let outputTokens = metrics.runtimeConfig.maxOutputTokens;
  try {
    const parsed = JSON.parse(body);
    outputTokens = Number(parsed.max_output_tokens ?? parsed.generationConfig?.maxOutputTokens)
      || metrics.runtimeConfig.maxOutputTokens;
  } catch {
    // Mantém o teto configurado quando o corpo não puder ser inspecionado.
  }
  return estimatedCostBrl(
    candidate,
    Math.ceil(body.length / 3),
    outputTokens,
    metrics.runtimeConfig.usdBrlBudgetRate,
  );
}

function createMetrics(normalized) {
  const startedAt = Date.now();
  const currentRuntimeConfig = runtimeConfig();
  return {
    requestId: String(normalized.requestId || `astro-${startedAt}`).replace(/\s+/gu, " ").slice(0, 100),
    startedAt,
    deadlineAt: startedAt + currentRuntimeConfig.totalTimeoutMs,
    runtimeConfig: currentRuntimeConfig,
    calls: 0,
    fallback: false,
    providerFallback: false,
    repaired: false,
    usage: [],
    projectedCostBrl: 0,
    lastProvider: "unknown",
    lastModel: "unknown",
  };
}

async function performProviderRequest(url, options, candidate, metrics, repair) {
  if (metrics.calls >= MAX_PROVIDER_CALLS) {
    throw new Astro911ProviderError("provider_call_budget_exhausted", {
      kind: "unavailable",
      status: 503,
      provider: candidate.id,
      model: candidate.model,
      candidate,
      providerCode: "call_budget_exhausted",
      providerType: "budget",
      recoverableFallback: false,
      repairable: false,
    });
  }

  const projectedCallCostBrl = projectedProviderCost(options, candidate, metrics);
  if (metrics.projectedCostBrl + projectedCallCostBrl > metrics.runtimeConfig.maxCostBrl) {
    throw new Astro911ProviderError("cost_budget_exhausted", {
      kind: "unavailable",
      status: 503,
      provider: candidate.id,
      model: candidate.model,
      candidate,
      providerCode: "cost_budget_exhausted",
      providerType: "budget",
      recoverableFallback: false,
      repairable: false,
    });
  }
  metrics.projectedCostBrl += projectedCallCostBrl;

  const remainingMs = metrics.deadlineAt - Date.now();
  if (remainingMs < 500) throw networkProviderError(new Error("total_timeout"), candidate, true);
  const timeoutMs = Math.min(metrics.runtimeConfig.providerTimeoutMs, remainingMs);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("provider_timeout", "AbortError")),
    timeoutMs,
  );
  const callNumber = metrics.calls + 1;
  metrics.calls = callNumber;
  metrics.lastProvider = candidate.id;
  metrics.lastModel = candidate.model;

  console.info("astro911_provider_call", {
    requestId: metrics.requestId,
    provider: candidate.id,
    model: candidate.model,
    call: callNumber,
    repair,
  });

  const callStartedAt = Date.now();
  try {
    const providerResponse = await fetch(url, { ...options, signal: controller.signal });
    const payload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) throw providerFailure(payload, providerResponse, candidate);
    const usage = extractUsage(payload, candidate.id);
    if (usage) {
      metrics.usage.push({
        provider: candidate.id,
        model: candidate.model,
        call: callNumber,
        durationMs: Date.now() - callStartedAt,
        estimatedCostBrl: estimatedCostBrl(
          candidate,
          usage.inputTokens,
          usage.outputTokens,
          metrics.runtimeConfig.usdBrlBudgetRate,
        ),
        ...usage,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof Astro911ProviderError) throw error;
    throw networkProviderError(error, candidate, controller.signal.aborted || error?.name === "AbortError");
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(normalized, candidate, repairReasons, metrics) {
  const factIds = normalized.facts.map((fact) => fact.id);
  const payload = await performProviderRequest(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": candidate.key,
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
          maxOutputTokens: metrics.runtimeConfig.maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: createAstro911ResponseSchema(factIds),
          thinkingConfig: {
            includeThoughts: false,
            thinkingLevel: "MINIMAL",
          },
          temperature: 0.76,
          topP: 0.9,
        },
      }),
    },
    candidate,
    metrics,
    repairReasons.length > 0,
  );

  try {
    return { document: parseGeminiAstroOutput(payload), candidate };
  } catch (error) {
    throw invalidProviderResponse(error, candidate);
  }
}

async function callOpenAI(normalized, candidate, repairReasons, metrics) {
  const factIds = normalized.facts.map((fact) => fact.id);
  const payload = await performProviderRequest(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${candidate.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidate.model,
        store: false,
        reasoning: { effort: "medium" },
        instructions: ASTRO911_INSTRUCTIONS + repairInstruction(repairReasons),
        input: buildAstro911ModelInput(normalized, repairReasons),
        max_output_tokens: metrics.runtimeConfig.maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: "astro911_natal_document",
            strict: true,
            schema: createAstro911ResponseSchema(factIds),
          },
        },
      }),
    },
    candidate,
    metrics,
    repairReasons.length > 0,
  );

  try {
    return { document: parseOpenAIAstroOutput(payload), candidate };
  } catch (error) {
    throw invalidProviderResponse(error, candidate);
  }
}

function callCandidate(normalized, candidate, repairReasons, metrics) {
  return candidate.id === "openai"
    ? callOpenAI(normalized, candidate, repairReasons, metrics)
    : callGemini(normalized, candidate, repairReasons, metrics);
}

function cooldownKey(candidate) {
  return `${candidate.id}:${candidate.model}`;
}

function setProviderCooldown(candidate, error, metrics) {
  if (!error.recoverableFallback) return;
  const configuredDelay = error.kind === "quota"
    ? metrics.runtimeConfig.quotaCooldownMs
    : metrics.runtimeConfig.providerCooldownMs;
  const retryAfterMs = Math.max(error.retryAfterMs || 0, configuredDelay);
  error.retryAfterMs = retryAfterMs;
  providerCooldownStore.set(cooldownKey(candidate), {
    until: Date.now() + retryAfterMs,
    kind: error.kind,
    status: error.status,
    providerCode: error.providerCode,
  });
}

function cooldownError(candidate) {
  const cooldown = providerCooldownStore.get(cooldownKey(candidate));
  if (!cooldown) return null;
  if (cooldown.until <= Date.now()) {
    providerCooldownStore.delete(cooldownKey(candidate));
    return null;
  }
  return new Astro911ProviderError("provider_cooldown", {
    kind: cooldown.kind,
    status: cooldown.status,
    provider: candidate.id,
    model: candidate.model,
    candidate,
    providerCode: cooldown.providerCode,
    providerType: "cooldown",
    recoverableFallback: true,
    repairable: false,
    retryAfterMs: cooldown.until - Date.now(),
  });
}

function logFallback(fromCandidate, toCandidate, error, metrics) {
  metrics.fallback = true;
  metrics.providerFallback ||= fromCandidate.id !== toCandidate.id;
  const event = fromCandidate.id === toCandidate.id
    ? "astro911_model_fallback"
    : "astro911_provider_fallback";
  console.warn(event, {
    requestId: metrics.requestId,
    fromProvider: fromCandidate.id,
    fromModel: fromCandidate.model,
    toProvider: toCandidate.id,
    toModel: toCandidate.model,
    type: error.kind,
    status: Number(error.status) || null,
    providerCode: String(error.providerCode ?? "unknown").slice(0, 80),
  });
}

async function callProviderPlan(normalized, providerPlan, metrics) {
  let lastError = null;
  for (let index = 0; index < providerPlan.length; index += 1) {
    const candidate = providerPlan[index];
    const nextCandidate = providerPlan[index + 1];
    const pausedError = cooldownError(candidate);
    if (pausedError) {
      metrics.lastProvider = candidate.id;
      metrics.lastModel = candidate.model;
      lastError = pausedError;
      if (nextCandidate) logFallback(candidate, nextCandidate, pausedError, metrics);
      continue;
    }

    try {
      return await callCandidate(normalized, candidate, [], metrics);
    } catch (error) {
      lastError = error;
      if (error.kind === "invalid_response" || !error.recoverableFallback) throw error;
      setProviderCooldown(candidate, error, metrics);
      if (nextCandidate) logFallback(candidate, nextCandidate, error, metrics);
    }
  }
  throw lastError ?? new Astro911ProviderError("provider_unavailable", {
    kind: "unavailable",
    status: 503,
    providerCode: "empty_provider_plan",
    providerType: "configuration",
  });
}

function normalizeProviderDocument(rawDocument, normalized) {
  const document = normalizeAstro911Document(rawDocument);
  const allowed = new Set(normalized.facts.map((fact) => fact.id));
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      anchors: section.anchors.filter((id) => allowed.has(id)),
    })),
    audit: {
      ...document.audit,
      usedFactIds: document.audit.usedFactIds.filter((id) => allowed.has(id)),
    },
  };
}

function classifyAudit(audit) {
  const reasons = Array.isArray(audit?.reasons) ? [...new Set(audit.reasons)] : [];
  return {
    repairReasons: reasons.filter((reason) => structuralRepairReasons.has(reason)),
    blockingReasons: reasons.filter(
      (reason) => !softAuditReasons.has(reason) && !structuralRepairReasons.has(reason),
    ),
  };
}

function invalidAuditError(providerResult, reasons) {
  return new Astro911ProviderError("provider_invalid_response", {
    kind: "invalid_response",
    status: 502,
    provider: providerResult?.candidate?.id,
    model: providerResult?.candidate?.model,
    candidate: providerResult?.candidate,
    providerCode: String(reasons[0] ?? "audit_failed").slice(0, 80),
    providerType: "audit_failed",
    providerMessage: reasons.slice(0, 8).join(", ").slice(0, 240),
    recoverableFallback: false,
    repairable: false,
  });
}

async function generateDocument(normalized, providerPlan, metrics) {
  let providerResult;
  try {
    providerResult = await callProviderPlan(normalized, providerPlan, metrics);
  } catch (error) {
    if (!error.repairable || metrics.calls >= MAX_PROVIDER_CALLS) throw error;
    metrics.repaired = true;
    providerResult = await callCandidate(
      normalized,
      error.candidate,
      ["provider_invalid_response"],
      metrics,
    );
  }

  let document = normalizeProviderDocument(providerResult.document, normalized);
  let classification = classifyAudit(auditAstro911Document(document, normalized));
  if (classification.blockingReasons.length > 0) {
    throw invalidAuditError(providerResult, classification.blockingReasons);
  }

  if (classification.repairReasons.length > 0) {
    if (metrics.repaired || metrics.calls >= MAX_PROVIDER_CALLS) {
      throw invalidAuditError(providerResult, classification.repairReasons);
    }
    metrics.repaired = true;
    providerResult = await callCandidate(
      normalized,
      providerResult.candidate,
      classification.repairReasons,
      metrics,
    );
    document = normalizeProviderDocument(providerResult.document, normalized);
    classification = classifyAudit(auditAstro911Document(document, normalized));
  }

  if (classification.blockingReasons.length > 0 || classification.repairReasons.length > 0) {
    throw invalidAuditError(providerResult, [
      ...classification.blockingReasons,
      ...classification.repairReasons,
    ]);
  }
  return { providerResult, document };
}

function usageTotals(metrics) {
  return metrics.usage.reduce((totals, usage) => ({
    inputTokens: totals.inputTokens + usage.inputTokens,
    outputTokens: totals.outputTokens + usage.outputTokens,
    thinkingTokens: totals.thinkingTokens + usage.thinkingTokens,
    totalTokens: totals.totalTokens + usage.totalTokens,
  }), { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0 });
}

function logUsage(metrics) {
  const totals = usageTotals(metrics);
  const estimatedCostBrlTotal = metrics.usage.reduce(
    (total, usage) => total + (Number(usage.estimatedCostBrl) || 0),
    0,
  );
  console.info("astro911_usage", {
    provider: metrics.lastProvider,
    model: metrics.lastModel,
    document: "natal_complete",
    inputTokens: metrics.usage.length ? totals.inputTokens : null,
    outputTokens: metrics.usage.length ? totals.outputTokens : null,
    thinkingTokens: metrics.usage.length ? totals.thinkingTokens : null,
    totalTokens: metrics.usage.length ? totals.totalTokens : null,
    calls: metrics.calls,
    repaired: metrics.repaired,
    fallback: metrics.fallback,
    providerFallback: metrics.providerFallback,
    durationMs: Date.now() - metrics.startedAt,
    usageByCall: metrics.usage,
    estimatedCostBrl: Number(estimatedCostBrlTotal.toFixed(4)),
    projectedCostBrl: Number(metrics.projectedCostBrl.toFixed(4)),
    maxCostBrl: metrics.runtimeConfig.maxCostBrl,
  });
}

function logFailure(error, metrics) {
  console.error("astro911_request_failed", {
    requestId: metrics.requestId,
    type: error.kind === "quota" ? "provider_quota"
      : error.kind === "timeout" ? "provider_timeout"
        : error.kind === "invalid_response" ? "provider_invalid_response"
          : error.kind === "unavailable" ? "provider_unavailable" : "unknown",
    status: Number(error.status) || null,
    providerCode: String(error.providerCode ?? "unknown").slice(0, 80),
    providerType: String(error.providerType ?? "unknown").slice(0, 80),
    provider: String(error.provider ?? metrics.lastProvider ?? "unknown").slice(0, 20),
    model: String(error.model ?? metrics.lastModel ?? "unknown").slice(0, 80),
    calls: metrics.calls,
    repaired: metrics.repaired,
    fallback: metrics.fallback,
    durationMs: Date.now() - metrics.startedAt,
  });
}

async function executeAstro911(normalized, providerPlan) {
  const metrics = createMetrics(normalized);
  console.info("astro911_request_started", {
    requestId: metrics.requestId,
    document: "natal_complete",
  });

  try {
    const { providerResult, document } = await generateDocument(normalized, providerPlan, metrics);
    metrics.lastProvider = providerResult.candidate.id;
    metrics.lastModel = providerResult.candidate.model;
    const usedFactIds = [
      ...document.audit.usedFactIds,
      ...document.sections.flatMap((section) => section.anchors),
    ];
    const payload = {
      document,
      factLabels: factLabelsForResponse(normalized, usedFactIds),
      meta: {
        schemaVersion: ASTRO911_SCHEMA_VERSION,
        grounded: true,
        provider: providerResult.candidate.id,
        model: providerResult.candidate.model,
        usedFallbackModel: providerResult.candidate.role === "model_fallback",
        rawBirthDataSent: false,
      },
    };

    logUsage(metrics);
    console.info("astro911_request_completed", {
      requestId: metrics.requestId,
      provider: metrics.lastProvider,
      model: metrics.lastModel,
      document: "natal_complete",
      calls: metrics.calls,
      repaired: metrics.repaired,
      fallback: metrics.fallback,
      durationMs: Date.now() - metrics.startedAt,
    });
    return payload;
  } catch (error) {
    logUsage(metrics);
    logFailure(error, metrics);
    throw error;
  }
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizePaidAccess(body) {
  const catalog = createProductCatalog(process.env);
  if (catalog.astralDocument.priceCents <= 0) {
    const freeProduction = String(
      process.env.VITE_ASTRO911_ALLOW_FREE_PRODUCTION ?? "false",
    ).trim().toLowerCase() === "true";
    if (!freeProduction) throw new PaymentLedgerError("astral_not_configured", 503);
    return null;
  }
  const payment = body?.payment;
  const sessionId = String(payment?.sessionId ?? "").trim();
  const orderId = String(payment?.orderId ?? "").trim();
  const productId = String(payment?.productId ?? "").trim();
  const readingId = String(payment?.readingId ?? "").trim();
  const expectedReadingId = `astro-v1-${hashString(JSON.stringify(body?.context?.chart ?? {}))}`;
  if (!/^mp-\d{5,30}$/u.test(sessionId)
      || productId !== catalog.astralDocument.id
      || readingId !== expectedReadingId) {
    throw new PaymentLedgerError("payment_required", 402);
  }
  return { sessionId, orderId, productId, readingId, questionNumber: 0 };
}

function requestFingerprint(normalized, ip, paidAccess = null) {
  return createHash("sha256").update(JSON.stringify({
    ip: paidAccess ? undefined : ip,
    paymentSessionId: paidAccess?.sessionId ?? "",
    chart: normalized.chart,
  })).digest("hex");
}

async function executePaidAstro911(normalized, providerPlan, paidAccess, fingerprint) {
  const claim = {
    ...paidAccess,
    claimId: createHash("sha256")
      .update(`${paidAccess.sessionId}:${fingerprint}`)
      .digest("hex"),
  };
  await claimPaymentEntitlement(claim);
  try {
    const payload = await executeAstro911(normalized, providerPlan);
    return await completePaidContent(claim, payload, { chart: normalized.chart });
  } catch (error) {
    try {
      await settlePaymentEntitlement(claim, "released");
    } catch (releaseError) {
      console.error("payment_entitlement_release_failed", {
        document: "natal_complete",
        type: releaseError?.code ?? "payment_ledger_unavailable",
      });
    }
    throw error;
  }
}

function cleanTransientStores(now) {
  for (const [key, value] of responseStore.entries()) {
    if (value.expiresAt <= now) responseStore.delete(key);
  }
  while (responseStore.size > 250) responseStore.delete(responseStore.keys().next().value);
  for (const [key, value] of providerCooldownStore.entries()) {
    if (value.until <= now) providerCooldownStore.delete(key);
  }
  while (providerCooldownStore.size > 100) {
    providerCooldownStore.delete(providerCooldownStore.keys().next().value);
  }
}

function publicProviderError(error) {
  if (error instanceof PaymentLedgerError) {
    return {
      status: error.status,
      code: error.code,
      retryAfterMs: error.retryAfterMs,
    };
  }
  if (error?.kind === "quota") {
    return { status: 503, code: "provider_quota", retryAfterMs: error.retryAfterMs || 0 };
  }
  if (error?.kind === "timeout") {
    return { status: 504, code: "provider_timeout", retryAfterMs: error.retryAfterMs || 0 };
  }
  if (error?.kind === "invalid_response") {
    return { status: 502, code: "provider_invalid_response", retryAfterMs: 0 };
  }
  if (error?.kind === "unavailable") {
    return { status: 503, code: "provider_unavailable", retryAfterMs: error.retryAfterMs || 0 };
  }
  return { status: 502, code: "unknown", retryAfterMs: 0 };
}

export function resetAstro911RuntimeStateForTests() {
  bucketStore.clear();
  inFlightStore.clear();
  responseStore.clear();
  providerCooldownStore.clear();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  let body;
  let normalized;
  let paidAccess;
  try {
    body = parseBody(request);
    normalized = validateAstro911Request(body);
    paidAccess = normalizePaidAccess(body);
  } catch (error) {
    if (error instanceof PaymentLedgerError) {
      return sendJson(response, error.status, { error: error.code });
    }
    console.warn("astro911_request_failed", {
      requestId: "invalid",
      type: "invalid_payload",
      status: 400,
      calls: 0,
    });
    return sendJson(response, 400, { error: "invalid_payload" });
  }

  if (paidAccess) {
    try {
      const stored = await readPaidContent(paidAccess);
      if (stored.snapshot?.context && !isDeepStrictEqual(stored.snapshot.context, body.context.chart)) {
        return sendJson(response, 409, { error: "payment_mismatch" });
      }
      const saved = stored.results?.find((item) => item.scope === "single");
      if (saved) return sendJson(response, 200, saved.payload);
    } catch (error) {
      return sendJson(response, error.status || 503, { error: error.code || "payment_ledger_unavailable" });
    }
  }

  const ip = requestIp(request);
  const fingerprint = requestFingerprint(normalized, ip, paidAccess);
  const now = Date.now();
  cleanTransientStores(now);

  const cached = paidAccess ? null : responseStore.get(fingerprint);
  if (cached && cached.expiresAt > now) {
    console.info("astro911_request_completed", {
      requestId: normalized.requestId,
      document: "natal_complete",
      calls: 0,
      repaired: false,
      fallback: false,
      deduplicated: true,
      durationMs: 0,
    });
    return sendJson(response, 200, cached.payload);
  }

  const pending = inFlightStore.get(fingerprint);
  if (pending) {
    try {
      return sendJson(response, 200, await pending);
    } catch (error) {
      const publicError = publicProviderError(error);
      const headers = publicError.retryAfterMs > 0
        ? { "Retry-After": String(Math.max(1, Math.ceil(publicError.retryAfterMs / 1_000))) }
        : {};
      return sendJson(response, publicError.status, { error: publicError.code }, headers);
    }
  }

  const currentRateConfig = rateLimitConfig();
  const rate = consumeRateLimit(ip, currentRateConfig);
  const currentRateHeaders = rateHeaders(currentRateConfig, rate);
  if (!rate.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rate.resetAt - now) / 1_000));
    console.warn("astro911_request_failed", {
      requestId: normalized.requestId,
      type: "rate_limit",
      status: 429,
      calls: 0,
    });
    return sendJson(
      response,
      429,
      { error: "rate_limit" },
      { ...currentRateHeaders, "Retry-After": String(retryAfterSeconds) },
    );
  }

  const providerPlan = resolveProviderPlan();
  if (!providerPlan.length) {
    console.error("astro911_request_failed", {
      requestId: normalized.requestId,
      type: "provider_unavailable",
      status: 503,
      providerCode: "provider_not_configured",
      calls: 0,
    });
    return sendJson(response, 503, { error: "provider_unavailable" }, currentRateHeaders);
  }

  const operation = paidAccess
    ? executePaidAstro911(normalized, providerPlan, paidAccess, fingerprint)
    : executeAstro911(normalized, providerPlan);
  inFlightStore.set(fingerprint, operation);
  try {
    const payload = await operation;
    responseStore.set(fingerprint, {
      payload,
      expiresAt: Date.now() + runtimeConfig().dedupeTtlMs,
    });
    return sendJson(response, 200, payload, currentRateHeaders);
  } catch (error) {
    const publicError = publicProviderError(error);
    const headers = publicError.retryAfterMs > 0
      ? { "Retry-After": String(Math.max(1, Math.ceil(publicError.retryAfterMs / 1_000))) }
      : {};
    return sendJson(
      response,
      publicError.status,
      { error: publicError.code },
      { ...currentRateHeaders, ...headers },
    );
  } finally {
    if (inFlightStore.get(fingerprint) === operation) inFlightStore.delete(fingerprint);
  }
}
