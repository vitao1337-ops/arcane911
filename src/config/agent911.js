const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const isDevelopment = viteEnv.DEV === true;
const devRealAiEnabled = isDevelopment
  && String(viteEnv.ARCANE911_DEV_REAL_AI ?? "false").trim().toLowerCase() === "true";
const mode = isDevelopment && !devRealAiEnabled ? "mock" : "live";

export const agent911Config = Object.freeze({
  id: "agent-911",
  enabled: String(viteEnv.VITE_AGENT911_ENABLED ?? "true").toLowerCase() !== "false",
  mode,
  remoteEnabled: mode === "live",
  devMockEnabled: mode === "mock",
  endpoint: String(viteEnv.VITE_AGENT911_ENDPOINT ?? "/api/agent-911").trim(),
  contextSchemaVersion: "2026-08-12.6",
  timeoutMs: 58_000,
  offer: Object.freeze({
    isVisible: false,
    isCheckoutEnabled: false,
    productId: String(viteEnv.VITE_AGENT911_PRODUCT_ID ?? "agent911-tres-perguntas").trim(),
    questionLimit: parsePositiveInteger(viteEnv.VITE_AGENT911_QUESTION_LIMIT, 3),
    draftPrice: String(viteEnv.VITE_AGENT911_DRAFT_PRICE ?? "R$ 10,00").trim(),
    checkoutUrl: String(viteEnv.VITE_AGENT911_CHECKOUT_URL ?? "").trim(),
  }),
});
