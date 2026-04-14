import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Deterministic startup data migrations.
 * Each migration is idempotent (safe to run on every boot).
 * Migrations run in order before seed data initialization.
 * Add new migrations at the bottom — never remove existing ones.
 */
export async function runMigrations(): Promise<void> {
  logger.info("Running startup data migrations...");

  // Migration 001a: add demands.budget column and relax legacy budget_min/budget_max constraints
  // (consolidated from budgetMin/budgetMax to a single budget field)
  try {
    await db.execute(sql`
      ALTER TABLE demands ADD COLUMN IF NOT EXISTS budget integer NOT NULL DEFAULT 0
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001a: could not add budget column");
  }

  // Migration 001a2: set DEFAULT 0 on legacy budget_min/budget_max so inserts that
  // omit these columns (new code path) do not violate NOT NULL constraints
  try {
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_min SET DEFAULT 0`);
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_max SET DEFAULT 0`);
  } catch (err) {
    // Safe to ignore — columns may already have defaults or may not exist on fresh DBs
    logger.warn({ err }, "Migration 001a2: could not set defaults on legacy budget columns");
  }

  // Migration 001b: add pending_payment to demand status enum if missing
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'pending_payment' AFTER 'pending_review';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001b: could not add pending_payment enum value");
  }

  // Migration 001c: create payment method/status enums if not exist
  // These match the Drizzle pgEnum definitions in demand-payments.ts
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
  }

  // Migration 001d: create demand_payments table if not exists
  // Column types match the Drizzle schema in lib/db/src/schema/demand-payments.ts
  // amount: real (Drizzle real), method/status: pgEnum types
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
  }

  // Migration 001e: backfill demands.budget from budget_max for any rows still at 0
  try {
    const result = await db.execute(
      sql`UPDATE demands SET budget = budget_max WHERE (budget IS NULL OR budget = 0) AND budget_max > 0`
    );
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Migration 001e: backfilled budget from budget_max");
    }
  } catch (err) {
    logger.warn({ err }, "Migration 001e: budget backfill skipped");
  }

  logger.info("Startup data migrations complete.");
}
