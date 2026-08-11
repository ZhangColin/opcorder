---
name: Orphan processes hold ports after env restart
description: White screen / EADDRINUSE debugging in this monorepo — stale node/vite orphans keep 3000/8080/24926 busy so restarted workflows fail or the proxy hits a zombie instance.
---

Rule: when workflows fail with EADDRINUSE, or the preview is white while everything "looks running", check for orphan `node dist/index.mjs` and `vite` processes (`ps aux | grep -E 'dist/index|vite'`; no fuser/ss in this container) and `kill -9` them before restarting workflows.

**Why:** After an environment resume, old workflow processes can survive as orphans. Symptoms seen 2026-08-11: both API workflows crash-looped on EADDRINUSE (3000/8080), and a zombie vite kept the managed port 24926 — the new vite moved to 24927 while the external proxy still targeted 24926, producing a persistent white screen even though curl of assets returned 200.

**How to apply:** kill orphans → restart the managed workflows → confirm vite logs show it bound the ORIGINAL managed port (not "Port X is in use, trying another one"). Also: externalUrl screenshots of the proxied vite dev server may render white even when a real browser works — verify with the testing subagent before deeper debugging.
