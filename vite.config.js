import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

function resolveProxyTarget(env) {
  const candidates = [env.VITE_API_PROXY_TARGET, env.VITE_API_BASE_URL, process.env.VITE_API_PROXY_TARGET, process.env.VITE_API_BASE_URL];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "http://localhost:8080";
}

function createProxyConfig(target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    ws: false,
    configure(proxy) {
      proxy.on("error", (error, _req, _res) => {
        console.error("API proxy error:", error.message);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = resolveProxyTarget(env);

  return {
    plugins: [react()],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
      proxy: {
        "/api": createProxyConfig(proxyTarget),
        "/auth": createProxyConfig(proxyTarget),
      },
    },
  };
});
