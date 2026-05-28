---
name: Seed version gate pattern
description: The anti-pattern where a seed version check uses an old version tag, causing data to be overwritten on every restart.
---

## The bug pattern
```typescript
// BAD: code has prompt-version: 3.8 but check looks for 3.7
if (!existingAgent.systemPrompt.includes("prompt-version: 3.7")) {
  // This ALWAYS fires because "3.8" does not contain "3.7"
  await db.update(agentConfigsTable).set({ systemPrompt })...
}
```

## The fix
The version check must match the CURRENT version tag in the code, not the previous one.
```typescript
// GOOD: check matches the version embedded in the prompt string
if (!existingAgent.systemPrompt.includes("prompt-version: 3.8")) {
  // Only fires once: when DB has an older version
}
```

## Rule
When incrementing the prompt version (e.g. 3.7 → 3.8):
1. Update the `<!-- prompt-version: X.Y -->` comment in the prompt string
2. Update the `includes("prompt-version: X.Y")` check to the SAME new version
3. Never forget step 2 — the mismatch causes silent overwrites on every restart

**Why:** The check is meant to be a one-time migration gate (old → new). If the check lags behind the code version, it evaluates true permanently.
