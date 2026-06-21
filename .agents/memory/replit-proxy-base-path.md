---
name: Replit proxy base path for jiedanba artifact
description: Why vite base must be hardcoded to /jiedanba/ and how routing/API work together.
---

## Rule
`vite.config.ts` must hardcode `const basePath = "/jiedanba/";` — do NOT use `process.env.BASE_PATH ?? "/"` or any other default that resolves to `"/"`.

## Why
The Replit external proxy (user's browser) only routes `/jiedanba/*` requests to the artifact's vite port. With `base="/"`, asset paths are `/@vite/client`, `/src/main.tsx` etc. — these lack the `/jiedanba/` prefix so the proxy does NOT route them to the artifact → 404 → white screen.

With `base="/jiedanba/"`, asset paths are `/jiedanba/@vite/client` etc. → proxy routes them ✓.

## How it works end-to-end
- `import.meta.env.BASE_URL = "/jiedanba/"` (from vite base)
- `API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "")` = `"/jiedanba"`
- `WouterRouter base="/jiedanba"` → navigate('/admin/v2/x') produces `/jiedanba/admin/v2/x` ✓
- API calls: `fetch("/jiedanba/api/v2/...")` → vite proxy rule `"/jiedanba/api"` → rewrites to `/api/...` → port 3000 ✓
- `artifacts/jiedanba: web` artifact workflow command has NO BASE_PATH — picks up the hardcoded default from vite.config.ts ✓

## Proxy note
The internal proxy at localhost:80 rewrites HTML responses (strips `/jiedanba/` from embedded paths), but does NOT strip from request paths. Don't be fooled by seeing `src="/@vite/client"` in curl output — that's the proxy rewriting the response, not vite running with base="/".

## Do NOT
- Set `base = process.env.BASE_PATH ?? "/"` (default "/" breaks asset routing)
- Create `.env` with `VITE_ROUTER_BASE` (unnecessary indirection)
- Use `BASE_PATH=/jiedanba/` env var in `Start application` workflow (vite.config.ts already hardcodes it)
