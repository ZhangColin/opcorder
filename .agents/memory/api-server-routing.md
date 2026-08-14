---
name: API server routing — which instance to restart
description: Replit external proxy routes /jiedanba/api/* directly to the artifact API server (port 8080), bypassing the vite proxy. Always restart the artifact instance after backend changes.
---

## Rule
After changing any backend code in `artifacts/api-server/src/`, restart **both** API workflows: `artifacts/api-server: API Server` (port 8080, external traffic) **and** the legacy `API Server` (port 3000) — the jiedanba vite dev proxy (`/api` → localhost:3000) serves the workspace preview from the legacy instance, so new routes 404 in preview until it restarts.

**Why:** Replit's external proxy routes `/jiedanba/api/*` requests directly to the artifact API server at port 8080. The vite proxy config (`target: process.env.API_PROXY_TARGET ?? "http://localhost:3000"`) is bypassed entirely for external traffic. The legacy `API Server` at port 3000 only receives internal curl/test calls.

**How to apply:**
- Confirmed by log analysis: all authenticated user API requests (`GET /api/contests/my/:id → 200`) appear only in `artifacts/api-server: API Server` logs (port 8080).
- The legacy `API Server` (port 3000) logs only show health checks and unauthenticated test calls.
- When restarting, `artifacts/api-server: API Server` rebuilds the esbuild bundle (~0.7s) then starts. The ~2.3s rebuild window seen in `API Server` logs is from the legacy instance, which is NOT serving real traffic.
