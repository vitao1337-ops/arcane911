import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDevelopmentServer = command === "serve" && !isPreview;
  const devRealAi = String(env.ARCANE911_DEV_REAL_AI ?? "false").trim().toLowerCase() === "true";
  const devUnlockPaid = String(env.ARCANE911_DEV_UNLOCK_PAID ?? "true").trim().toLowerCase() !== "false";
  const agentTarget = String(env.ARCANE911_DEV_API_TARGET ?? "").trim();
  let proxy = undefined;

  if (isDevelopmentServer && devRealAi) {
    if (!agentTarget) {
      throw new Error("ARCANE911_DEV_REAL_AI=true exige ARCANE911_DEV_API_TARGET explícito.");
    }
    const targetUrl = new URL(agentTarget);
    const localTarget = ["localhost", "127.0.0.1"].includes(targetUrl.hostname);
    if (targetUrl.protocol !== "https:" && !(localTarget && targetUrl.protocol === "http:")) {
      throw new Error("ARCANE911_DEV_API_TARGET precisa usar HTTPS ou HTTP local.");
    }
    proxy = {
      "/api": {
        target: targetUrl.origin,
        changeOrigin: true,
        secure: targetUrl.protocol === "https:",
        configure(proxyServer) {
          proxyServer.on("proxyReq", (proxyRequest) => {
            proxyRequest.setHeader("Origin", targetUrl.origin);
          });
        },
      },
    };
    console.info(`[Arcane911 DEV] IA real habilitada explicitamente em ${targetUrl.origin}.`);
  } else if (isDevelopmentServer) {
    console.info("[Arcane911 DEV] usando mocks do Tarot e Documento Astral — nenhuma chamada paga foi realizada.");
  }
  if (isDevelopmentServer && devUnlockPaid) {
    console.info("[Arcane911 DEV] tiragem completa e perguntas pagas liberadas somente neste ambiente.");
  }

  return {
    plugins: [react()],
    // Expõe ao cliente somente o booleano de opt-in; o target continua privado no Vite.
    envPrefix: ["VITE_", "ARCANE911_DEV_REAL_AI", "ARCANE911_DEV_UNLOCK_PAID"],
    build: {
      // O motor astral é um chunk tardio: só é baixado ao abrir /mapa-astral.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/circular-natal-horoscope-js/")) return "astro-chart-engine";
            if (id.includes("/astronomy-engine/")) return "astro-precision-engine";
            return undefined;
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      // Sem opt-in não existe proxy: localhost nunca consome produção silenciosamente.
      proxy,
    },
  };
});
