export const DEFAULT_AGENT911_READING_MODE = "acolhedora";

export const agent911ReadingModes = Object.freeze([
  Object.freeze({
    id: "acolhedora",
    label: "Acolhedora",
    description: "Profunda, firme e cuidadosa.",
  }),
  Object.freeze({
    id: "direta",
    label: "Direta",
    description: "Resposta clara e conselho aplicável.",
  }),
  Object.freeze({
    id: "sem_rodeios",
    label: "Sem rodeios",
    description: "SIM, NÃO ou INCONCLUSIVA quando couber.",
  }),
]);

const modesById = Object.freeze(Object.fromEntries(
  agent911ReadingModes.map((mode) => [mode.id, mode]),
));

export function normalizeAgent911ReadingMode(value) {
  const modeId = String(value ?? "").trim().toLowerCase();
  return modesById[modeId]?.id ?? DEFAULT_AGENT911_READING_MODE;
}

export function getAgent911ReadingMode(value) {
  return modesById[normalizeAgent911ReadingMode(value)];
}
