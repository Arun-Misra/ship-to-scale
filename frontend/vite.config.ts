import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // primary '@' alias to project src
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // explicit '@/...' alias (some tools/overlays normalize differently)
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
