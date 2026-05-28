---
name: Migration run-once tracking
description: How the schema_migrations table and once() helper work; what to do when adding new migrations.
---

## How it works
- `schema_migrations(id TEXT PK, ran_at TIMESTAMP)` created at startup if absent.
- `once(id, critical, fn)` checks table before running; marks done on success; warns on failure.
- On first deploy with this system: if table is empty AND `demands` table exists → pre-seeds all 78 historical IDs → nothing re-runs.
- Fresh installs (demands table absent): no pre-seed → all migrations run normally in order.

## Adding a new migration
1. Pick next ID (e.g. "029a")
2. Add `await once("029a", critical, async () => { ... })` at the bottom of `runMigrations()`
3. Never edit or remove an existing `once()` block — add a new one instead
4. Do NOT add the new ID to the `historicalIds` pre-seed array — that list is only for migrations that existed before the tracking system was introduced.

## critical flag
- `true` → warn + re-throw in production if fn() throws (fail fast before accepting traffic)
- `false` → warn only; migration retried on next boot until it succeeds

## Why
The old "run everything on every boot" design caused budget_max to be reset to budgetMin on every restart (migration 002 dropped columns, 009a re-added them with a bad backfill). The run-once system prevents any migration from executing more than once.
