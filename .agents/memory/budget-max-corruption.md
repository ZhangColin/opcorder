---
name: budget_max corruption root cause
description: Why budget_max was being reset on every restart and what the fix was.
---

## Root cause
- Migration 002 originally dropped budget_min/budget_max columns on every boot.
- Migration 009a re-added them and backfilled budget_max from the legacy `budget` field.
- BUT: `budget` = budgetMin (the minimum budget), NOT budgetMax.
- Result: every server restart reset budget_max to the budgetMin value.

## Fix applied
- Migration 002 made a no-op (columns are now permanent).
- Migration 009a removed entirely.
- Migration 028a added: ADD COLUMN IF NOT EXISTS only, NO backfill.
- Run-once tracking system prevents any migration from re-running.

## Rule
**NEVER backfill budget_max from the `budget` field.** The legacy `budget` column maps to budgetMin.
