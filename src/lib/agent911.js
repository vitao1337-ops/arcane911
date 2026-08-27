import { agent911Config } from "../config/agent911.js";
import { normalizeAgent911ReadingMode } from "../config/agent911ReadingModes.js";
import { completePositions, positions } from "../data/tarot.js";
import { buildSpecificLayout, specificReadingsBySlug } from "../data/products.js";

export class Agent911Error extends Error {
  constructor(message, code, cause, retryAfterMs = 0) {
    super(message, cause ? { cause } : undefined);
    this.name = "Agent911Error";
    this.code = code;
    this.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
  }
}

const pendingAgent911Requests = new Map();
let requestCooldownUntil = 0;
let requestCooldownCode = "";

const publicErrorMessages = Object.freeze({
  invalid_payload: "Esta leitura não pôde ser enviada. Refaça a tiragem e tente novamente.",
  provider_invalid_response: "A leitura chegou incompleta e foi interrompida com segurança. Tente novamente.",
  provider_quota: "O 911 está temporariamente indisponível. Tente novamente em alguns instantes.",
  provider_timeout: "A leitura demorou mais do que o esperado. Tente novamente.",
  provider_unavailable: "O 911 está temporariamente indisponível. Tente novamente em alguns instantes.",
  rate_limit: "Muitas leituras foram pedidas em sequência. Aguarde um instante e tente novamente.",
  question_limit: "O ciclo de três aprofundamentos desta leitura foi concluído.",
  payment_required: "Esta pergunta precisa de um crédito pago válido.",
  payment_credit_unavailable: "Este crédito já foi usado ou não pertence a esta pergunta.",
  payment_ledger_not_configured: "A liberação segura das perguntas ainda não está configurada.",
  payment_ledger_not_ready: "A liberação segura está sendo preparada. Tente novamente em instantes.",
  payment_ledger_unavailable: "Não foi possível validar o crédito agora. Ele não foi consumido; tente novamente.",
  payment_ledger_conflict: "Não foi possível concluir o consumo deste crédito. Tente novamente.",
  unknown: "O 911 não conseguiu concluir esta leitura agora. Tente novamente.",
});

export function agent911ErrorMessage(code) {
  return publicErrorMessages[code] ?? publicErrorMessages.unknown;
}

function cleanText(value, maximumLength = 1_200) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `a911-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function retryAfterMs(response, code) {
  const rawValue = String(response?.headers?.get?.("retry-after") ?? "").trim();
  const seconds = Number(rawValue);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(rawValue);
  if (rawValue && Number.isFinite(date)) return Math.max(0, date - Date.now());
  if (code === "provider_quota") return 30_000;
  if (code === "rate_limit") return 10_000;
  if (["provider_timeout", "provider_unavailable"].includes(code)) return 5_000;
  return 0;
}

function registerRequestCooldown(code, delayMs) {
  if (delayMs <= 0) return;
  requestCooldownUntil = Math.max(requestCooldownUntil, Date.now() + delayMs);
  requestCooldownCode = code;
}

function assertSecureEndpoint(endpoint) {
  if (!endpoint) throw new Agent911Error("Endpoint do Agente 911 não configurado.", "endpoint_missing");

  const browserOrigin = typeof window === "object" ? window.location.origin : "https://arcane911.local";
  const url = new URL(endpoint, browserOrigin);
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);

  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Agent911Error("O endpoint do Agente 911 precisa usar HTTPS.", "endpoint_insecure");
  }

  return endpoint.startsWith("/") ? endpoint : url.toString();
}

export function createTarotAgentContext({
  cards,
  intentId,
  intentLabel,
  question,
  createdAt,
  spreadId = "",
  parentReadingId = "",
}) {
  if (!Array.isArray(cards) || ![3, 5, 7].includes(cards.length)) {
    throw new Agent911Error("A leitura precisa conter três, cinco ou sete cartas.", "invalid_tarot_context");
  }

  const specificReading = cards.length === 5 ? specificReadingsBySlug[spreadId] : null;
  const readingPositions = cards.length === 7
    ? completePositions
    : cards.length === 5 ? buildSpecificLayout(specificReading) : positions;
  if (readingPositions.length !== cards.length) {
    throw new Agent911Error("A estrutura desta leitura específica é inválida.", "invalid_tarot_context");
  }
  const uniqueSlugs = new Set(cards.map((card) => card?.slug));

  if (uniqueSlugs.size !== cards.length || uniqueSlugs.has(undefined)) {
    throw new Agent911Error("As cartas do contexto precisam ser únicas e válidas.", "invalid_tarot_cards");
  }

  return {
    schemaVersion: agent911Config.contextSchemaVersion,
    experience: cards.length === 7
      ? "tarot.horseshoe.v1"
      : cards.length === 5 ? "tarot.specific.v1" : "tarot.opening.v1",
    reading: {
      id: cleanText(createdAt, 80),
      createdAt: cleanText(createdAt, 80),
      intentId: cleanText(intentId, 40),
      intentLabel: cleanText(intentLabel, 80),
      question: cleanText(question, 800),
      spreadId: cards.length === 5 ? cleanText(spreadId, 40) : "",
      parentReadingId: cards.length === 5 ? cleanText(parentReadingId, 120) : "",
      cards: cards.map((card, index) => ({
        order: index + 1,
        slug: card.slug,
        name: card.name,
        archetype: card.archetype,
        keywords: [...card.keywords],
        message: card.message,
        shadow: card.shadow,
        action: card.action,
        position: {
          id: readingPositions[index].id,
          title: readingPositions[index].title,
          eyebrow: readingPositions[index].eyebrow,
          prompt: readingPositions[index].prompt ?? "",
        },
      })),
    },
    guardrails: {
      reflectionNotPrediction: true,
      noProfessionalSubstitution: true,
      preserveUserAgency: true,
      language: "pt-BR",
    },
  };
}

export async function requestAgent911(context, options = {}) {
  const enabled = options.enabled ?? agent911Config.enabled;
  if (!enabled) throw new Agent911Error("O Agente 911 ainda não está ativo.", "agent_disabled");
  const remoteEnabled = options.remoteEnabled ?? agent911Config.remoteEnabled;
  if (!remoteEnabled) {
    throw new Agent911Error("O Agente 911 está usando o motor local.", "remote_disabled");
  }

  const endpoint = assertSecureEndpoint(options.endpoint ?? agent911Config.endpoint);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new Agent911Error("Este ambiente não oferece suporte à conexão.", "fetch_unavailable");
  }

  const remainingCooldownMs = requestCooldownUntil - Date.now();
  if (remainingCooldownMs > 0) {
    throw new Agent911Error(
      agent911ErrorMessage(requestCooldownCode),
      requestCooldownCode || "provider_unavailable",
      undefined,
      remainingCooldownMs,
    );
  }

  const requestPayload = {
    agent: agent911Config.id,
    schemaVersion: agent911Config.contextSchemaVersion,
    action: options.action ?? (context?.reading?.cards?.length === 7
      ? "complete_summary"
      : context?.reading?.cards?.length === 5 ? "specific_summary" : "opening_summary"),
    readingMode: normalizeAgent911ReadingMode(options.readingMode),
    message: cleanText(options.message, 1_200),
    history: Array.isArray(options.history) ? options.history.slice(-8) : [],
    memoryConsent: options.memoryConsent === true,
    memory: options.memoryConsent === true ? options.memory ?? {} : {},
    questionsUsed: Number.isInteger(options.questionsUsed) ? options.questionsUsed : 0,
    payment: options.payment ? {
      sessionId: cleanText(options.payment.sessionId, 240),
      productId: cleanText(options.payment.productId, 80),
      readingId: cleanText(options.payment.readingId, 120),
      questionNumber: Number(options.payment.questionNumber) || 0,
    } : null,
    context,
  };
  const basePendingKey = `${endpoint}:${JSON.stringify(requestPayload)}`;
  const pendingKey = options.signal ? `${basePendingKey}:${createRequestId()}` : basePendingKey;
  const currentRequest = pendingAgent911Requests.get(pendingKey);
  if (currentRequest) return currentRequest;

  const operation = (async () => {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? agent911Config.timeoutMs;
    let timedOut = false;
    const forwardAbort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) forwardAbort();
    options.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort("timeout");
    }, timeoutMs);

    try {
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestPayload, requestId: createRequestId() }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const responseCode = cleanText(payload?.error, 80) || "unknown";
        const delayMs = retryAfterMs(response, responseCode);
        registerRequestCooldown(responseCode, delayMs);
        throw new Agent911Error(
          agent911ErrorMessage(responseCode),
          responseCode,
          undefined,
          delayMs,
        );
      }

      if (typeof payload?.answer !== "string" || !payload.answer.trim()
          || !payload.reading || !Array.isArray(payload.reading.sections)) {
        throw new Agent911Error(agent911ErrorMessage("provider_invalid_response"), "provider_invalid_response");
      }

      return {
        answer: payload.answer.trim(),
        reading: payload.reading,
        followUps: Array.isArray(payload.followUps)
          ? payload.followUps.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 3)
          : [],
        conversationId: cleanText(payload.conversationId, 100),
        questionsRemaining: Number.isInteger(payload.questionsRemaining)
          ? payload.questionsRemaining
          : Math.max(0, agent911Config.offer.questionLimit - (options.questionsUsed ?? 0)),
        meta: {
          provider: ["gemini", "openai"].includes(payload?.meta?.provider)
            ? payload.meta.provider
            : "unknown",
          model: cleanText(payload?.meta?.model, 80),
          usedFallbackModel: payload?.meta?.usedFallbackModel === true,
        },
      };
    } catch (error) {
      if (error instanceof Agent911Error) throw error;
      if (controller.signal.aborted) {
        const code = timedOut ? "provider_timeout" : "request_aborted";
        const delayMs = timedOut ? 5_000 : 0;
        registerRequestCooldown(code, delayMs);
        throw new Agent911Error(
          timedOut ? agent911ErrorMessage(code) : "A conexão com o Agente 911 foi interrompida.",
          code,
          error,
          delayMs,
        );
      }
      throw new Agent911Error(agent911ErrorMessage("provider_unavailable"), "provider_unavailable", error);
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", forwardAbort);
    }
  })();

  pendingAgent911Requests.set(pendingKey, operation);
  operation.then(
    () => pendingAgent911Requests.delete(pendingKey),
    () => pendingAgent911Requests.delete(pendingKey),
  );
  return operation;
}

export function serializeAgent911Reading(reading) {
  if (!reading || typeof reading !== "object") return "";
  return [
    cleanText(reading.title, 140),
    cleanText(reading.opening, 1_200),
    ...(Array.isArray(reading.sections)
      ? reading.sections.map((section) => `${cleanText(section?.title, 120)}: ${cleanText(section?.text, 1_400)}`)
      : []),
    `Síntese: ${cleanText(reading.synthesis, 1_400)}`,
    `Movimento: ${cleanText(reading.groundedAction, 500)}`,
  ].filter(Boolean).join("\n").slice(0, 4_800);
}
