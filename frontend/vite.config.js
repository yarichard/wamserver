import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/user": {
        target: "http://0.0.0.0:3000",
        changeOrigin: true
      },
      "/message": {
        target: "http://0.0.0.0:3000",
        changeOrigin: true
      },
      "/parameters": {
        target: "http://0.0.0.0:3000",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://0.0.0.0:3000",
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "../static",
    emptyOutDir: true,
    sourcemap: true,
    minify: false
  }
});
