import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // O motor astral é um chunk tardio: só é baixado ao abrir /mapa-astral.
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: "0.0.0.0",
  },
});
