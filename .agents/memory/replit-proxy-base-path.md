---
name: Vite base path routing (jiedanba)
description: How the platform routes the jiedanba web artifact and what vite base must be — DO NOT hardcode /jiedanba/ in this environment.
---

Rule: vite base for artifacts/jiedanba must come from the platform-injected env: `process.env.BASE_PATH ?? "/"`. In THIS environment the artifact is routed at the ROOT path (artifact.toml: `paths = ["/"]`, `BASE_PATH = "/"`, localPort 24926; `/api` routes to api-server:8080). Hardcoding "/jiedanba/" breaks the preview (white screen at "/") and would break the production build.

**Why:** In the OLD account's environment the proxy routed only /jiedanba/* to the artifact, so the base had to be "/jiedanba/". After migration (2026-08) the platform config changed to root routing — the old lesson became actively harmful and caused a white-screen regression when reapplied on 2026-08-11.

**How to apply:** trust `artifacts/jiedanba/.replit-artifact/artifact.toml` as the source of truth for routing/BASE_PATH before touching vite base. When debugging white screens, first check that config plus orphan processes (see orphan-port-processes.md), not the base path.
