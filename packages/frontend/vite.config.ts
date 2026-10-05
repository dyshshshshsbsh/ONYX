import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_BACKEND_PORT } from "@lacc/shared";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ["react-markdown", "remark-gfm", "rehype-highlight", "highlight.js"],
          vendor: ["react", "react-dom", "react-router-dom", "zustand"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${DEFAULT_BACKEND_PORT}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${DEFAULT_BACKEND_PORT}`,
        ws: true,
      },
    },
  },
});
