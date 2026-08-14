import { commerceConfig } from "./commerce.js";

const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const isDevelopment = viteEnv.DEV === true;
const devRealAiEnabled = isDevelopment
  && String(viteEnv.ARCANE911_DEV_REAL_AI ?? "false").trim().toLowerCase() === "true";
const mode = isDevelopment && !devRealAiEnabled ? "mock" : "live";
const questionProduct = commerceConfig.products.agentQuestion;

export const agent911Config = Object.freeze({
  id: "agent-911",
  enabled: String(viteEnv.VITE_AGENT911_ENABLED ?? "true").toLowerCase() !== "false",
  mode,
  remoteEnabled: mode === "live",
  devMockEnabled: mode === "mock",
  endpoint: String(viteEnv.VITE_AGENT911_ENDPOINT ?? "/api/agent-911").trim(),
  contextSchemaVersion: "2026-08-13.1",
  timeoutMs: 58_000,
  offer: Object.freeze({
    isVisible: true,
    devUnlocked: commerceConfig.devUnlocked,
    productId: questionProduct.id,
    questionLimit: parsePositiveInteger(viteEnv.VITE_AGENT911_QUESTION_LIMIT, 3),
    price: questionProduct.price,
    priceCents: questionProduct.priceCents,
  }),
});
