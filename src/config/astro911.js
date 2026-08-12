const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

export const astro911Config = Object.freeze({
  id: "astro-911",
  enabled: String(viteEnv.VITE_ASTRO911_ENABLED ?? "true").toLowerCase() !== "false",
  endpoint: String(viteEnv.VITE_ASTRO911_ENDPOINT ?? "/api/astro-911").trim(),
  contextSchemaVersion: "2026-08-12.1",
  timeoutMs: 55_000,
});
