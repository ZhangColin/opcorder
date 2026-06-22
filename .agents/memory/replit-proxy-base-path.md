---
name: Replit proxy base path for jiedanba artifact
description: History of base path change and why it was reverted back to "/"
---

## Current state (correct)
`vite.config.ts` uses `const basePath = process.env.BASE_PATH ?? "/"` — defaults to `/`.
Vite proxy is the simple form: `proxy: { "/api": { target: "http://localhost:3000" } }`.
The `Start application` workflow does NOT set `BASE_PATH`.

## History
A previous session changed the default to `/jiedanba/` to fix a white-screen issue in the
Replit dev preview iframe. This was a mistake — the user confirmed the app worked at `/`
before that change and does not want the sub-path. The change was reverted.

## API calls
All files use `import.meta.env.BASE_URL.replace(/\/$/, "")` as the API prefix.
With `base="/"`, `BASE_URL="/"`, prefix becomes `""`, so requests are `/api/...` ✓

## SiteLogo
`SiteLogo.tsx` uses `resolveAssetUrl()` which prepends `BASE_URL` to `/api/` paths.
With `base="/"`: `"".replace(/\/$/, "") + "/api/..."` = `"/api/..."` ✓ (still works)

## Do NOT
- Set `BASE_PATH=/jiedanba/` in any workflow
- Hardcode `basePath = "/jiedanba/"` in vite.config.ts
