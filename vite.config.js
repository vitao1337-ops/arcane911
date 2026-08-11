import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const agentTarget = env.ARCANE911_DEV_API_TARGET || "https://arcane911.vercel.app";

  return {
    plugins: [react()],
    build: {
      // O motor astral é um chunk tardio: só é baixado ao abrir /mapa-astral.
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: "0.0.0.0",
      // Em desenvolvimento, a função serverless continua segura na Vercel.
      // Isso elimina o 404 de /api/agent-911 no localhost sem expor OPENAI_API_KEY.
      proxy: {
        "/api": {
          target: agentTarget,
          changeOrigin: true,
          secure: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyRequest) => {
              proxyRequest.setHeader("Origin", agentTarget);
            });
          },
        },
      },
    },
  };
});
