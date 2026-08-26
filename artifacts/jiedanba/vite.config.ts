import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
const isBuild = process.env.NODE_ENV === "production" || process.argv.includes("build");

if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = rawPort ? Number(rawPort) : 3000;

if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH is injected by the platform (artifact.toml services.env).
// In this environment the web artifact is routed at the ROOT path "/",
// so do NOT hardcode "/jiedanba/" here — that breaks the preview.
const basePath = process.env.BASE_PATH ?? "/";
const replitDevHost = process.env.REPLIT_DEV_DOMAIN
  ? new URL(
      process.env.REPLIT_DEV_DOMAIN.includes("://")
        ? process.env.REPLIT_DEV_DOMAIN
        : `https://${process.env.REPLIT_DEV_DOMAIN}`,
    ).hostname
  : undefined;

export default defineConfig({
  base: basePath,
  plugins: [
    react({
      // Admin.tsx is intentionally excluded from Babel/Fast Refresh.
      // It is a very large TSX module; running react-refresh's Babel pass on
      // every edit creates a multi-megabyte dev payload and blocks the browser
      // main thread. Vite's built-in esbuild still compiles it, and changes to
      // this page use a fast full-page reload instead of a slow HMR transform.
      exclude: /\/src\/pages\/Admin\.tsx$/,
    }),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  environments: {
    client: {
      dev: {
        // Compile the entry route and the large admin route immediately after
        // startup instead of making the first browser navigation pay that cost.
        warmup: [
          "src/main.tsx",
          "src/App.tsx",
          "src/pages/Admin.tsx",
        ],
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: replitDevHost
      ? {
          protocol: "wss",
          host: replitDevHost,
          clientPort: 443,
          timeout: 30_000,
        }
      : undefined,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if (res && !res.headersSent) {
              (res as import("http").ServerResponse).writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "API server temporarily unavailable" }));
            }
          });
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
