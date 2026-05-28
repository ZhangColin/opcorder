---
name: Budget field protection
description: How and why budget fields are protected from accidental overwrite in demands.
---

## Root cause (resolved)
Every server restart used to reset `budget_max` to `budget` (= `budgetMin`), destroying the range:
- Migration 002 `DROP COLUMN IF EXISTS budget_min/budget_max` — deleted all data each boot
- Migration 009a `ADD COLUMN IF NOT EXISTS … DEFAULT 0` then backfilled with `SET budget_max = budget`
- At demand creation: legacy `budget = budgetMin` (NOT budgetMax)
- Result: `budget_max` reset from e.g. 10000 → 1000 on every restart

## Fix applied
1. **Migration 002** converted to a no-op comment — no longer drops the columns
2. **Migration 009a** removed entirely (ADD COLUMN + harmful backfill gone)
3. **Migration 028a** added at the end — only `ADD COLUMN IF NOT EXISTS` (no backfill ever)

## PUT /demands/:demandId status guard
Budget fields (`budget`, `budgetMin`, `budgetMax`) may only be changed when demand status is `draft` or `pending_review`. Any other status returns HTTP 400. Implemented via a preflight SELECT in the PUT handler.

## Frontend budget field lock
In `PublisherCreateDemand.tsx` edit mode: if `existingDemand.status` is not `draft`/`pending_review`, both budget inputs render as `readOnly` with grey styling and an explanatory hint.

## Why budget ≠ budgetMax at creation
In `demands.ts` POST handler:
```js
const budgetLegacy = body.budget ?? budgetMin;  // falls back to budgetMin, not budgetMax
```
So `budget` = `budgetMin`. If you ever add a new backfill that copies from `budget`, it will collapse the range to the minimum. Never backfill budget_max from budget.
