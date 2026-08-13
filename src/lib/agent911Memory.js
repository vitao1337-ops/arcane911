// Infraestrutura reservada para memória server-side/conta consentida; não remover como legado.
const MEMORY_KEY = "arcane911.agent911.memory.v1";
const CONSENT_KEY = "arcane911.agent911.consent.v1";
const CONVERSATION_PREFIX = "arcane911.agent911.conversation.v1:";

const emptyMemory = Object.freeze({
  version: 1,
  summary: "",
  themes: [],
  people: [],
  recentReadings: [],
  updatedAt: "",
});

function storageAvailable(storage) {
  return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";
}

function cleanText(value, maximumLength) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function uniqueTexts(values, maximumItems, maximumLength) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => cleanText(value, maximumLength))
    .filter((value) => {
      const key = value.toLocaleLowerCase("pt-BR");
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maximumItems);
}

export function hasAgent911MemoryConsent(storage = globalThis.localStorage) {
  try {
    return storageAvailable(storage) && storage.getItem(CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAgent911MemoryConsent(consent, storage = globalThis.localStorage) {
  try {
    if (!storageAvailable(storage)) return false;
    storage.setItem(CONSENT_KEY, consent ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}

export function loadAgent911Memory(storage = globalThis.localStorage) {
  try {
    if (!storageAvailable(storage)) return { ...emptyMemory };
    const parsed = JSON.parse(storage.getItem(MEMORY_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return { ...emptyMemory };

    return {
      version: 1,
      summary: cleanText(parsed.summary, 1_400),
      themes: uniqueTexts(parsed.themes, 8, 80),
      people: uniqueTexts(parsed.people, 8, 100),
      recentReadings: Array.isArray(parsed.recentReadings)
        ? parsed.recentReadings.slice(0, 6).map((reading) => ({
          date: cleanText(reading?.date, 40),
          intent: cleanText(reading?.intent, 60),
          question: cleanText(reading?.question, 300),
          cards: uniqueTexts(reading?.cards, 7, 50),
          insight: cleanText(reading?.insight, 360),
        }))
        : [],
      updatedAt: cleanText(parsed.updatedAt, 40),
    };
  } catch {
    return { ...emptyMemory };
  }
}

export function applyAgent911MemoryUpdate(update, reading, storage = globalThis.localStorage) {
  if (!hasAgent911MemoryConsent(storage) || !update || typeof update !== "object") return null;

  const current = loadAgent911Memory(storage);
  const summary = cleanText(update.summary, 1_400) || current.summary;
  const nextReading = reading ? {
    date: cleanText(reading.createdAt, 40),
    intent: cleanText(reading.intentLabel, 60),
    question: cleanText(reading.question, 300),
    cards: uniqueTexts(reading.cards, 7, 50),
    insight: cleanText(reading.insight, 360),
  } : null;
  const recentReadings = nextReading
    ? [nextReading, ...current.recentReadings.filter((item) => (
      item.date !== nextReading.date || item.question !== nextReading.question
    ))].slice(0, 6)
    : current.recentReadings;

  const next = {
    version: 1,
    summary,
    themes: uniqueTexts([...(update.themes ?? []), ...current.themes], 8, 80),
    people: uniqueTexts([...(update.people ?? []), ...current.people], 8, 100),
    recentReadings,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!storageAvailable(storage)) return null;
    storage.setItem(MEMORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function forgetAgent911Memory(storage = globalThis.localStorage) {
  try {
    if (!storageAvailable(storage)) return false;
    storage.removeItem(MEMORY_KEY);
    storage.setItem(CONSENT_KEY, "false");
    return true;
  } catch {
    return false;
  }
}

export function hasRememberedAgent911Context(storage = globalThis.localStorage) {
  const memory = loadAgent911Memory(storage);
  return Boolean(memory.summary || memory.themes.length || memory.people.length || memory.recentReadings.length);
}

export function loadAgent911Conversation(readingId, storage = globalThis.sessionStorage) {
  try {
    if (!readingId || !storageAvailable(storage)) return [];
    const parsed = JSON.parse(storage.getItem(CONVERSATION_PREFIX + readingId) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.slice(-8).map((entry) => ({
        role: entry?.role === "assistant" ? "assistant" : "user",
        content: cleanText(entry?.content, 1_800),
      })).filter((entry) => entry.content)
      : [];
  } catch {
    return [];
  }
}

export function saveAgent911Conversation(readingId, conversation, storage = globalThis.sessionStorage) {
  try {
    if (!readingId || !storageAvailable(storage)) return false;
    const safeConversation = (Array.isArray(conversation) ? conversation : [])
      .slice(-8)
      .map((entry) => ({
        role: entry?.role === "assistant" ? "assistant" : "user",
        content: cleanText(entry?.content, 1_800),
      }))
      .filter((entry) => entry.content);
    storage.setItem(CONVERSATION_PREFIX + readingId, JSON.stringify(safeConversation));
    return true;
  } catch {
    return false;
  }
}
