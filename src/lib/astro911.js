import { astro911Config } from "../config/astro911.js";

const CACHE_KEY = "arcane911.astral-document.v1";
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const pendingDocuments = new Map();

export class Astro911Error extends Error {
  constructor(message, code, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "Astro911Error";
    this.code = code;
  }
}

function cleanText(value, maximumLength = 300) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximumLength);
}

function firstName(value) {
  return cleanText(value, 60).split(/\s+/u)[0] || "Pessoa";
}

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `astro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function assertSecureEndpoint(endpoint) {
  if (!endpoint) throw new Astro911Error("Endpoint do Documento Astral não configurado.", "endpoint_missing");
  const browserOrigin = typeof window === "object" ? window.location.origin : "https://arcane911.local";
  const url = new URL(endpoint, browserOrigin);
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Astro911Error("O endpoint do Documento Astral precisa usar HTTPS.", "endpoint_insecure");
  }
  return endpoint.startsWith("/") ? endpoint : url.toString();
}

function aspectId(aspect) {
  return `aspect:${aspect.point1Key}:${aspect.aspectKey}:${aspect.point2Key}`;
}

export function createAstro911Context(chart) {
  if (!chart || chart.planets?.length !== 10 || chart.houses?.length !== 12) {
    throw new Astro911Error("Mapa incompleto para gerar o documento.", "invalid_chart");
  }
  if (!Array.isArray(chart.aspects) || chart.aspects.length < 3) {
    throw new Astro911Error("Aspectos insuficientes para gerar o documento.", "invalid_chart_aspects");
  }

  return {
    experience: "astrology.natal-document.v1",
    chart: {
      person: firstName(chart.person),
      method: cleanText(chart.method, 100),
      planets: chart.planets.map((planet) => ({
        key: planet.key,
        signKey: planet.sign.key,
        longitude: Number(Number(planet.longitude).toFixed(6)),
        degreeLabel: cleanText(planet.degreeLabel, 20),
        house: planet.house,
        retrograde: planet.retrograde === true,
      })),
      ascendant: {
        key: "ascendant",
        signKey: chart.ascendant.sign.key,
        longitude: Number(Number(chart.ascendant.longitude).toFixed(6)),
        degreeLabel: cleanText(chart.ascendant.degreeLabel, 20),
      },
      midheaven: {
        key: "midheaven",
        signKey: chart.midheaven.sign.key,
        longitude: Number(Number(chart.midheaven.longitude).toFixed(6)),
        degreeLabel: cleanText(chart.midheaven.degreeLabel, 20),
      },
      houses: chart.houses.map((house) => ({
        number: house.number,
        signKey: house.sign.key,
        degreeLabel: cleanText(house.degreeLabel, 20),
        planetKeys: [...house.planets],
      })),
      aspects: chart.aspects.slice(0, 16).map((aspect) => ({
        id: aspectId(aspect),
        point1Key: aspect.point1Key,
        point2Key: aspect.point2Key,
        aspectKey: aspect.aspectKey,
        orb: Number(Number(aspect.orb).toFixed(4)),
      })),
      elementScores: { ...chart.elementScores },
      dominantElement: chart.dominantElement,
    },
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function astro911Fingerprint(chart) {
  const context = createAstro911Context(chart);
  return `astro-v1-${hashString(JSON.stringify(context.chart))}`;
}

function validDocumentPayload(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.document?.title === "string"
      && Array.isArray(value.document?.sections)
      && value.document.sections.length === 5
      && Array.isArray(value.document?.practices)
      && value.document.practices.length === 5
      && value.meta?.grounded === true,
  );
}

export function readCachedAstro911Document(chart) {
  if (typeof window !== "object") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null");
    if (!cached || cached.fingerprint !== astro911Fingerprint(chart)) return null;
    if (Date.now() - new Date(cached.cachedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return validDocumentPayload(cached.payload) ? cached.payload : null;
  } catch {
    return null;
  }
}

export function cacheAstro911Document(chart, payload) {
  if (typeof window !== "object" || !validDocumentPayload(payload)) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      fingerprint: astro911Fingerprint(chart),
      cachedAt: new Date().toISOString(),
      payload,
    }));
  } catch {
    // O documento continua aberto mesmo quando o navegador bloqueia armazenamento local.
  }
}

async function performRequest(chart, options) {
  const enabled = options.enabled ?? astro911Config.enabled;
  if (!enabled) throw new Astro911Error("O Documento Astral com Gemini está desativado.", "astro_disabled");
  const endpoint = assertSecureEndpoint(options.endpoint ?? astro911Config.endpoint);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new Astro911Error("Este ambiente não oferece suporte à conexão.", "fetch_unavailable");
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? astro911Config.timeoutMs;
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
        agent: astro911Config.id,
        requestId: createRequestId(),
        schemaVersion: astro911Config.contextSchemaVersion,
        context: createAstro911Context(chart),
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = cleanText(payload?.error, 80) || `http_${response.status}`;
      const messages = {
        astro_not_configured: "A conexão Gemini do Documento Astral ainda precisa ser configurada no servidor.",
        provider_auth: "A chave segura do Gemini precisa ser revisada.",
        provider_timeout: "O documento levou mais tempo do que o esperado. Tente novamente.",
        provider_quota: "O limite disponível do Gemini foi atingido por agora.",
        provider_request: "A configuração do Gemini precisa ser revisada.",
        provider_model: "O modelo Gemini configurado não está disponível nesta conta.",
        rate_limit: "Muitos documentos foram pedidos em sequência. Aguarde alguns minutos.",
        document_not_grounded: "A auditoria recusou um texto pouco fiel ao mapa. Tente gerar novamente.",
      };
      throw new Astro911Error(messages[code] ?? "O Documento Astral não pôde ser escrito agora.", code);
    }
    if (!validDocumentPayload(payload)) {
      throw new Astro911Error("O Gemini devolveu um documento incompleto.", "invalid_response");
    }
    return payload;
  } catch (error) {
    if (error instanceof Astro911Error) throw error;
    if (controller.signal.aborted) {
      throw new Astro911Error("A conexão com o Documento Astral foi interrompida.", "request_aborted", error);
    }
    throw new Astro911Error("Falha ao conectar com o Documento Astral.", "network_error", error);
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}

export function requestAstro911Document(chart, options = {}) {
  const fingerprint = astro911Fingerprint(chart);
  if (pendingDocuments.has(fingerprint)) return pendingDocuments.get(fingerprint);
  const promise = performRequest(chart, options)
    .then((payload) => {
      cacheAstro911Document(chart, payload);
      return payload;
    })
    .finally(() => pendingDocuments.delete(fingerprint));
  pendingDocuments.set(fingerprint, promise);
  return promise;
}

export function formatAstro911Document(payload, chart) {
  if (!validDocumentPayload(payload)) return "";
  const document = payload.document;
  const sections = document.sections.map((section) => [
    section.title.toUpperCase(),
    section.body,
    `Direção prática: ${section.practicalDirection}`,
  ].join("\n")).join("\n\n");
  const practices = document.practices
    .map((practice, index) => `${index + 1}. ${practice.title}: ${practice.action} (${practice.purpose})`)
    .join("\n");
  const questions = document.reflectionQuestions.map((question) => `• ${question}`).join("\n");
  return [
    "ARCANE911 · DOCUMENTO ASTRAL",
    chart.person,
    document.title,
    document.subtitle,
    document.opening,
    sections,
    "PRÁTICAS DE INTEGRAÇÃO",
    practices,
    "PERGUNTAS PARA VOLTAR",
    questions,
    document.closing,
    `Método: ${chart.method}. Leitura simbólica, não determinista.`,
  ].join("\n\n");
}
