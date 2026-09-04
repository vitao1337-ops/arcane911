import { normalizeAstralQuestionnaire } from "../config/astralQuestionnaire.js";

const ASTRAL_ORDER_DRAFT_KEY = "arcane911.astral-order-draft.v1";

function cleanText(value, maximum = 150) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function safeSession() {
  try {
    return typeof window === "object" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function saveAstralOrderDraft(draft) {
  const email = cleanText(draft?.email, 150).toLowerCase();
  if (!/^\S+@\S+\.\S+$/u.test(email)) return null;
  let questionnaire;
  try { questionnaire = normalizeAstralQuestionnaire(draft?.questionnaire, { requireAnswers: true }); }
  catch { return null; }
  const normalized = { email, questionnaire, savedAt: new Date().toISOString() };
  try {
    safeSession()?.setItem(ASTRAL_ORDER_DRAFT_KEY, JSON.stringify(normalized));
  } catch {
    // A compra continua; o cadastro da síntese poderá ser retomado depois.
  }
  return normalized;
}

export function loadAstralOrderDraft() {
  try {
    const value = JSON.parse(safeSession()?.getItem(ASTRAL_ORDER_DRAFT_KEY) ?? "null");
    const age = Date.now() - new Date(value?.savedAt ?? 0).getTime();
    if (!/^\S+@\S+\.\S+$/u.test(String(value?.email ?? "")) || age < 0 || age > 24 * 60 * 60 * 1_000) {
      safeSession()?.removeItem(ASTRAL_ORDER_DRAFT_KEY);
      return null;
    }
    return { ...value, questionnaire: normalizeAstralQuestionnaire(value.questionnaire) };
  } catch {
    return null;
  }
}

export function clearAstralOrderDraft() {
  try {
    safeSession()?.removeItem(ASTRAL_ORDER_DRAFT_KEY);
  } catch {
    // Sem impacto no acesso já pago.
  }
}

async function request(body, fetchImplementation = globalThis.fetch) {
  if (typeof fetchImplementation !== "function") throw new Error("astral_order_unavailable");
  const response = await fetchImplementation("/api/astral-order", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload?.error ?? "astral_order_unavailable"));
    error.code = String(payload?.error ?? "astral_order_unavailable");
    throw error;
  }
  return payload;
}

function accessPayload(entitlement) {
  return {
    sessionId: cleanText(entitlement?.sessionId, 240),
    orderId: cleanText(entitlement?.orderId, 120),
    readingId: cleanText(entitlement?.readingId, 120),
  };
}

export async function registerAstralOrder(entitlement, chart, email, options = {}) {
  const access = accessPayload(entitlement);
  return request({
    action: "register",
    ...access,
    fullName: cleanText(chart?.person, 80),
    email: cleanText(email, 150).toLowerCase(),
    questionnaire: normalizeAstralQuestionnaire(options.questionnaire),
    birth: {
      date: cleanText(chart?.birth?.date, 10),
      time: cleanText(chart?.birth?.time, 8),
    },
    location: {
      name: cleanText(chart?.location?.name, 120),
      admin1: cleanText(chart?.location?.admin1, 120),
      country: cleanText(chart?.location?.country, 120),
      timezone: cleanText(chart?.location?.timezone, 80),
      latitude: Number(chart?.location?.latitude),
      longitude: Number(chart?.location?.longitude),
    },
  }, options.fetchImplementation);
}

export async function fetchAstralOrderStatus(entitlement, options = {}) {
  return request({ action: "status", ...accessPayload(entitlement) }, options.fetchImplementation);
}

export async function fetchAstralPdfDownload(entitlement, options = {}) {
  return request({ action: "download", ...accessPayload(entitlement) }, options.fetchImplementation);
}
