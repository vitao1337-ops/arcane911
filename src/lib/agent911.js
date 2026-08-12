import { agent911Config } from "../config/agent911.js";
import { completePositions, positions } from "../data/tarot.js";

export class Agent911Error extends Error {
  constructor(message, code, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "Agent911Error";
    this.code = code;
  }
}

function cleanText(value, maximumLength = 1_200) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `a911-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
}) {
  if (!Array.isArray(cards) || ![3, 7].includes(cards.length)) {
    throw new Agent911Error("A leitura precisa conter três ou sete cartas.", "invalid_tarot_context");
  }

  const readingPositions = cards.length === 7 ? completePositions : positions;
  const uniqueSlugs = new Set(cards.map((card) => card?.slug));

  if (uniqueSlugs.size !== cards.length || uniqueSlugs.has(undefined)) {
    throw new Agent911Error("As cartas do contexto precisam ser únicas e válidas.", "invalid_tarot_cards");
  }

  return {
    schemaVersion: agent911Config.contextSchemaVersion,
    experience: cards.length === 7 ? "tarot.horseshoe.v1" : "tarot.opening.v1",
    reading: {
      id: cleanText(createdAt, 80),
      createdAt: cleanText(createdAt, 80),
      intentId: cleanText(intentId, 40),
      intentLabel: cleanText(intentLabel, 80),
      question: cleanText(question, 800),
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

export function createAstrologyAgentContext(chart) {
  if (!chart || chart.planets?.length !== 10 || chart.houses?.length !== 12) {
    throw new Agent911Error("Mapa astral incompleto para o Agente 911.", "invalid_astrology_context");
  }

  return {
    schemaVersion: agent911Config.contextSchemaVersion,
    experience: "astrology.natal.v1",
    chart: {
      person: cleanText(chart.person, 80),
      birth: { ...chart.birth },
      location: {
        name: cleanText(chart.location?.name, 100),
        country: cleanText(chart.location?.country, 80),
        timezone: cleanText(chart.location?.timezone, 80),
      },
      bigThree: chart.bigThree.map((point) => ({
        key: point.key,
        title: point.title,
        degreeLabel: point.degreeLabel,
        text: point.text,
      })),
      planets: chart.planets.map((planet) => ({
        key: planet.key,
        name: planet.name,
        sign: planet.sign.name,
        degreeLabel: planet.degreeLabel,
        house: planet.house,
        retrograde: planet.retrograde,
        interpretation: planet.interpretation,
      })),
      houses: chart.houses.map((house) => ({
        number: house.number,
        sign: house.sign.name,
        theme: house.theme,
        planets: [...house.planets],
      })),
      aspects: chart.aspects.map((aspect) => ({
        name: aspect.name,
        point1: aspect.point1Name,
        point2: aspect.point2Name,
        orb: aspect.orb,
        interpretation: aspect.interpretation,
      })),
      synthesis: chart.synthesis,
      method: chart.method,
    },
    guardrails: {
      symbolicLanguage: true,
      noDeterministicClaims: true,
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

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? agent911Config.timeoutMs;
  const forwardAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const response = await fetchImplementation(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: agent911Config.id,
        requestId: createRequestId(),
        schemaVersion: agent911Config.contextSchemaVersion,
        action: options.action ?? "initial_reading",
        message: cleanText(options.message, 1_200),
        history: Array.isArray(options.history) ? options.history.slice(-8) : [],
        memoryConsent: options.memoryConsent === true,
        memory: options.memoryConsent === true ? options.memory ?? {} : {},
        questionsUsed: Number.isInteger(options.questionsUsed) ? options.questionsUsed : 0,
        context,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const responseCode = cleanText(payload?.error, 80) || `http_${response.status}`;
      const friendlyMessages = {
        agent_not_configured: "O Agente 911 ainda precisa da chave segura no servidor.",
        provider_auth: "A conexão segura do Agente 911 precisa ser revisada.",
        provider_timeout: "A leitura levou mais tempo do que o esperado. Tente novamente.",
        provider_quota: "O modo conectado atingiu o limite disponível por agora.",
        provider_request: "A configuração do modo conectado precisa ser revisada.",
        provider_model: "O modelo configurado para o 911 não está disponível nesta conta.",
        rate_limit: "Muitas leituras foram pedidas em sequência. Respire um pouco e tente novamente.",
        question_limit: "O ciclo de três aprofundamentos desta leitura foi concluído.",
        reading_not_grounded: "A auditoria do 911 recusou uma leitura imprecisa. Peça novamente.",
      };
      throw new Agent911Error(friendlyMessages[responseCode] ?? "O Agente 911 não conseguiu responder agora.", responseCode);
    }

    if (typeof payload?.answer !== "string" || !payload.answer.trim()
        || !payload.reading || !Array.isArray(payload.reading.sections)) {
      throw new Agent911Error("Resposta inválida recebida do Agente 911.", "invalid_response");
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
      throw new Agent911Error("A conexão com o Agente 911 foi interrompida.", "request_aborted", error);
    }
    throw new Agent911Error("Falha ao conectar com o Agente 911.", "network_error", error);
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
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
