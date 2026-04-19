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

  // Migration 001d2: add partial unique index enforcing one pending payment per demand
  // Separate step so it runs on existing tables as well as freshly created ones.
  // If violating rows exist, warn and continue; in production fail-fast.
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS demand_payments_one_pending_per_demand
        ON demand_payments(demand_id) WHERE (status = 'pending')
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 001d2: could not create pending uniqueness index (constraint may already be violated — deduplicate pending rows first)");
    if (!isDev) throw new Error(`Migration 001d2 failed in production: ${err}`);
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

  // Migration 003a: add 'refunded' value to demand_payment_status enum (CRITICAL)
  // Required for the payment API refund flow
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_payment_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'rejected';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 003a: could not add refunded enum value");
    if (!isDev) throw new Error(`Migration 003a failed in production: ${err}`);
  }

  // Migration 003b: add payment_order_no column for tracking online payment orders
  try {
    await db.execute(sql`
      ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS payment_order_no varchar(100)
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 003b: could not add payment_order_no column");
    if (!isDev) throw new Error(`Migration 003b failed in production: ${err}`);
  }

  // Migration 003c: add refund tracking columns
  try {
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_order_no varchar(100)`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refunded_at timestamp`);
  } catch (err) {
    logger.warn({ err }, "Migration 003c: could not add refund tracking columns");
    if (!isDev) throw new Error(`Migration 003c failed in production: ${err}`);
  }

  // Migration 003d: add refund status values to demand_status enum (CRITICAL)
  // Required for the refund flow on the demands table
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'refund_pending' AFTER 'completed';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'refunding' AFTER 'refund_pending';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'refunding';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 003d: could not add refund status values to demand_status");
    if (!isDev) throw new Error(`Migration 003d failed in production: ${err}`);
  }

  // Migration 003e: add refund_pending and refunding to demand_payment_status enum (CRITICAL)
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_payment_status ADD VALUE IF NOT EXISTS 'refund_pending' AFTER 'rejected';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_payment_status ADD VALUE IF NOT EXISTS 'refunding' AFTER 'refund_pending';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 003e: could not add refund_pending/refunding to demand_payment_status");
    if (!isDev) throw new Error(`Migration 003e failed in production: ${err}`);
  }

  // Migration 003f: add refund detail columns to demand_payments table (CRITICAL)
  try {
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_reason text`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_requested_at timestamp`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_reject_reason text`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_receipt_url text`);
  } catch (err) {
    logger.warn({ err }, "Migration 003f: could not add refund detail columns to demand_payments");
    if (!isDev) throw new Error(`Migration 003f failed in production: ${err}`);
  }

  // Migration 004a: add 'withdrawn' value to bid_status enum (CRITICAL)
  // Required for OPC to withdraw their own pending bids
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE bid_status ADD VALUE IF NOT EXISTS 'withdrawn' AFTER 'rejected';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 004a: could not add withdrawn enum value to bid_status");
    if (!isDev) throw new Error(`Migration 004a failed in production: ${err}`);
  }

  // Migration 004b: create admin_roles table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id serial PRIMARY KEY,
        name varchar(100) NOT NULL,
        description text,
        permissions text[] NOT NULL DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 004b: could not create admin_roles table");
    if (!isDev) throw new Error(`Migration 004b failed in production: ${err}`);
  }

  // Migration 004c: create admin_role_assignments junction table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_role_assignments (
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id integer NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 004c: could not create admin_role_assignments table");
    if (!isDev) throw new Error(`Migration 004c failed in production: ${err}`);
  }

  // Migration 004d: add is_super_admin column to users (CRITICAL)
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false`);
  } catch (err) {
    logger.warn({ err }, "Migration 004d: could not add is_super_admin column to users");
    if (!isDev) throw new Error(`Migration 004d failed in production: ${err}`);
  }

  // Migration 004e: bootstrap existing admin accounts as super admins (non-critical)
  // Only promote admins that have NO role assignments — users with roles are intentional
  // RBAC-managed admins (e.g. 大屏管理员) and must NOT be elevated.
  try {
    await db.execute(sql`
      UPDATE users SET is_super_admin = true
      WHERE role = 'admin'
        AND is_super_admin = false
        AND id NOT IN (SELECT DISTINCT user_id FROM admin_role_assignments)
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 004e: could not bootstrap super admins");
  }

  // Migration 005a: add refund_pending and refunded to payment_status enum (CRITICAL)
  // Required for course enrollment refund flow
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending' AFTER 'paid';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'refund_pending';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 005a: could not add refund values to payment_status enum");
    if (!isDev) throw new Error(`Migration 005a failed in production: ${err}`);
  }

  // Migration 005b: add refund tracking columns to enrollments table (CRITICAL)
  try {
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_reason text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_requested_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_order_no varchar(100)`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refunded_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_reject_reason text`);
  } catch (err) {
    logger.warn({ err }, "Migration 005b: could not add refund columns to enrollments");
    if (!isDev) throw new Error(`Migration 005b failed in production: ${err}`);
  }

  // Migration 006a: create activities table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activities (
        id serial PRIMARY KEY,
        title varchar(200) NOT NULL,
        description text,
        location varchar(200),
        start_time timestamp,
        end_time timestamp,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 006a: could not create activities table");
    if (!isDev) throw new Error(`Migration 006a failed in production: ${err}`);
  }

  // Migration 006b: create activity_fields table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activity_fields (
        id serial PRIMARY KEY,
        activity_id integer NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        label varchar(100) NOT NULL,
        field_type varchar(20) NOT NULL DEFAULT 'text',
        is_required boolean NOT NULL DEFAULT false,
        options jsonb DEFAULT '[]',
        sort_order integer NOT NULL DEFAULT 0
      )
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 006b: could not create activity_fields table");
    if (!isDev) throw new Error(`Migration 006b failed in production: ${err}`);
  }

  // Migration 006c: create registrations table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id serial PRIMARY KEY,
        activity_id integer NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        name varchar(100) NOT NULL,
        phone varchar(20),
        email varchar(200),
        organization varchar(200),
        extra_data jsonb DEFAULT '{}',
        admin_note text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS registrations_activity_id_idx ON registrations(activity_id)`);
  } catch (err) {
    logger.warn({ err }, "Migration 006c: could not create registrations table");
    if (!isDev) throw new Error(`Migration 006c failed in production: ${err}`);
  }

  // Migration 006d: create registration_tags table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS registration_tags (
        id serial PRIMARY KEY,
        registration_id integer NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        tag varchar(50) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS registration_tags_reg_id_idx ON registration_tags(registration_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS registration_tags_tag_idx ON registration_tags(tag)`);
  } catch (err) {
    logger.warn({ err }, "Migration 006d: could not create registration_tags table");
    if (!isDev) throw new Error(`Migration 006d failed in production: ${err}`);
  }

  // Migration 006e: replace is_active boolean with status varchar on activities
  // 'draft'=草稿, 'active'=进行中, 'ended'=已结束
  // NOTE: syncSchema() may already have applied the schema (adding status, dropping is_active)
  // before this migration runs. The UPDATE is therefore wrapped in a DO block that checks
  // whether is_active still exists before attempting to read it.
  try {
    await db.execute(sql`
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft'
    `);
    // Conditionally backfill: only if is_active column still exists (syncSchema may have already dropped it)
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'activities' AND column_name = 'is_active'
        ) THEN
          UPDATE activities SET status = 'active' WHERE is_active = true AND status = 'draft';
        END IF;
      END $$
    `);
    await db.execute(sql`ALTER TABLE activities DROP COLUMN IF EXISTS is_active`);
  } catch (err) {
    logger.warn({ err }, "Migration 006e: could not migrate activities status column");
    if (!isDev) throw new Error(`Migration 006e failed in production: ${err}`);
  }

  // Migration 007a: add 'order_completed' value to notification_type enum (CRITICAL)
  // Required for order completion notifications sent to both parties
  try {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_completed' AFTER 'system';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 007a: could not add order_completed to notification_type enum");
    if (!isDev) throw new Error(`Migration 007a failed in production: ${err}`);
  }

  // Migration 008a: create agent_configs table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id serial PRIMARY KEY,
        name varchar(100) NOT NULL,
        scene_key varchar(50) NOT NULL UNIQUE,
        system_prompt text NOT NULL,
        is_enabled boolean NOT NULL DEFAULT true,
        model varchar(100) NOT NULL DEFAULT 'deepseek-chat',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 008a: could not create agent_configs table");
    if (!isDev) throw new Error(`Migration 008a failed in production: ${err}`);
  }

  // Migration 008b: create agent_conversations table (CRITICAL)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_conversations (
        id serial PRIMARY KEY,
        demand_id integer REFERENCES demands(id) ON DELETE SET NULL,
        session_key varchar(100),
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        messages jsonb NOT NULL DEFAULT '[]',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS agent_conversations_demand_id_idx ON agent_conversations(demand_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS agent_conversations_user_id_idx ON agent_conversations(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS agent_conversations_session_key_idx ON agent_conversations(session_key)
    `);
  } catch (err) {
    logger.warn({ err }, "Migration 008b: could not create agent_conversations table");
    if (!isDev) throw new Error(`Migration 008b failed in production: ${err}`);
  }

  logger.info("Startup data migrations complete.");
}
