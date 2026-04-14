import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const isDev = process.env["NODE_ENV"] !== "production";

/**
 * Deterministic startup data migrations.
 * Each migration is idempotent (safe to run on every boot).
 * Migrations run in order before seed data initialization.
 * Add new migrations at the bottom — never remove existing ones.
 *
 * Error policy:
 *   - Non-critical (backward-compat only): warn and continue in all environments
 *   - Critical (enum/table creation that feature paths depend on):
 *       dev  → warn and continue (allows iteration without crashing)
 *       prod → re-throw to fail fast before traffic is accepted
 */
export async function runMigrations(): Promise<void> {
  logger.info("Running startup data migrations...");

  // Migration 001a: add demands.budget column (CRITICAL)
  // All demand read/write paths now reference this column; fail fast if it cannot be added
  try {
    await db.execute(sql`
      ALTER TABLE demands ADD COLUMN IF NOT EXISTS budget real NOT NULL DEFAULT 0
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001a: could not add budget column");
    if (!isDev) throw new Error(`Migration 001a failed in production: ${err}`);
  }

  // Migration 001a2: set DEFAULT 0 on legacy budget_min/budget_max (transition guard
  // so they don't fail NOT NULL if somehow still referenced before 002 runs)
  try {
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_min SET DEFAULT 0`);
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_max SET DEFAULT 0`);
  } catch (err) {
    // Columns may already have defaults or may not exist — safe to ignore
    logger.warn({ err }, "Migration 001a2: could not set defaults on legacy budget columns");
  }

  // Migration 001b: add pending_payment to demand status enum (CRITICAL)
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'pending_payment' AFTER 'pending_review';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001b: could not add pending_payment enum value");
    if (!isDev) throw new Error(`Migration 001b failed in production: ${err}`);
  }

  // Migration 001c: create payment method/status enums (CRITICAL)
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE demand_payment_method AS ENUM ('online', 'offline');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE demand_payment_status AS ENUM ('pending', 'confirmed', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001c: could not create payment enum types");
    if (!isDev) throw new Error(`Migration 001c failed in production: ${err}`);
  }

  // Migration 001d: create demand_payments table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS demand_payments (
        id serial PRIMARY KEY,
        demand_id integer NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
        amount real NOT NULL DEFAULT 0,
        method demand_payment_method NOT NULL DEFAULT 'offline',
        status demand_payment_status NOT NULL DEFAULT 'pending',
        receipt_url text,
        payment_note text,
        reject_reason text,
        confirmed_by integer REFERENCES users(id),
        confirmed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS demand_payments_demand_id_idx ON demand_payments(demand_id)
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001d: could not create demand_payments table");
    if (!isDev) throw new Error(`Migration 001d failed in production: ${err}`);
  }

  // Migration 001e: backfill demands.budget from budget_max for any rows still at 0
  // Runs before 002 (column drop) to ensure data is preserved
  try {
    const result = await db.execute(
      sql`UPDATE demands SET budget = budget_max WHERE (budget IS NULL OR budget = 0) AND budget_max > 0`
    );
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Migration 001e: backfilled budget from budget_max");
    }
  } catch (err) {
    // budget_max may already be gone (002 ran) — safe to ignore
    logger.warn({ err }, "Migration 001e: budget backfill skipped (columns may already be dropped)");
  }

  // Migration 002: drop legacy budget_min / budget_max columns
  // Runs after 001e backfill so no data is lost. Drizzle schema no longer
  // references these columns; dropping them aligns the physical DB with the schema.
  // Uses IF EXISTS so this is safe to re-run on subsequent boots.
  try {
    await db.execute(sql`ALTER TABLE demands DROP COLUMN IF EXISTS budget_min`);
    await db.execute(sql`ALTER TABLE demands DROP COLUMN IF EXISTS budget_max`);
    logger.info("Migration 002: dropped legacy budget_min and budget_max columns");
  } catch (err) {
    logger.warn({ err }, "Migration 002: could not drop legacy budget columns");
    if (!isDev) throw new Error(`Migration 002 failed in production: ${err}`);
  }

  logger.info("Startup data migrations complete.");
}
