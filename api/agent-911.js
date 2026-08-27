import { createHash } from "node:crypto";
import {
  AGENT911_INSTRUCTIONS,
  AGENT911_MAX_FOLLOW_UPS,
  AGENT911_SCHEMA_VERSION,
  Agent911ValidationError,
  auditAgent911Response,
  buildAgent911ModelInput,
  createAgent911ResponseSchema,
  createGeminiResponseSchema,
  normalizeAgent911InterpretiveLanguage,
  normalizeAgent911ReadingModeOutput,
  parseGeminiOutput,
  parseOpenAIOutput,
  validateAgent911Request,
} from "../server/agent911-core.js";
import { createProductCatalog } from "../src/config/productCatalog.js";
import {
  PaymentLedgerError,
  claimBundlePaymentEntitlement,
  claimPaymentEntitlement,
  settleBundlePaymentEntitlement,
  settlePaymentEntitlement,
} from "../server/payment-ledger.js";

export const config = { maxDuration: 60 };

const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1_000;
const DEFAULT_RATE_LIMIT = 24;
const DEFAULT_PROVIDER_TIMEOUT_MS = 18_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 50_000;
const DEFAULT_QUOTA_COOLDOWN_MS = 60_000;
const DEFAULT_PROVIDER_COOLDOWN_MS = 12_000;
const DEFAULT_DEDUPE_TTL_MS = 2 * 60 * 1_000;
const DEFAULT_MAX_COST_BRL = 1;
const DEFAULT_USD_BRL_BUDGET_RATE = 6;
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;
const MAX_PROVIDER_CALLS = 3;
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
const GEMINI_DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const bucketStore = globalThis.__arcane911RateBuckets ?? new Map();
const inFlightStore = globalThis.__arcane911InFlight ?? new Map();
const responseStore = globalThis.__arcane911Responses ?? new Map();
const providerCooldownStore = globalThis.__arcane911ProviderCooldowns ?? new Map();
globalThis.__arcane911RateBuckets = bucketStore;
globalThis.__arcane911InFlight = inFlightStore;
globalThis.__arcane911Responses = responseStore;
globalThis.__arcane911ProviderCooldowns = providerCooldownStore;

const softAuditReasons = new Set([
  "generic_opening",
  "question_not_reflected",
  "reading_suggestions_invalid",
  "repetitive_language",
  "selected_card_names_missing",
]);

const structuralRepairReasons = new Set([
  "payload_not_object",
  "response_mode_invalid",
  "required_text_missing",
  "sections_missing",
  "reading_sections_missing",
  "section_invalid",
  "duplicate_section_card_slug",
  "selected_card_not_grounded",
  "summary_sections_invalid",
  "invalid_audit_slugs",
  "reading_audit_empty",
  "audit_missing",
]);

class Agent911ProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "Agent911ProviderError";
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
    limit: integerEnv("ARCANE911_RATE_LIMIT", DEFAULT_RATE_LIMIT, 1, 1_000),
    windowMs: integerEnv("ARCANE911_RATE_WINDOW_MS", DEFAULT_RATE_WINDOW_MS, 1_000, 24 * 60 * 60 * 1_000),
  };
}

function runtimeConfig() {
  return {
    providerTimeoutMs: integerEnv("AGENT911_PROVIDER_TIMEOUT_MS", DEFAULT_PROVIDER_TIMEOUT_MS, 3_000, 45_000),
    totalTimeoutMs: integerEnv("AGENT911_TOTAL_TIMEOUT_MS", DEFAULT_TOTAL_TIMEOUT_MS, 10_000, 55_000),
    quotaCooldownMs: integerEnv("AGENT911_QUOTA_COOLDOWN_MS", DEFAULT_QUOTA_COOLDOWN_MS, 1_000, 60 * 60 * 1_000),
    providerCooldownMs: integerEnv("AGENT911_PROVIDER_COOLDOWN_MS", DEFAULT_PROVIDER_COOLDOWN_MS, 1_000, 10 * 60 * 1_000),
    dedupeTtlMs: integerEnv("AGENT911_DEDUPE_TTL_MS", DEFAULT_DEDUPE_TTL_MS, 1_000, 10 * 60 * 1_000),
    maxCostBrl: decimalEnv("AGENT911_MAX_COST_BRL", DEFAULT_MAX_COST_BRL, 0.1, 10),
    usdBrlBudgetRate: decimalEnv("AGENT911_USD_BRL_BUDGET_RATE", DEFAULT_USD_BRL_BUDGET_RATE, 1, 20),
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
    throw new Agent911ValidationError("Corpo da requisição inválido.", "invalid_payload");
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

function cleanModelName(value, fallback = "") {
  const model = String(value ?? fallback).trim();
  return /^[a-zA-Z0-9._-]+$/u.test(model) ? model : fallback;
}

function firstSecret(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
}

function resolveProviderPlan() {
  const rawRequested = String(process.env.AGENT911_PROVIDER ?? "gemini").trim().toLowerCase();
  const requested = ["auto", "gemini", "openai"].includes(rawRequested) ? rawRequested : "auto";
  const geminiKey = firstSecret(
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
  const openAIKey = firstSecret(process.env.OPENAI_API_KEY);
  const openAIModel = cleanModelName(process.env.OPENAI_MODEL, "gpt-5.6-terra");

  if (requested === "openai") {
    return openAIKey
      ? [{ id: "openai", key: openAIKey, model: openAIModel, role: "primary" }]
      : [];
  }

  if (!geminiKey) {
    return [];
  }

  const model = cleanModelName(process.env.GEMINI_MODEL, GEMINI_DEFAULT_MODEL);
  const rawFallback = String(process.env.GEMINI_FALLBACK_MODEL ?? GEMINI_DEFAULT_FALLBACK_MODEL)
    .trim()
    .toLowerCase();
  const fallbackModel = ["", "none", "off", "false"].includes(rawFallback)
    ? ""
    : cleanModelName(process.env.GEMINI_FALLBACK_MODEL, GEMINI_DEFAULT_FALLBACK_MODEL);
  const candidates = [{ id: "gemini", key: geminiKey, model, role: "primary" }];

  if (fallbackModel && fallbackModel !== model) {
    candidates.push({ id: "gemini", key: geminiKey, model: fallbackModel, role: "model_fallback" });
  }
  if (openAIKey) {
    candidates.push({ id: "openai", key: openAIKey, model: openAIModel, role: "provider_fallback" });
  }
  return candidates.slice(0, MAX_PROVIDER_CALLS);
}

function outputTokenLimit(normalized) {
  const configuredMaximum = integerEnv(
    "AGENT911_MAX_OUTPUT_TOKENS",
    DEFAULT_MAX_OUTPUT_TOKENS,
    1_024,
    DEFAULT_MAX_OUTPUT_TOKENS,
  );
  if (normalized.action === "opening_summary") return Math.min(3_072, configuredMaximum);
  if (normalized.action === "specific_summary") return Math.min(3_584, configuredMaximum);
  if (normalized.action === "complete_summary") return configuredMaximum;
  return Math.min(3_584, configuredMaximum);
}

function providerPrices(candidate) {
  if (candidate.id === "openai") {
    return {
      inputUsdPerMillion: decimalEnv("AGENT911_OPENAI_INPUT_USD_PER_M", 2, 0, 100),
      outputUsdPerMillion: decimalEnv("AGENT911_OPENAI_OUTPUT_USD_PER_M", 12, 0, 200),
    };
  }
  return {
    inputUsdPerMillion: decimalEnv("AGENT911_GEMINI_INPUT_USD_PER_M", 1.5, 0, 100),
    outputUsdPerMillion: decimalEnv("AGENT911_GEMINI_OUTPUT_USD_PER_M", 9, 0, 200),
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
  let outputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
  try {
    const parsed = JSON.parse(body);
    outputTokens = Number(parsed.max_output_tokens ?? parsed.generationConfig?.maxOutputTokens)
      || DEFAULT_MAX_OUTPUT_TOKENS;
  } catch {
    // O teto conservador permanece quando o corpo não puder ser inspecionado.
  }
  const inputTokens = Math.ceil(body.length / 3);
  return estimatedCostBrl(
    candidate,
    inputTokens,
    outputTokens,
    metrics.runtimeConfig.usdBrlBudgetRate,
  );
}

function spreadLabel(normalized) {
  const count = normalized.reading.cardSlugs.length;
  return count === 7 ? "seven_cards" : count === 5 ? "five_cards" : "three_cards";
}

function repairInstruction(repairReasons) {
  if (!repairReasons.length) return "";
  const reasonList = repairReasons.map((reason) => String(reason).slice(0, 60)).join(", ");
  return `\n\nREPARO ESTRUTURAL ÚNICO: devolva um objeto JSON completo e válido no schema solicitado. Preencha todos os campos essenciais, mantenha somente as cartas recebidas e cubra a mesa inteira. Motivos técnicos: ${reasonList}. Não comente o reparo.`;
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
  return new Agent911ProviderError(String(providerCode), {
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
  return new Agent911ProviderError("provider_invalid_response", {
    kind: "invalid_response",
    status: 502,
    provider: candidate.id,
    model: candidate.model,
    candidate,
    providerCode: String(error?.providerCode ?? error?.message ?? "invalid_json").slice(0, 80),
    providerType: String(error?.providerType ?? "invalid_output").slice(0, 80),
    providerMessage: String(error?.providerMessage ?? "").slice(0, 240),
    recoverableFallback: false,
    repairable: true,
    retryAfterMs: 0,
  });
}

function networkProviderError(error, candidate, timedOut) {
  return new Agent911ProviderError(timedOut ? "provider_timeout" : "provider_unavailable", {
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

function createMetrics(normalized) {
  const startedAt = Date.now();
  const currentRuntimeConfig = runtimeConfig();
  return {
    action: normalized.action,
    spread: spreadLabel(normalized),
    requestId: String(normalized.requestId || `a911-${startedAt}`).replace(/\s+/gu, " ").slice(0, 100),
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
    throw new Agent911ProviderError("provider_call_budget_exhausted", {
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
    throw new Agent911ProviderError("cost_budget_exhausted", {
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

  console.info("agent911_provider_call", {
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
          Math.max(usage.outputTokens, usage.totalTokens - usage.inputTokens),
          metrics.runtimeConfig.usdBrlBudgetRate,
        ),
        ...usage,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof Agent911ProviderError) throw error;
    throw networkProviderError(error, candidate, controller.signal.aborted || error?.name === "AbortError");
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(normalized, candidate, repairReasons, metrics) {
  const isSummary = ["opening_summary", "specific_summary", "complete_summary"].includes(normalized.action);
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
    },
    candidate,
    metrics,
    repairReasons.length > 0,
  );

  try {
    return { reading: parseOpenAIOutput(payload), candidate };
  } catch (error) {
    throw invalidProviderResponse(error, candidate);
  }
}

async function callGemini(normalized, candidate, repairReasons, metrics) {
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
          temperature: normalized.action === "complete_summary" ? 0.82 : normalized.action === "specific_summary" ? 0.85 : 0.88,
          topP: 0.9,
        },
      }),
    },
    candidate,
    metrics,
    repairReasons.length > 0,
  );

  try {
    return { reading: parseGeminiOutput(payload), candidate };
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
    retryAfterMs,
  });
}

function cooldownError(candidate) {
  const cooldown = providerCooldownStore.get(cooldownKey(candidate));
  if (!cooldown) return null;
  if (cooldown.until <= Date.now()) {
    providerCooldownStore.delete(cooldownKey(candidate));
    return null;
  }
  return new Agent911ProviderError("provider_cooldown", {
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
    ? "agent911_model_fallback"
    : "agent911_provider_fallback";
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
  throw lastError ?? new Agent911ProviderError("provider_unavailable", {
    kind: "unavailable",
    status: 503,
    providerCode: "empty_provider_plan",
    providerType: "configuration",
  });
}

function normalizeProviderReading(providerReading, normalized) {
  let reading = normalizeAgent911ReadingModeOutput(
    normalizeAgent911InterpretiveLanguage(providerReading),
    normalized,
  );
  if (!reading || typeof reading !== "object" || Array.isArray(reading)) return reading;

  if (["opening_summary", "specific_summary", "complete_summary"].includes(normalized.action)) {
    reading = { ...reading, suggestedQuestions: [] };
  }

  if (reading.responseMode === "reading" && reading.audit && Array.isArray(reading.sections)) {
    const selected = new Set(normalized.reading.cardSlugs);
    const sectionSlugs = [...new Set(reading.sections.flatMap(
      (section) => Array.isArray(section?.cardSlugs) ? section.cardSlugs : [],
    ))].filter((slug) => selected.has(slug));
    if (sectionSlugs.length > 0) {
      reading = {
        ...reading,
        audit: { ...reading.audit, usedCardSlugs: sectionSlugs },
      };
    }
  }
  return reading;
}

function classifyAudit(audit) {
  const reasons = Array.isArray(audit?.reasons) ? [...new Set(audit.reasons)] : [];
  return {
    warnings: reasons.filter((reason) => softAuditReasons.has(reason)),
    repairReasons: reasons.filter((reason) => structuralRepairReasons.has(reason)),
    blockingReasons: reasons.filter(
      (reason) => !softAuditReasons.has(reason) && !structuralRepairReasons.has(reason),
    ),
  };
}

function invalidAuditError(providerResult, reasons) {
  return new Agent911ProviderError("provider_invalid_response", {
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

async function callControlledRepair(normalized, candidate, reasons, metrics) {
  try {
    return await callCandidate(normalized, candidate, reasons, metrics);
  } catch (error) {
    if (error?.recoverableFallback) setProviderCooldown(candidate, error, metrics);
    throw error;
  }
}

async function generateReading(normalized, providerPlan, metrics) {
  let providerResult;
  try {
    providerResult = await callProviderPlan(normalized, providerPlan, metrics);
  } catch (error) {
    if (!error.repairable || metrics.calls >= MAX_PROVIDER_CALLS) throw error;
    metrics.repaired = true;
    providerResult = await callControlledRepair(
      normalized,
      error.candidate,
      ["provider_invalid_response"],
      metrics,
    );
  }

  let reading = normalizeProviderReading(providerResult.reading, normalized);
  let audit = auditAgent911Response(reading, normalized);
  let classification = classifyAudit(audit);

  if (classification.blockingReasons.length > 0) {
    throw invalidAuditError(providerResult, classification.blockingReasons);
  }

  if (classification.repairReasons.length > 0) {
    if (metrics.repaired || metrics.calls >= MAX_PROVIDER_CALLS) {
      throw invalidAuditError(providerResult, classification.repairReasons);
    }
    metrics.repaired = true;
    providerResult = await callControlledRepair(
      normalized,
      providerResult.candidate,
      classification.repairReasons,
      metrics,
    );
    reading = normalizeProviderReading(providerResult.reading, normalized);
    audit = auditAgent911Response(reading, normalized);
    classification = classifyAudit(audit);
  }

  if (classification.blockingReasons.length > 0 || classification.repairReasons.length > 0) {
    throw invalidAuditError(providerResult, [...classification.blockingReasons, ...classification.repairReasons]);
  }

  return { providerResult, reading };
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
  console.info("agent911_usage", {
    provider: metrics.lastProvider,
    model: metrics.lastModel,
    spread: metrics.spread,
    action: metrics.action,
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
  console.error("agent911_request_failed", {
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

async function executeAgent911(normalized, providerPlan) {
  const metrics = createMetrics(normalized);
  console.info("agent911_request_started", {
    requestId: metrics.requestId,
    spread: metrics.spread,
    action: metrics.action,
  });

  try {
    const { providerResult, reading } = await generateReading(normalized, providerPlan, metrics);
    const questionsRemaining = normalized.action === "follow_up"
      ? Math.max(0, AGENT911_MAX_FOLLOW_UPS - normalized.questionsUsed - 1)
      : AGENT911_MAX_FOLLOW_UPS;
    const payload = {
      conversationId: normalized.requestId || `a911-${Date.now()}`,
      answer: reading.synthesis,
      reading,
      followUps: reading.suggestedQuestions,
      questionsRemaining,
      meta: {
        schemaVersion: AGENT911_SCHEMA_VERSION,
        grounded: true,
        provider: providerResult.candidate.id,
        model: providerResult.candidate.model,
        usedFallbackModel: providerResult.candidate.role === "model_fallback",
      },
    };

    metrics.lastProvider = providerResult.candidate.id;
    metrics.lastModel = providerResult.candidate.model;
    logUsage(metrics);
    console.info("agent911_request_completed", {
      requestId: metrics.requestId,
      provider: metrics.lastProvider,
      model: metrics.lastModel,
      spread: metrics.spread,
      action: metrics.action,
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

function normalizePaidAccess(body, normalized) {
  if (normalized.action === "opening_summary") return null;
  const payment = body?.payment;
  const sessionId = String(payment?.sessionId ?? "").trim();
  const productId = String(payment?.productId ?? "").trim();
  const readingId = String(payment?.readingId ?? "").trim();
  const questionNumber = Number(payment?.questionNumber) || 0;
  const catalog = createProductCatalog(process.env);
  if (!/^mp-\d{5,30}$/u.test(sessionId)) {
    throw new PaymentLedgerError("payment_required", 402);
  }

  if (normalized.action === "complete_summary"
      && productId === catalog.completeReading.id
      && readingId === normalized.reading.createdAt
      && questionNumber === 0) {
    return {
      sessionId,
      productId,
      readingId,
      questionNumber,
      accessMode: "bundle",
      claimScope: "complete_summary",
      claimSlot: 0,
    };
  }

  const includedQuestion = normalized.action === "specific_summary"
    && productId === catalog.completeReading.id
    && Boolean(normalized.reading.parentReadingId)
    && readingId === normalized.reading.parentReadingId
    && questionNumber >= 1
    && questionNumber <= catalog.completeReading.includedSpecificQuestions;
  if (includedQuestion) {
    return {
      sessionId,
      productId,
      readingId,
      questionNumber,
      accessMode: "bundle",
      claimScope: "specific_summary",
      claimSlot: questionNumber,
    };
  }

  const singleUseProduct = normalized.action === "specific_summary"
    ? [catalog.specificQuestionComplete.id, catalog.specificQuestionStandalone.id].includes(productId)
    : normalized.action === "follow_up" && productId === catalog.agentQuestion.id;
  const expectedQuestionNumber = normalized.action === "follow_up" ? normalized.questionsUsed + 1 : 0;
  if (!singleUseProduct || readingId !== normalized.reading.createdAt || questionNumber !== expectedQuestionNumber) {
    throw new PaymentLedgerError("payment_required", 402);
  }
  return { sessionId, productId, readingId, questionNumber, accessMode: "single" };
}

function requestFingerprint(normalized, ip, paidAccess = null) {
  const source = JSON.stringify({
    ip,
    paymentSessionId: paidAccess?.sessionId ?? "",
    paymentClaimScope: paidAccess?.claimScope ?? "",
    paymentClaimSlot: paidAccess?.claimSlot ?? 0,
    action: normalized.action,
    readingMode: normalized.readingMode,
    questionsUsed: normalized.questionsUsed,
    message: normalized.message,
    history: normalized.history,
    memoryConsent: normalized.memoryConsent,
    memory: normalized.memory,
    reading: {
      id: normalized.reading.id,
      createdAt: normalized.reading.createdAt,
      intentId: normalized.reading.intentId,
      question: normalized.reading.question,
      cardSlugs: normalized.reading.cardSlugs,
    },
  });
  return createHash("sha256").update(source).digest("hex");
}

async function executePaidAgent911(normalized, providerPlan, paidAccess, fingerprint) {
  const claim = {
    ...paidAccess,
    claimId: createHash("sha256")
      .update(`${paidAccess.sessionId}:${fingerprint}`)
      .digest("hex"),
  };
  const claimAccess = paidAccess.accessMode === "bundle"
    ? claimBundlePaymentEntitlement
    : claimPaymentEntitlement;
  const settleAccess = paidAccess.accessMode === "bundle"
    ? settleBundlePaymentEntitlement
    : settlePaymentEntitlement;
  await claimAccess(claim);
  try {
    const payload = await executeAgent911(normalized, providerPlan);
    await settleAccess(claim, "consumed");
    return payload;
  } catch (error) {
    try {
      await settleAccess(claim, "released");
    } catch (releaseError) {
      console.error("payment_entitlement_release_failed", {
        action: normalized.action,
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
  while (responseStore.size > 500) {
    responseStore.delete(responseStore.keys().next().value);
  }
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

export function resetAgent911RuntimeStateForTests() {
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
  if (!originIsAllowed(request)) {
    return sendJson(response, 403, { error: "origin_not_allowed" });
  }

  let body;
  let normalized;
  let paidAccess;
  try {
    body = parseBody(request);
    normalized = validateAgent911Request(body);
    paidAccess = normalizePaidAccess(body, normalized);
  } catch (error) {
    if (error instanceof PaymentLedgerError) {
      return sendJson(response, error.status, { error: error.code });
    }
    if (error instanceof Agent911ValidationError) {
      const code = error.code === "question_limit" ? "question_limit" : "invalid_payload";
      console.warn("agent911_request_failed", {
        requestId: "invalid",
        type: code,
        status: 400,
        calls: 0,
      });
      return sendJson(response, 400, { error: code });
    }
    console.warn("agent911_request_failed", {
      requestId: "invalid",
      type: "invalid_payload",
      status: 400,
      calls: 0,
    });
    return sendJson(response, 400, { error: "invalid_payload" });
  }

  const ip = requestIp(request);
  const fingerprint = requestFingerprint(normalized, ip, paidAccess);
  const now = Date.now();
  cleanTransientStores(now);

  const cached = responseStore.get(fingerprint);
  if (cached && cached.expiresAt > now) {
    console.info("agent911_request_completed", {
      requestId: normalized.requestId || fingerprint.slice(0, 16),
      spread: spreadLabel(normalized),
      action: normalized.action,
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
    console.warn("agent911_request_failed", {
      requestId: String(normalized.requestId || fingerprint.slice(0, 16)).replace(/\s+/gu, " ").slice(0, 100),
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
    console.error("agent911_request_failed", {
      requestId: String(normalized.requestId || fingerprint.slice(0, 16)).replace(/\s+/gu, " ").slice(0, 100),
      type: "provider_unavailable",
      status: 503,
      providerCode: "provider_not_configured",
      calls: 0,
    });
    return sendJson(response, 503, { error: "provider_unavailable" }, currentRateHeaders);
  }

  const operation = paidAccess
    ? executePaidAgent911(normalized, providerPlan, paidAccess, fingerprint)
    : executeAgent911(normalized, providerPlan);
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
