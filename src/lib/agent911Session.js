const SUMMARY_PREFIX = "arcane911.agent-summary.v5:";
const PROFILE_KEY = "arcane911.consultation-profile.v1";
const CONSULTATION_PREFIX = "arcane911.consultation.v1:";
const pendingSummaries = new Map();

function safeSession() {
  return typeof window === "object" ? window.sessionStorage : null;
}

export function summaryCacheKey(createdAt, variant, cards) {
  const slugs = Array.isArray(cards) ? cards.map((card) => card?.slug).filter(Boolean).join(".") : "";
  return `${createdAt ?? "reading"}:${variant}:${slugs}`;
}

export function loadAgent911Summary(key) {
  try {
    const payload = JSON.parse(safeSession()?.getItem(`${SUMMARY_PREFIX}${key}`) ?? "null");
    return payload?.reading?.synthesis ? payload : null;
  } catch {
    return null;
  }
}

export function saveAgent911Summary(key, result) {
  try {
    safeSession()?.setItem(`${SUMMARY_PREFIX}${key}`, JSON.stringify(result));
  } catch {
    // A síntese continua na tela mesmo sem armazenamento de sessão.
  }
}

export function getPendingAgent911Summary(key) {
  return pendingSummaries.get(key) ?? null;
}

export function setPendingAgent911Summary(key, promise) {
  pendingSummaries.set(key, promise);
  promise.then(
    () => pendingSummaries.delete(key),
    () => pendingSummaries.delete(key),
  );
  return promise;
}

export function loadConsultationProfile() {
  try {
    const profile = JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "null");
    return profile?.fullName && profile?.email ? profile : null;
  } catch {
    return null;
  }
}

export function saveConsultationProfile(profile) {
  const normalized = {
    fullName: String(profile?.fullName ?? "").trim().slice(0, 120),
    email: String(profile?.email ?? "").trim().toLowerCase().slice(0, 180),
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  } catch {
    // O cadastro continua válido na sessão atual quando o navegador bloqueia armazenamento.
  }
  return normalized;
}

export function validateConsultationProfile(profile) {
  const fullName = String(profile?.fullName ?? "").trim().replace(/\s+/g, " ");
  const email = String(profile?.email ?? "").trim().toLowerCase();
  const errors = {};
  if (fullName.split(" ").filter((part) => part.length > 1).length < 2) {
    errors.fullName = "Digite seu nome completo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    errors.email = "Digite um e-mail válido.";
  }
  return { ok: Object.keys(errors).length === 0, errors, value: { fullName, email } };
}

export function loadConsultationState(readingId) {
  try {
    const state = JSON.parse(safeSession()?.getItem(`${CONSULTATION_PREFIX}${readingId}`) ?? "null");
    return {
      responses: Array.isArray(state?.responses)
        ? state.responses.filter((result) => result?.reading?.synthesis && result?.reading?.groundedAction).slice(0, 3)
        : [],
      history: Array.isArray(state?.history)
        ? state.history.filter((entry) => ["user", "assistant"].includes(entry?.role) && typeof entry?.content === "string").slice(-8)
        : [],
    };
  } catch {
    return { responses: [], history: [] };
  }
}

export function saveConsultationState(readingId, state) {
  try {
    safeSession()?.setItem(`${CONSULTATION_PREFIX}${readingId}`, JSON.stringify({
      responses: Array.isArray(state?.responses) ? state.responses.slice(0, 3) : [],
      history: Array.isArray(state?.history) ? state.history.slice(-8) : [],
    }));
  } catch {
    // A conversa atual continua disponível mesmo quando a sessão não pode ser gravada.
  }
}
