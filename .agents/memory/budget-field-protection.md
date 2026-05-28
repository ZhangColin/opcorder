---
name: Budget field protection
description: How and why budget fields are protected from accidental overwrite in demands.
---

## Rule
`PUT /demands/:demandId` must only allow budget field edits (`budget`, `budgetMin`, `budgetMax`) when the demand status is `draft` or `pending_review`. Any other status returns HTTP 400.

## Why
Exhaustive audit found that this endpoint had **no status check** on budget fields — a published/matched/any-status demand could have its budget silently overwritten by the publisher's edit form. This caused `budget_max` to collapse from a correct range (e.g. 10000) back to `budget` (e.g. 1000) whenever the edit form was submitted on a live demand.

## How to apply
- In `demands.ts` PUT handler: `SELECT status, publisherId` first, check `budgetEditableStatuses = ["draft","pending_review"]`, reject with 400 if budget fields present and status not in list.
- In `PublisherCreateDemand.tsx`: when `isEdit && existingDemand.status` is not draft/pending_review, render budget inputs as `readOnly` with grey styling and an explanatory hint.

## Migration 009a guard
The backfill SQL in migration 009a was strengthened to `WHERE budget_min = 0 AND budget_max = 0 AND budget > 0` (added `budget_max = 0`). This prevents overwriting a correctly-set `budget_max` if `budget_min` was ever reset to 0 by some other path.

## Old production demands
Demands created before the budget-range feature was introduced only stored a single `budget` value. Migration 009a backfills both `budget_min` and `budget_max` to that single value. These demands will show a collapsed range (min = max = budget). This is expected — admins must manually correct the range via a future admin tool if needed.
