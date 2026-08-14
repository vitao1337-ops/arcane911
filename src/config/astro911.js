const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

const isDevelopment = viteEnv.DEV === true;
const devRealAiEnabled = isDevelopment
  && String(viteEnv.ARCANE911_DEV_REAL_AI ?? "false").trim().toLowerCase() === "true";
const mode = isDevelopment && !devRealAiEnabled ? "mock" : "live";

export const astro911Config = Object.freeze({
  id: "astro-911",
  enabled: String(viteEnv.VITE_ASTRO911_ENABLED ?? "true").toLowerCase() !== "false",
  mode,
  remoteEnabled: mode === "live",
  devMockEnabled: mode === "mock",
  endpoint: String(viteEnv.VITE_ASTRO911_ENDPOINT ?? "/api/astro-911").trim(),
  contextSchemaVersion: "2026-08-13.2",
  timeoutMs: 58_000,
});
