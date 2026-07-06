import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const isDev = process.env["NODE_ENV"] !== "production";

/**
 * Startup data migrations — each migration runs EXACTLY ONCE, tracked in schema_migrations.
 *
 * On first deployment with this tracking system, all historical migration IDs are
 * pre-seeded into schema_migrations so they are not re-run on existing databases.
 *
 * Adding a new migration:
 *   1. Pick the next ID (e.g. "029a")
 *   2. Call `await once("029a", critical, async () => { ... })` at the bottom
 *   3. Never edit or remove an existing once() block — add a new one instead
 *
 * Error policy inside once():
 *   critical = true  → warn + re-throw in production (fail fast before traffic)
 *   critical = false → warn and continue; migration will be retried on next boot
 */
export async function runMigrations(): Promise<void> {
  logger.info("Running startup data migrations...");

  // ── Step 0: Create schema_migrations tracking table ──────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id      TEXT      PRIMARY KEY,
      ran_at  TIMESTAMP NOT NULL DEFAULT now()
    )
  `);

  // ── Step 0b: Pre-seed all historical migration IDs for existing systems ───────
  // If the tracking table is empty AND the demands table already exists, this is an
  // existing deployment. Mark every historical migration as done so they don't re-run.
  {
    const { rows: countRows } = await db.execute(sql`SELECT COUNT(*) AS n FROM schema_migrations`);
    const tracked = Number((countRows[0] as any).n);
    if (tracked === 0) {
      const { rows: demandsRows } = await db.execute(sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'demands' LIMIT 1
      `);
      if (demandsRows.length > 0) {
        const historicalIds = [
          "001a", "001a2", "001b", "001c", "001d", "001d2", "001e", "002",
          "003a", "003b", "003c", "003d", "003e", "003f",
          "004a", "004b", "004c", "004d", "004e",
          "005a", "005b",
          "006a", "006b", "006c", "006d", "006e",
          "007a",
          "008a", "008b", "008c",
          "009a", "009b", "009c", "009d", "009e", "009f", "009f2", "009g", "009h",
          "010a", "010b", "010c", "010d", "010e",
          "011a", "012a", "013a", "014a", "015a",
          "016a", "016b", "017a", "018a",
          "019a", "019b", "019c", "019d", "019e", "019f", "019g", "019h", "019i",
          "020a", "020b", "020c", "020d", "020e", "020f", "020g",
          "021a", "021b", "021d",
          "022a", "023a", "025a", "026a", "027a", "028a",
        ];
        for (const id of historicalIds) {
          await db.execute(sql`INSERT INTO schema_migrations(id) VALUES (${id}) ON CONFLICT DO NOTHING`);
        }
        logger.info({ count: historicalIds.length }, "Seeded historical migration IDs into tracking table (existing system)");
      }
    }
  }

  // ── Run-once helper ───────────────────────────────────────────────────────────
  // Skips if id already in schema_migrations; otherwise runs fn() and marks done.
  // On failure: always logs a warning. If critical=true and in production, re-throws.
  async function once(id: string, critical: boolean, fn: () => Promise<void>): Promise<void> {
    const { rows } = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE id = ${id} LIMIT 1`);
    if (rows.length > 0) return;
    try {
      await fn();
      await db.execute(sql`INSERT INTO schema_migrations(id) VALUES (${id}) ON CONFLICT DO NOTHING`);
    } catch (err) {
      logger.warn({ err }, `Migration ${id} failed`);
      if (critical && !isDev) throw new Error(`Migration ${id} failed in production: ${err}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migrations
  // ─────────────────────────────────────────────────────────────────────────────

  // Migration 001a: add demands.budget column (CRITICAL)
  await once("001a", true, async () => {
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS budget real NOT NULL DEFAULT 0`);
  });

  // Migration 001a2: set DEFAULT 0 on legacy budget_min/budget_max
  await once("001a2", false, async () => {
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_min SET DEFAULT 0`);
    await db.execute(sql`ALTER TABLE demands ALTER COLUMN budget_max SET DEFAULT 0`);
  });

  // Migration 001b: add pending_payment to demand_status enum (CRITICAL)
  await once("001b", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_status ADD VALUE IF NOT EXISTS 'pending_payment' AFTER 'pending_review';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  });

  // Migration 001c: create payment method/status enums (CRITICAL)
  await once("001c", true, async () => {
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
  });

  // Migration 001d: create demand_payments table (CRITICAL)
  await once("001d", true, async () => {
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
  });

  // Migration 001d2: partial unique index — one pending payment per demand (CRITICAL)
  await once("001d2", true, async () => {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS demand_payments_one_pending_per_demand
        ON demand_payments(demand_id) WHERE (status = 'pending')
    `);
  });

  // Migration 001e: backfill demands.budget from budget_max for rows still at 0
  await once("001e", false, async () => {
    const result = await db.execute(
      sql`UPDATE demands SET budget = budget_max WHERE (budget IS NULL OR budget = 0) AND budget_max > 0`
    );
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Migration 001e: backfilled budget from budget_max");
  });

  // Migration 002: no-op — budget_min/budget_max are now permanent columns
  // (Originally dropped these columns; reversed. Block kept to preserve numbering.)
  await once("002", false, async () => {
    // intentional no-op
  });

  // Migration 003a: add 'refunded' to demand_payment_status enum (CRITICAL)
  await once("003a", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE demand_payment_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'rejected';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  });

  // Migration 003b: add payment_order_no to demand_payments (CRITICAL)
  await once("003b", true, async () => {
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS payment_order_no varchar(100)`);
  });

  // Migration 003c: add refund tracking columns to demand_payments (CRITICAL)
  await once("003c", true, async () => {
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_order_no varchar(100)`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refunded_at timestamp`);
  });

  // Migration 003d: add refund status values to demand_status enum (CRITICAL)
  await once("003d", true, async () => {
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
  });

  // Migration 003e: add refund_pending/refunding to demand_payment_status enum (CRITICAL)
  await once("003e", true, async () => {
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
  });

  // Migration 003f: add refund detail columns to demand_payments (CRITICAL)
  await once("003f", true, async () => {
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_reason text`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_requested_at timestamp`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_reject_reason text`);
    await db.execute(sql`ALTER TABLE demand_payments ADD COLUMN IF NOT EXISTS refund_receipt_url text`);
  });

  // Migration 004a: add 'withdrawn' to bid_status enum (CRITICAL)
  await once("004a", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE bid_status ADD VALUE IF NOT EXISTS 'withdrawn' AFTER 'rejected';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  });

  // Migration 004b: create admin_roles table (CRITICAL)
  await once("004b", true, async () => {
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
  });

  // Migration 004c: create admin_role_assignments table (CRITICAL)
  await once("004c", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_role_assignments (
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id integer NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);
  });

  // Migration 004d: add is_super_admin column to users (CRITICAL)
  await once("004d", true, async () => {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false`);
  });

  // Migration 004e: bootstrap existing admin accounts as super admins (non-critical)
  // Only promotes admins with NO role assignments — RBAC-managed admins must NOT be elevated.
  await once("004e", false, async () => {
    await db.execute(sql`
      UPDATE users SET is_super_admin = true
      WHERE role = 'admin'
        AND is_super_admin = false
        AND id NOT IN (SELECT DISTINCT user_id FROM admin_role_assignments)
    `);
  });

  // Migration 005a: add refund_pending/refunded to payment_status enum (CRITICAL)
  await once("005a", true, async () => {
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
  });

  // Migration 005b: add refund tracking columns to enrollments (CRITICAL)
  await once("005b", true, async () => {
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_reason text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_requested_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_order_no varchar(100)`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refunded_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS refund_reject_reason text`);
  });

  // Migration 006a: create activities table (CRITICAL)
  await once("006a", true, async () => {
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
  });

  // Migration 006b: create activity_fields table (CRITICAL)
  await once("006b", true, async () => {
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
  });

  // Migration 006c: create registrations table (CRITICAL)
  await once("006c", true, async () => {
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
  });

  // Migration 006d: create registration_tags table (CRITICAL)
  await once("006d", true, async () => {
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
  });

  // Migration 006e: replace is_active boolean with status varchar on activities (CRITICAL)
  await once("006e", true, async () => {
    await db.execute(sql`
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft'
    `);
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
  });

  // Migration 007a: add 'order_completed' to notification_type enum (CRITICAL)
  await once("007a", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_completed' AFTER 'system';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  });

  // Migration 008a: create agent_configs table (CRITICAL)
  await once("008a", true, async () => {
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
  });

  // Migration 008b: create agent_conversations table (CRITICAL)
  await once("008b", true, async () => {
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
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_conversations_demand_id_idx ON agent_conversations(demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_conversations_user_id_idx ON agent_conversations(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_conversations_session_key_idx ON agent_conversations(session_key)`);
  });

  // Migration 008c: add legal rep ID card columns to settlement_accounts (non-critical)
  await once("008c", false, async () => {
    await db.execute(sql`ALTER TABLE settlement_accounts ADD COLUMN IF NOT EXISTS legal_rep_id_front_url text`);
    await db.execute(sql`ALTER TABLE settlement_accounts ADD COLUMN IF NOT EXISTS legal_rep_id_back_url text`);
  });

  // Migration 009a: removed — ADD COLUMN + backfill that caused budget_max corruption.
  // budget_min/budget_max are now ensured by 028a (ADD COLUMN IF NOT EXISTS, no backfill).
  await once("009a", false, async () => {
    // intentional no-op
  });

  // Migration 009b: add quote_card_data and quoted_price to bids (CRITICAL)
  await once("009b", true, async () => {
    await db.execute(sql`ALTER TABLE bids ADD COLUMN IF NOT EXISTS quote_card_data jsonb NOT NULL DEFAULT '{}'`);
    await db.execute(sql`ALTER TABLE bids ADD COLUMN IF NOT EXISTS quoted_price real`);
    logger.info("Migration 009b: added quote_card_data and quoted_price to bids");
  });

  // Migration 009c: make bids.proposal default to empty string
  await once("009c", false, async () => {
    await db.execute(sql`ALTER TABLE bids ALTER COLUMN proposal SET DEFAULT ''`);
    logger.info("Migration 009c: set default empty string on bids.proposal");
  });

  // Migration 009d: add pending_payment to order_status enum (CRITICAL)
  await once("009d", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'in_progress';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    logger.info("Migration 009d: added pending_payment to order_status enum");
  });

  // Migration 009e: add payment tracking columns to orders (CRITICAL)
  await once("009e", true, async () => {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method varchar(20)`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url text`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_note text`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_order_no varchar(100)`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamp`);
    logger.info("Migration 009e: added payment tracking columns to orders");
  });

  // Migration 009f: create quote_card_configs table (CRITICAL)
  await once("009f", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quote_card_configs (
        id serial PRIMARY KEY,
        dimension_code varchar(10) NOT NULL,
        dimension_label text NOT NULL,
        tier varchar(5) NOT NULL,
        tier_label text NOT NULL,
        base_price real NOT NULL DEFAULT 0,
        coefficient real,
        description text,
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (dimension_code, tier)
      )
    `);
    logger.info("Migration 009f: created quote_card_configs table");
  });

  // Migration 009f2: ensure unique index on quote_card_configs (dimension_code, tier)
  await once("009f2", false, async () => {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS quote_card_configs_dimension_tier_idx
      ON quote_card_configs (dimension_code, tier)
    `);
    logger.info("Migration 009f2: ensured unique index on quote_card_configs");
  });

  // Migration 009g: backfill default quote_card_configs rows if table is empty
  await once("009g", false, async () => {
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM quote_card_configs`);
    const firstRow = existing.rows[0];
    const cnt = firstRow && typeof firstRow === "object" && "cnt" in firstRow ? Number(firstRow.cnt) : 0;
    if (cnt === 0) {
      const defaults = [
        { code: "D1", label: "课程交付规模", tier: "S", tierLabel: "小型（≤50人次）", price: 2000 },
        { code: "D1", label: "课程交付规模", tier: "M", tierLabel: "中型（51–200人次）", price: 5000 },
        { code: "D1", label: "课程交付规模", tier: "L", tierLabel: "大型（201–500人次）", price: 12000 },
        { code: "D1", label: "课程交付规模", tier: "XL", tierLabel: "超大型（500人次+）", price: 25000 },
        { code: "D2", label: "课程内容深度", tier: "S", tierLabel: "基础科普", price: 1000 },
        { code: "D2", label: "课程内容深度", tier: "M", tierLabel: "进阶应用", price: 3000 },
        { code: "D2", label: "课程内容深度", tier: "L", tierLabel: "专业实践", price: 6000 },
        { code: "D2", label: "课程内容深度", tier: "XL", tierLabel: "定制研发", price: 12000 },
        { code: "D3", label: "项目执行周期", tier: "S", tierLabel: "≤1周", price: 500 },
        { code: "D3", label: "项目执行周期", tier: "M", tierLabel: "1–4周", price: 1500 },
        { code: "D3", label: "项目执行周期", tier: "L", tierLabel: "1–3个月", price: 3000 },
        { code: "D3", label: "项目执行周期", tier: "XL", tierLabel: "3个月+", price: 6000 },
        { code: "D4", label: "交付物数量", tier: "S", tierLabel: "1–2项", price: 500 },
        { code: "D4", label: "交付物数量", tier: "M", tierLabel: "3–5项", price: 1200 },
        { code: "D4", label: "交付物数量", tier: "L", tierLabel: "6–10项", price: 2500 },
        { code: "D4", label: "交付物数量", tier: "XL", tierLabel: "10项+", price: 4000 },
        { code: "D5", label: "现场执行要求", tier: "S", tierLabel: "无需现场", price: 0 },
        { code: "D5", label: "现场执行要求", tier: "M", tierLabel: "部分现场", price: 1000 },
        { code: "D5", label: "现场执行要求", tier: "L", tierLabel: "全程现场（本地）", price: 2500 },
        { code: "D5", label: "现场执行要求", tier: "XL", tierLabel: "全程现场（外地）", price: 5000 },
        { code: "C1", label: "OPC资质等级", tier: "S", tierLabel: "C级", price: 0 },
        { code: "C1", label: "OPC资质等级", tier: "M", tierLabel: "B级", price: 2000 },
        { code: "C1", label: "OPC资质等级", tier: "L", tierLabel: "A级", price: 5000 },
        { code: "C1", label: "OPC资质等级", tier: "XL", tierLabel: "特级合作", price: 10000 },
        { code: "C2", label: "行业经验深度", tier: "S", tierLabel: "通用行业", price: 0 },
        { code: "C2", label: "行业经验深度", tier: "M", tierLabel: "细分行业", price: 1500 },
        { code: "C2", label: "行业经验深度", tier: "L", tierLabel: "专业领域", price: 3500 },
        { code: "C2", label: "行业经验深度", tier: "XL", tierLabel: "顶尖专家", price: 8000 },
        { code: "C3", label: "工具与技术能力", tier: "S", tierLabel: "基础工具", price: 0 },
        { code: "C3", label: "工具与技术能力", tier: "M", tierLabel: "进阶工具", price: 1000 },
        { code: "C3", label: "工具与技术能力", tier: "L", tierLabel: "专业套件", price: 2500 },
        { code: "C3", label: "工具与技术能力", tier: "XL", tierLabel: "自研平台", price: 5000 },
        { code: "C4", label: "配套服务支持", tier: "S", tierLabel: "无配套", price: 0 },
        { code: "C4", label: "配套服务支持", tier: "M", tierLabel: "基础配套", price: 800 },
        { code: "C4", label: "配套服务支持", tier: "L", tierLabel: "完整配套", price: 2000 },
        { code: "C4", label: "配套服务支持", tier: "XL", tierLabel: "定制配套", price: 4000 },
      ];
      for (const row of defaults) {
        await db.execute(sql`
          INSERT INTO quote_card_configs (dimension_code, dimension_label, tier, tier_label, base_price)
          VALUES (${row.code}, ${row.label}, ${row.tier}, ${row.tierLabel}, ${row.price})
          ON CONFLICT (dimension_code, tier) DO NOTHING
        `);
      }
      logger.info("Migration 009g: seeded default quote_card_configs rows");
    }
  });

  // Migration 009h: replace C1–C4 rows with coefficient-based 低/中/高 tiers (CRITICAL)
  await once("009h", true, async () => {
    await db.execute(sql`ALTER TABLE quote_card_configs ALTER COLUMN tier TYPE varchar(10)`);
    await db.execute(sql`
      DELETE FROM quote_card_configs
      WHERE dimension_code IN ('C1','C2','C3','C4')
        AND tier IN ('S','M','L','XL')
    `);
    const cDefaults = [
      { code: "C1", label: "需求明确度",     tier: "low",    tierLabel: "完整 PRD",    coeff: 0.90 },
      { code: "C1", label: "需求明确度",     tier: "medium", tierLabel: "文档 + 口头",  coeff: 1.00 },
      { code: "C1", label: "需求明确度",     tier: "high",   tierLabel: "一句话想法",   coeff: 1.15 },
      { code: "C2", label: "合规/数据敏感",  tier: "low",    tierLabel: "常规数据",     coeff: 1.00 },
      { code: "C2", label: "合规/数据敏感",  tier: "medium", tierLabel: "部分敏感",     coeff: 1.10 },
      { code: "C2", label: "合规/数据敏感",  tier: "high",   tierLabel: "强合规",       coeff: 1.25 },
      { code: "C3", label: "第三方依赖稳定", tier: "low",    tierLabel: "文档稳定",     coeff: 1.00 },
      { code: "C3", label: "第三方依赖稳定", tier: "medium", tierLabel: "少量不确定",   coeff: 1.10 },
      { code: "C3", label: "第三方依赖稳定", tier: "high",   tierLabel: "依赖不稳定",   coeff: 1.20 },
      { code: "C4", label: "验收标准清晰",   tier: "low",    tierLabel: "可量化",       coeff: 0.95 },
      { code: "C4", label: "验收标准清晰",   tier: "medium", tierLabel: "部分明确",     coeff: 1.00 },
      { code: "C4", label: "验收标准清晰",   tier: "high",   tierLabel: "标准模糊",     coeff: 1.10 },
    ];
    for (const row of cDefaults) {
      await db.execute(sql`
        INSERT INTO quote_card_configs (dimension_code, dimension_label, tier, tier_label, base_price, coefficient)
        VALUES (${row.code}, ${row.label}, ${row.tier}, ${row.tierLabel}, 0, ${row.coeff})
        ON CONFLICT (dimension_code, tier) DO UPDATE SET
          dimension_label = EXCLUDED.dimension_label,
          tier_label      = EXCLUDED.tier_label,
          base_price      = 0,
          coefficient     = EXCLUDED.coefficient,
          updated_at      = now()
      `);
    }
    logger.info("Migration 009h: replaced C1–C4 with coefficient-based 低/中/高 rows");
  });

  // Migration 010a: create quote_dimensions + quote_tiers tables (CRITICAL)
  await once("010a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quote_dimensions (
        id SERIAL PRIMARY KEY,
        category VARCHAR(20) NOT NULL,
        layer VARCHAR(10) NOT NULL,
        code VARCHAR(20) NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS quote_dims_cat_layer_code_idx
        ON quote_dimensions(category, layer, code)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quote_tiers (
        id SERIAL PRIMARY KEY,
        dimension_id INTEGER NOT NULL REFERENCES quote_dimensions(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL,
        tier_label TEXT NOT NULL,
        base_price REAL NOT NULL DEFAULT 0,
        coefficient REAL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS quote_tiers_dim_tier_idx
        ON quote_tiers(dimension_id, tier)
    `);
    logger.info("Migration 010a: created quote_dimensions + quote_tiers tables");
  });

  // Migration 010b: add quote_card_snapshot column to bids (non-critical)
  await once("010b", false, async () => {
    await db.execute(sql`ALTER TABLE bids ADD COLUMN IF NOT EXISTS quote_card_snapshot JSONB`);
    logger.info("Migration 010b: added quote_card_snapshot to bids");
  });

  // Migration 010c: seed default quote card dimensions + tiers for all 4 categories
  await once("010c", true, async () => {
    type SeedDim = {
      category: string; layer: string; code: string; label: string; sort: number;
      tiers: { tier: string; label: string; price?: number; coeff?: number; sort: number }[];
    };
    const seedDims: SeedDim[] = [
      // ── SOFTWARE base ──
      { category: "software", layer: "base", code: "D1", label: "页面/屏数", sort: 1, tiers: [
        { tier: "S", label: "1–3 屏", price: 2000, sort: 1 },
        { tier: "M", label: "4–10 屏", price: 6000, sort: 2 },
        { tier: "L", label: "11–25 屏", price: 12000, sort: 3 },
        { tier: "XL", label: "25+ 屏", price: 20000, sort: 4 },
      ]},
      { category: "software", layer: "base", code: "D2", label: "数据模型数", sort: 2, tiers: [
        { tier: "S", label: "1–2 个", price: 1000, sort: 1 },
        { tier: "M", label: "3–6 个", price: 5000, sort: 2 },
        { tier: "L", label: "7–15 个", price: 10000, sort: 3 },
        { tier: "XL", label: "15+ 个", price: 18000, sort: 4 },
      ]},
      { category: "software", layer: "base", code: "D3", label: "第三方集成", sort: 3, tiers: [
        { tier: "S", label: "无集成", price: 0, sort: 1 },
        { tier: "M", label: "1–2 个", price: 3000, sort: 2 },
        { tier: "L", label: "3–5 个", price: 8000, sort: 3 },
        { tier: "XL", label: "5+ 个", price: 15000, sort: 4 },
      ]},
      { category: "software", layer: "base", code: "D4", label: "用户角色数", sort: 4, tiers: [
        { tier: "S", label: "1 角色", price: 500, sort: 1 },
        { tier: "M", label: "2–3 角色", price: 3000, sort: 2 },
        { tier: "L", label: "4–6 角色", price: 6000, sort: 3 },
        { tier: "XL", label: "6+ 角色", price: 10000, sort: 4 },
      ]},
      { category: "software", layer: "base", code: "D5", label: "数据/并发量级", sort: 5, tiers: [
        { tier: "S", label: "≤100 QPS", price: 1000, sort: 1 },
        { tier: "M", label: "100–1k", price: 3000, sort: 2 },
        { tier: "L", label: "1k–10k", price: 8000, sort: 3 },
        { tier: "XL", label: "10k+", price: 15000, sort: 4 },
      ]},
      // ── SOFTWARE adjustment ──
      { category: "software", layer: "adjustment", code: "C1", label: "需求明确度", sort: 1, tiers: [
        { tier: "low", label: "完整 PRD", coeff: 0.90, sort: 1 },
        { tier: "medium", label: "文档 + 口头", coeff: 1.00, sort: 2 },
        { tier: "high", label: "一句话想法", coeff: 1.15, sort: 3 },
      ]},
      { category: "software", layer: "adjustment", code: "C2", label: "合规/数据敏感", sort: 2, tiers: [
        { tier: "low", label: "常规数据", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "部分敏感", coeff: 1.10, sort: 2 },
        { tier: "high", label: "强合规要求", coeff: 1.25, sort: 3 },
      ]},
      { category: "software", layer: "adjustment", code: "C3", label: "第三方依赖稳定", sort: 3, tiers: [
        { tier: "low", label: "依赖稳定", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "少量不确定", coeff: 1.10, sort: 2 },
        { tier: "high", label: "依赖不稳定", coeff: 1.20, sort: 3 },
      ]},
      { category: "software", layer: "adjustment", code: "C4", label: "验收标准清晰", sort: 4, tiers: [
        { tier: "low", label: "可量化", coeff: 0.95, sort: 1 },
        { tier: "medium", label: "部分明确", coeff: 1.00, sort: 2 },
        { tier: "high", label: "标准模糊", coeff: 1.10, sort: 3 },
      ]},
      // ── EDUCATION base ──
      { category: "education", layer: "base", code: "E1", label: "课程规模(人次)", sort: 1, tiers: [
        { tier: "S", label: "≤20 人", price: 2000, sort: 1 },
        { tier: "M", label: "21–100 人", price: 5000, sort: 2 },
        { tier: "L", label: "101–300 人", price: 10000, sort: 3 },
        { tier: "XL", label: "300+ 人", price: 20000, sort: 4 },
      ]},
      { category: "education", layer: "base", code: "E2", label: "内容深度", sort: 2, tiers: [
        { tier: "S", label: "基础科普", price: 1000, sort: 1 },
        { tier: "M", label: "进阶应用", price: 3000, sort: 2 },
        { tier: "L", label: "专业实践", price: 6000, sort: 3 },
        { tier: "XL", label: "定制研发", price: 12000, sort: 4 },
      ]},
      { category: "education", layer: "base", code: "E3", label: "交付周期", sort: 3, tiers: [
        { tier: "S", label: "≤1 周", price: 500, sort: 1 },
        { tier: "M", label: "1–4 周", price: 1500, sort: 2 },
        { tier: "L", label: "1–3 月", price: 3000, sort: 3 },
        { tier: "XL", label: "3 月+", price: 6000, sort: 4 },
      ]},
      { category: "education", layer: "base", code: "E4", label: "课件数量", sort: 4, tiers: [
        { tier: "S", label: "1–3 件", price: 500, sort: 1 },
        { tier: "M", label: "4–10 件", price: 1500, sort: 2 },
        { tier: "L", label: "11–20 件", price: 3000, sort: 3 },
        { tier: "XL", label: "20+ 件", price: 5000, sort: 4 },
      ]},
      // ── EDUCATION adjustment ──
      { category: "education", layer: "adjustment", code: "A1", label: "定制化程度", sort: 1, tiers: [
        { tier: "low", label: "通用内容", coeff: 0.90, sort: 1 },
        { tier: "medium", label: "部分定制", coeff: 1.00, sort: 2 },
        { tier: "high", label: "完全定制", coeff: 1.20, sort: 3 },
      ]},
      { category: "education", layer: "adjustment", code: "A2", label: "现场支持要求", sort: 2, tiers: [
        { tier: "low", label: "纯线上", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "混合模式", coeff: 1.10, sort: 2 },
        { tier: "high", label: "全程现场", coeff: 1.25, sort: 3 },
      ]},
      { category: "education", layer: "adjustment", code: "A3", label: "版权归属", sort: 3, tiers: [
        { tier: "low", label: "共享版权", coeff: 0.95, sort: 1 },
        { tier: "medium", label: "部分专属", coeff: 1.00, sort: 2 },
        { tier: "high", label: "完全专属", coeff: 1.15, sort: 3 },
      ]},
      // ── MARKETING base ──
      { category: "marketing", layer: "base", code: "M1", label: "投放渠道数量", sort: 1, tiers: [
        { tier: "S", label: "1 个", price: 1000, sort: 1 },
        { tier: "M", label: "2–3 个", price: 2500, sort: 2 },
        { tier: "L", label: "4–6 个", price: 5000, sort: 3 },
        { tier: "XL", label: "7+ 个", price: 10000, sort: 4 },
      ]},
      { category: "marketing", layer: "base", code: "M2", label: "内容件数", sort: 2, tiers: [
        { tier: "S", label: "1–5 件", price: 1000, sort: 1 },
        { tier: "M", label: "6–20 件", price: 2500, sort: 2 },
        { tier: "L", label: "21–50 件", price: 5000, sort: 3 },
        { tier: "XL", label: "50+ 件", price: 10000, sort: 4 },
      ]},
      { category: "marketing", layer: "base", code: "M3", label: "活动规模", sort: 3, tiers: [
        { tier: "S", label: "小型 (<50 人)", price: 1000, sort: 1 },
        { tier: "M", label: "中型 (50–200)", price: 3000, sort: 2 },
        { tier: "L", label: "大型 (200–1k)", price: 7000, sort: 3 },
        { tier: "XL", label: "超大型 (1k+)", price: 15000, sort: 4 },
      ]},
      // ── MARKETING adjustment ──
      { category: "marketing", layer: "adjustment", code: "R1", label: "时间紧迫度", sort: 1, tiers: [
        { tier: "low", label: "时间充裕", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "较为紧迫", coeff: 1.10, sort: 2 },
        { tier: "high", label: "极度紧急", coeff: 1.30, sort: 3 },
      ]},
      { category: "marketing", layer: "adjustment", code: "R2", label: "数据追踪要求", sort: 2, tiers: [
        { tier: "low", label: "基础统计", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "多维追踪", coeff: 1.10, sort: 2 },
        { tier: "high", label: "全链路归因", coeff: 1.20, sort: 3 },
      ]},
      { category: "marketing", layer: "adjustment", code: "R3", label: "创意复杂度", sort: 3, tiers: [
        { tier: "low", label: "简单执行", coeff: 0.90, sort: 1 },
        { tier: "medium", label: "创意适中", coeff: 1.00, sort: 2 },
        { tier: "high", label: "高度创意", coeff: 1.20, sort: 3 },
      ]},
      // ── CONTENT base ──
      { category: "content", layer: "base", code: "N1", label: "设计件数", sort: 1, tiers: [
        { tier: "S", label: "1–3 件", price: 1000, sort: 1 },
        { tier: "M", label: "4–10 件", price: 2500, sort: 2 },
        { tier: "L", label: "11–20 件", price: 5000, sort: 3 },
        { tier: "XL", label: "20+ 件", price: 10000, sort: 4 },
      ]},
      { category: "content", layer: "base", code: "N2", label: "内容类型", sort: 2, tiers: [
        { tier: "S", label: "图文排版", price: 500, sort: 1 },
        { tier: "M", label: "短视频", price: 2000, sort: 2 },
        { tier: "L", label: "长视频/动画", price: 5000, sort: 3 },
        { tier: "XL", label: "交互/H5", price: 8000, sort: 4 },
      ]},
      { category: "content", layer: "base", code: "N3", label: "交付轮次", sort: 3, tiers: [
        { tier: "S", label: "1 轮", price: 0, sort: 1 },
        { tier: "M", label: "2 轮", price: 500, sort: 2 },
        { tier: "L", label: "3 轮", price: 1500, sort: 3 },
        { tier: "XL", label: "无限轮", price: 3000, sort: 4 },
      ]},
      // ── CONTENT adjustment ──
      { category: "content", layer: "adjustment", code: "Q1", label: "修改次数", sort: 1, tiers: [
        { tier: "low", label: "≤2 次", coeff: 0.90, sort: 1 },
        { tier: "medium", label: "3–5 次", coeff: 1.00, sort: 2 },
        { tier: "high", label: "无限修改", coeff: 1.20, sort: 3 },
      ]},
      { category: "content", layer: "adjustment", code: "Q2", label: "版权要求", sort: 2, tiers: [
        { tier: "low", label: "平台共享", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "商业授权", coeff: 1.10, sort: 2 },
        { tier: "high", label: "独家买断", coeff: 1.25, sort: 3 },
      ]},
      { category: "content", layer: "adjustment", code: "Q3", label: "品牌规范复杂度", sort: 3, tiers: [
        { tier: "low", label: "无规范", coeff: 1.00, sort: 1 },
        { tier: "medium", label: "有规范文档", coeff: 1.05, sort: 2 },
        { tier: "high", label: "严格品牌规范", coeff: 1.15, sort: 3 },
      ]},
    ];
    for (const dim of seedDims) {
      await db.execute(sql`
        INSERT INTO quote_dimensions (category, layer, code, label, sort_order)
        VALUES (${dim.category}, ${dim.layer}, ${dim.code}, ${dim.label}, ${dim.sort})
        ON CONFLICT (category, layer, code) DO NOTHING
      `);
      for (const t of dim.tiers) {
        const price = t.price ?? 0;
        const coeff = t.coeff ?? null;
        await db.execute(sql`
          INSERT INTO quote_tiers (dimension_id, tier, tier_label, base_price, coefficient, sort_order)
          SELECT d.id, ${t.tier}, ${t.label}, ${price}, ${coeff}, ${t.sort}
          FROM quote_dimensions d
          WHERE d.category = ${dim.category} AND d.layer = ${dim.layer} AND d.code = ${dim.code}
          ON CONFLICT (dimension_id, tier) DO NOTHING
        `);
      }
    }
    logger.info("Migration 010c: seeded default quote card dimensions and tiers");
  });

  // Migration 010d: update software prices & coefficients to match design spec (CRITICAL)
  await once("010d", true, async () => {
    const softwarePriceUpdates: Array<{ code: string; tier: string; price: number }> = [
      { code: "D1", tier: "L",  price: 15000 },
      { code: "D1", tier: "XL", price: 35000 },
      { code: "D2", tier: "S",  price: 2000  },
      { code: "D2", tier: "L",  price: 12000 },
      { code: "D2", tier: "XL", price: 28000 },
      { code: "D3", tier: "M",  price: 4000  },
      { code: "D3", tier: "L",  price: 10000 },
      { code: "D3", tier: "XL", price: 22000 },
      { code: "D4", tier: "S",  price: 1000  },
      { code: "D4", tier: "L",  price: 8000  },
      { code: "D4", tier: "XL", price: 18000 },
      { code: "D5", tier: "M",  price: 4000  },
      { code: "D5", tier: "L",  price: 12000 },
      { code: "D5", tier: "XL", price: 30000 },
    ];
    for (const { code, tier, price } of softwarePriceUpdates) {
      await db.execute(sql`
        UPDATE quote_tiers SET base_price = ${price}
        WHERE dimension_id = (
          SELECT id FROM quote_dimensions
          WHERE category = 'software' AND layer = 'base' AND code = ${code}
        ) AND tier = ${tier}
      `);
    }
    const softwareCoeffUpdates: Array<{ code: string; tier: string; coeff: number }> = [
      { code: "C1", tier: "low",    coeff: 0.90 },
      { code: "C1", tier: "medium", coeff: 1.10 },
      { code: "C1", tier: "high",   coeff: 1.40 },
      { code: "C2", tier: "low",    coeff: 1.00 },
      { code: "C2", tier: "medium", coeff: 1.20 },
      { code: "C2", tier: "high",   coeff: 1.50 },
      { code: "C3", tier: "low",    coeff: 1.00 },
      { code: "C3", tier: "medium", coeff: 1.15 },
      { code: "C3", tier: "high",   coeff: 1.35 },
      { code: "C4", tier: "low",    coeff: 0.95 },
      { code: "C4", tier: "medium", coeff: 1.10 },
      { code: "C4", tier: "high",   coeff: 1.30 },
    ];
    for (const { code, tier, coeff } of softwareCoeffUpdates) {
      await db.execute(sql`
        UPDATE quote_tiers SET coefficient = ${coeff}
        WHERE dimension_id = (
          SELECT id FROM quote_dimensions
          WHERE category = 'software' AND layer = 'adjustment' AND code = ${code}
        ) AND tier = ${tier}
      `);
    }
    logger.info("Migration 010d: updated software prices and coefficients");
  });

  // Migration 010e: seed optional layer (MAINT) for all categories (CRITICAL)
  await once("010e", true, async () => {
    const categories = ["software", "education", "marketing", "content"];
    for (const cat of categories) {
      await db.execute(sql`
        INSERT INTO quote_dimensions (category, layer, code, label, sort_order)
        VALUES (${cat}, 'optional', 'MAINT', '维护包', 1)
        ON CONFLICT (category, layer, code) DO NOTHING
      `);
      const maintTiers = [
        { tier: "none", label: "不包含",    coeff: 0,    desc: "",                                        sort: 1 },
        { tier: "M3",   label: "M3 维护包", coeff: 0.15, desc: "3 个月 bug 修复 + 小迭代（≤5 人日）",    sort: 2 },
        { tier: "M6",   label: "M6 维护包", coeff: 0.25, desc: "6 个月（≤12 人日）",                     sort: 3 },
        { tier: "M12",  label: "M12 维护包",coeff: 0.40, desc: "12 个月（≤25 人日 + SLA）",              sort: 4 },
      ];
      for (const t of maintTiers) {
        await db.execute(sql`
          INSERT INTO quote_tiers (dimension_id, tier, tier_label, base_price, coefficient, description, sort_order)
          SELECT d.id, ${t.tier}, ${t.label}, 0, ${t.coeff}, ${t.desc}, ${t.sort}
          FROM quote_dimensions d
          WHERE d.category = ${cat} AND d.layer = 'optional' AND d.code = 'MAINT'
          ON CONFLICT (dimension_id, tier) DO NOTHING
        `);
      }
    }
    logger.info("Migration 010e: seeded optional layer (MAINT) for all categories");
  });

  // Migration 011a: add payment_reject_reason to orders (CRITICAL)
  await once("011a", true, async () => {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reject_reason TEXT`);
    logger.info("Migration 011a: added payment_reject_reason to orders");
  });

  // Migration 012a: unify demand types to 4 quote card categories + other (CRITICAL)
  // Old types: ai_education, gov_training, ai_research, party_building, livestream_media, ai_tool_dev, other
  // New types: education, software, marketing, content, other
  await once("012a", true, async () => {
    for (const val of ["education", "software", "marketing", "content"]) {
      await db.execute(sql.raw(`
        DO $$ BEGIN
          ALTER TYPE demand_type ADD VALUE IF NOT EXISTS '${val}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `));
    }
    await db.execute(sql`
      UPDATE demands SET type = 'education'::demand_type
      WHERE type::text IN ('ai_education', 'gov_training', 'ai_research')
    `);
    await db.execute(sql`
      UPDATE demands SET type = 'software'::demand_type
      WHERE type::text IN ('ai_tool_dev', 'party_building')
    `);
    await db.execute(sql`
      UPDATE demands SET type = 'marketing'::demand_type
      WHERE type::text = 'livestream_media'
    `);
    logger.info("Migration 012a: migrated demand type values to new unified set");
  });

  // Migration 013a: auto-complete stuck milestone orders (non-critical)
  // Orders where all milestones are 'approved' but order is still 'in_progress'
  await once("013a", false, async () => {
    const stuckOrders = await db.execute(sql`
      SELECT id, order_no, opc_id, publisher_id, demand_id
      FROM orders
      WHERE status = 'in_progress'
        AND milestones IS NOT NULL
        AND jsonb_array_length(milestones::jsonb) > 0
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(milestones::jsonb) AS m
          WHERE m->>'status' IS DISTINCT FROM 'approved'
        )
    `);
    const rows = stuckOrders.rows as Array<{ id: number; order_no: string; opc_id: number; publisher_id: number; demand_id: number }>;
    if (rows.length > 0) {
      logger.info({ count: rows.length }, "Migration 013a: found stuck completed orders, auto-completing");
      for (const row of rows) {
        await db.execute(sql`UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = ${row.id}`);
        await db.execute(sql`UPDATE demands SET status = 'completed', updated_at = NOW() WHERE id = ${row.demand_id}`);
        await db.execute(sql`
          UPDATE opc_profiles SET
            total_orders = (SELECT COUNT(*) FROM orders WHERE opc_id = ${row.opc_id}),
            avg_rating   = COALESCE((
              SELECT AVG(rating) FROM orders
              WHERE opc_id = ${row.opc_id} AND rating IS NOT NULL
            ), 0)
          WHERE user_id = ${row.opc_id}
        `);
        logger.info({ orderId: row.id, orderNo: row.order_no }, "Migration 013a: auto-completed stuck order");
      }
    } else {
      logger.info("Migration 013a: no stuck orders found");
    }
  });

  // Migration 014a: reclassify historical 'other' demands to canonical types (non-critical)
  await once("014a", false, async () => {
    await db.execute(sql`
      UPDATE demands SET type = 'marketing'::demand_type WHERE id IN (7, 29) AND type::text = 'other'
    `);
    await db.execute(sql`
      UPDATE demands SET type = 'education'::demand_type WHERE id IN (26) AND type::text = 'other'
    `);
    await db.execute(sql`
      UPDATE demands SET type = 'software'::demand_type WHERE id IN (28, 41) AND type::text = 'other'
    `);
    logger.info("Migration 014a: reclassified historical other-type demands");
  });

  // Migration 015a: add summary column to demands (non-critical)
  await once("015a", false, async () => {
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS summary TEXT`);
    logger.info("Migration 015a: added summary column to demands");
  });

  // Migration 016a: create llm_providers table (CRITICAL)
  await once("016a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_providers (
        id serial PRIMARY KEY,
        name varchar(100) NOT NULL UNIQUE,
        display_name varchar(100) NOT NULL,
        base_url varchar(500) NOT NULL,
        api_key text NOT NULL,
        default_model varchar(100) NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        remark text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    logger.info("Migration 016a: created llm_providers table");
  });

  // Migration 017a: widen quote_card_configs.tier from varchar(5) to varchar(10) (non-critical)
  await once("017a", false, async () => {
    await db.execute(sql`ALTER TABLE quote_card_configs ALTER COLUMN tier TYPE varchar(10)`);
    logger.info("Migration 017a: widened quote_card_configs.tier to varchar(10)");
  });

  // Migration 016b: seed default DeepSeek provider if none exists (non-critical)
  await once("016b", false, async () => {
    const { rows } = await db.execute(sql`SELECT COUNT(*) FROM llm_providers`);
    const count = Number((rows[0] as any).count);
    if (count === 0) {
      const deepseekKey = process.env.DEEPSEEK_API_KEY ?? "";
      await db.execute(sql`
        INSERT INTO llm_providers (name, display_name, base_url, api_key, default_model, is_active, remark)
        VALUES (
          'deepseek',
          'DeepSeek',
          'https://api.deepseek.com',
          ${deepseekKey},
          'deepseek-chat',
          true,
          '默认接入，兼容 OpenAI SDK'
        )
      `);
      logger.info("Migration 016b: seeded default DeepSeek provider");
    }
  });

  // Migration 018a: create screen_videos table (CRITICAL)
  await once("018a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS screen_videos (
        id          serial  PRIMARY KEY,
        title       text    NOT NULL DEFAULT '',
        object_path text    NOT NULL,
        sort_order  integer NOT NULL DEFAULT 0,
        created_at  timestamp NOT NULL DEFAULT now()
      )
    `);
    logger.info("Migration 018a: created screen_videos table");
  });

  // Migration 019a: create cat_categories table (CRITICAL)
  await once("019a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cat_categories (
        id          serial      PRIMARY KEY,
        code        varchar(20) NOT NULL UNIQUE,
        name        varchar(50) NOT NULL,
        description text,
        color_hex   varchar(10),
        icon        varchar(50),
        sort_order  integer     NOT NULL DEFAULT 0,
        is_active   boolean     NOT NULL DEFAULT true,
        created_at  timestamp   NOT NULL DEFAULT now()
      )
    `);
    logger.info("Migration 019a: created cat_categories table");
  });

  // Migration 019b: create cat_tags table (CRITICAL)
  await once("019b", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cat_tags (
        id               serial      PRIMARY KEY,
        cat_category_id  integer     NOT NULL REFERENCES cat_categories(id) ON DELETE CASCADE,
        code             varchar(20) NOT NULL UNIQUE,
        name             varchar(50) NOT NULL,
        description      text,
        sort_order       integer     NOT NULL DEFAULT 0,
        is_active        boolean     NOT NULL DEFAULT true,
        created_at       timestamp   NOT NULL DEFAULT now()
      )
    `);
    logger.info("Migration 019b: created cat_tags table");
  });

  // Migration 019c: seed initial cat_categories (5 tracks)
  await once("019c", false, async () => {
    const { rows } = await db.execute(sql`SELECT COUNT(*) FROM cat_categories`);
    const count = Number((rows[0] as any).count);
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO cat_categories (code, name, description, color_hex, icon, sort_order, is_active) VALUES
          ('CG',    '内容生成',        '商业文案、视觉内容、视频、H5等内容创作与设计服务',     '#6366f1', 'Palette',        1, true),
          ('SA',    '软件系统与智能体', 'AI工具定制、插件开发、智能体搭建、系统集成等软件交付', '#0ea5e9', 'Code2',          2, true),
          ('TK',    '培训与知识产品',   'AI课程开发、政企培训、研学项目、知识产品等教育服务',   '#f59e0b', 'GraduationCap',  3, true),
          ('BO',    '商业运营',        'AI赋能直播、短视频、新媒体运营及品牌营销推广',          '#10b981', 'TrendingUp',     4, true),
          ('OTHER', '其他',           '不属于以上四类的AI相关服务需求',                        '#94a3b8', 'MoreHorizontal', 5, true)
      `);
      logger.info("Migration 019c: seeded 5 initial cat_categories");
    }
  });

  // Migration 019d: seed initial cat_tags (~20 sub-direction tags)
  await once("019d", false, async () => {
    const { rows } = await db.execute(sql`SELECT COUNT(*) FROM cat_tags`);
    const count = Number((rows[0] as any).count);
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO cat_tags (cat_category_id, code, name, sort_order, is_active)
        SELECT id, tag_code, tag_name, tag_sort, true FROM (
          VALUES
            ('CG', 'CG-01', '商业文案',          1),
            ('CG', 'CG-02', '视觉设计与海报',     2),
            ('CG', 'CG-03', '短视频与剪辑',       3),
            ('CG', 'CG-04', 'H5与交互设计',       4),
            ('SA', 'SA-01', '金融智能体',          1),
            ('SA', 'SA-02', '企业流程自动化',      2),
            ('SA', 'SA-03', 'Web应用开发',         3),
            ('SA', 'SA-04', '小程序/移动端开发',  4),
            ('SA', 'SA-05', 'AI工具与插件定制',   5),
            ('TK', 'TK-01', 'AI技能培训',          1),
            ('TK', 'TK-02', '政企定制培训',        2),
            ('TK', 'TK-03', '研学与体验活动',      3),
            ('TK', 'TK-04', '在线课程与知识产品', 4),
            ('BO', 'BO-01', '直播运营',            1),
            ('BO', 'BO-02', '短视频营销',          2),
            ('BO', 'BO-03', '新媒体账号运营',      3),
            ('BO', 'BO-04', '品牌策划与推广',      4),
            ('BO', 'BO-05', '私域流量运营',        5),
            ('OTHER', 'OTHER-01', '其他需求',       1)
        ) AS t(cat_code, tag_code, tag_name, tag_sort)
        JOIN cat_categories c ON c.code = t.cat_code
      `);
      logger.info("Migration 019d: seeded initial cat_tags");
    }
  });

  // Migration 019e: add cat_category_id to demands (non-critical)
  await once("019e", false, async () => {
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS cat_category_id integer REFERENCES cat_categories(id)`);
    logger.info("Migration 019e: added cat_category_id to demands");
  });

  // Migration 019f: add cat_category_id to portfolios (non-critical)
  await once("019f", false, async () => {
    await db.execute(sql`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS cat_category_id integer REFERENCES cat_categories(id)`);
    logger.info("Migration 019f: added cat_category_id to portfolios");
  });

  // Migration 019g: add cat_category_id to quote_dimensions (non-critical)
  await once("019g", false, async () => {
    await db.execute(sql`ALTER TABLE quote_dimensions ADD COLUMN IF NOT EXISTS cat_category_id integer REFERENCES cat_categories(id)`);
    logger.info("Migration 019g: added cat_category_id to quote_dimensions");
  });

  // Migration 019h: backfill demands.cat_category_id from demands.type
  await once("019h", false, async () => {
    await db.execute(sql`
      UPDATE demands d
      SET cat_category_id = c.id
      FROM cat_categories c
      WHERE d.cat_category_id IS NULL
        AND (
          (d.type IN ('education', 'ai_education', 'gov_training', 'ai_research', 'party_building') AND c.code = 'TK')
          OR (d.type IN ('software', 'ai_tool_dev', 'livestream_media') AND c.code = 'SA')
          OR (d.type = 'marketing' AND c.code = 'BO')
          OR (d.type = 'content' AND c.code = 'CG')
          OR (d.type = 'other' AND c.code = 'OTHER')
        )
    `);
    logger.info("Migration 019h: backfilled demands.cat_category_id");
  });

  // Migration 019i: backfill quote_dimensions.cat_category_id from quote_dimensions.category
  await once("019i", false, async () => {
    await db.execute(sql`
      UPDATE quote_dimensions qd
      SET cat_category_id = c.id
      FROM cat_categories c
      WHERE qd.cat_category_id IS NULL
        AND (
          (qd.category = 'education' AND c.code = 'TK')
          OR (qd.category = 'software' AND c.code = 'SA')
          OR (qd.category = 'marketing' AND c.code = 'BO')
          OR (qd.category = 'content' AND c.code = 'CG')
          OR (qd.category = 'other' AND c.code = 'OTHER')
        )
    `);
    logger.info("Migration 019i: backfilled quote_dimensions.cat_category_id");
  });

  // ─── OPC双等级体系 migrations ────────────────────────────────────────────────

  // Migration 020a: create credit_levels table (CRITICAL)
  await once("020a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_levels (
        id         SERIAL PRIMARY KEY,
        code       VARCHAR(50)  NOT NULL UNIQUE,
        name       VARCHAR(100) NOT NULL,
        min_points INTEGER      NOT NULL DEFAULT 0,
        sort_order INTEGER      NOT NULL DEFAULT 0,
        color      VARCHAR(50),
        is_active  BOOLEAN      NOT NULL DEFAULT true,
        created_at TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Migration 020a: created credit_levels table");
  });

  // Migration 020b: add credit_level_id to opc_profiles (non-critical)
  await once("020b", false, async () => {
    await db.execute(sql`ALTER TABLE opc_profiles ADD COLUMN IF NOT EXISTS credit_level_id INTEGER REFERENCES credit_levels(id)`);
    logger.info("Migration 020b: added credit_level_id to opc_profiles");
  });

  // Migration 020c: add credit_points to opc_profiles (non-critical)
  await once("020c", false, async () => {
    await db.execute(sql`ALTER TABLE opc_profiles ADD COLUMN IF NOT EXISTS credit_points INTEGER NOT NULL DEFAULT 0`);
    logger.info("Migration 020c: added credit_points to opc_profiles");
  });

  // Migration 020d: seed default credit levels (白银/黄金/钻石/黑钻)
  await once("020d", false, async () => {
    await db.execute(sql`
      INSERT INTO credit_levels (code, name, min_points, sort_order, color, is_active)
      VALUES
        ('silver',        '白银', 60, 1, '#94a3b8', true),
        ('gold',          '黄金', 70, 2, '#f59e0b', true),
        ('diamond',       '钻石', 80, 3, '#0ea5e9', true),
        ('black_diamond', '黑钻', 90, 4, '#1e293b', true)
      ON CONFLICT (code) DO NOTHING
    `);
    logger.info("Migration 020d: seeded default credit_levels (白银/黄金/钻石/黑钻)");
  });

  // Migration 020e: backfill opc_profiles.credit_level_id — all OPCs start at 白银
  // Credit level is completely separate from old A/B/C track skill certification.
  await once("020e", false, async () => {
    await db.execute(sql`
      UPDATE opc_profiles op
      SET credit_level_id = cl.id
      FROM credit_levels cl
      WHERE op.credit_level_id IS NULL AND cl.code = 'silver'
    `);
    logger.info("Migration 020e: backfilled opc_profiles.credit_level_id — all set to 白银");
  });

  // Migration 020f: create opc_track_certs table (CRITICAL — depends on cat_categories)
  await once("020f", true, async () => {
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cat_categories'
        ) THEN
          CREATE TABLE IF NOT EXISTS opc_track_certs (
            id              SERIAL      PRIMARY KEY,
            user_id         INTEGER     NOT NULL REFERENCES users(id),
            cat_category_id INTEGER     NOT NULL REFERENCES cat_categories(id),
            level           VARCHAR(1)  NOT NULL CHECK (level IN ('C','B','A')),
            status          VARCHAR(20) NOT NULL DEFAULT 'active',
            certified_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
            created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
            CONSTRAINT opc_track_certs_user_category_unique UNIQUE (user_id, cat_category_id)
          );
        END IF;
      END $$
    `);
    logger.info("Migration 020f: created opc_track_certs table (or skipped — cat_categories not yet present)");
  });

  // Migration 020g: superseded — opc_track_certs auto-backfill removed.
  // Track certifications are now managed exclusively by operations staff via admin panel.
  await once("020g", false, async () => {
    // intentional no-op (superseded by manual cert management policy)
  });

  // Migration 021a: add required_track_level to demands (CRITICAL)
  await once("021a", true, async () => {
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS required_track_level VARCHAR(5) NOT NULL DEFAULT 'any'`);
    logger.info("Migration 021a: added required_track_level to demands");
  });

  // Migration 021b: replace old credit level seed data with correct 白银/黄金/钻石/黑钻 (CRITICAL)
  await once("021b", true, async () => {
    await db.execute(sql`
      DO $$
      DECLARE
        old_codes TEXT[] := ARRAY['entry','developing','skilled','expert'];
        has_old   BOOLEAN;
      BEGIN
        SELECT EXISTS(
          SELECT 1 FROM credit_levels WHERE code = ANY(old_codes)
        ) INTO has_old;

        IF has_old THEN
          UPDATE opc_profiles SET credit_level_id = NULL;
          DELETE FROM credit_levels WHERE code = ANY(old_codes);
        END IF;

        INSERT INTO credit_levels (code, name, min_points, sort_order, color, is_active)
        VALUES
          ('silver',        '白银', 60, 1, '#94a3b8', true),
          ('gold',          '黄金', 70, 2, '#f59e0b', true),
          ('diamond',       '钻石', 80, 3, '#0ea5e9', true),
          ('black_diamond', '黑钻', 90, 4, '#1e293b', true)
        ON CONFLICT (code) DO UPDATE SET
          name       = EXCLUDED.name,
          min_points = EXCLUDED.min_points,
          sort_order = EXCLUDED.sort_order,
          color      = EXCLUDED.color,
          is_active  = EXCLUDED.is_active;

        UPDATE opc_profiles op
        SET credit_level_id = cl.id
        FROM credit_levels cl
        WHERE op.credit_level_id IS NULL AND cl.code = 'silver';
      END $$
    `);
    logger.info("Migration 021b: replaced credit_levels with 白银/黄金/钻石/黑钻");
  });

  // Migration 021d: strip " OPC" suffix from credit level names (non-critical)
  await once("021d", false, async () => {
    await db.execute(sql`
      UPDATE credit_levels SET name = REPLACE(name, ' OPC', '') WHERE name LIKE '% OPC'
    `);
    logger.info("Migration 021d: stripped ' OPC' suffix from credit_levels names");
  });

  // Migration 022a: backfill portfolios.cat_category_id from legacy type field (non-critical)
  await once("022a", false, async () => {
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'portfolios' AND column_name = 'cat_category_id'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cat_categories'
        )
        THEN
          UPDATE portfolios p
          SET cat_category_id = cc.id
          FROM cat_categories cc
          WHERE p.cat_category_id IS NULL
            AND p.level_apply_status = 'approved'
            AND p.apply_level IS NOT NULL
            AND cc.code = CASE p.type
              WHEN 'education' THEN 'TK'
              WHEN 'software'  THEN 'SA'
              WHEN 'marketing' THEN 'BO'
              WHEN 'content'   THEN 'CG'
              ELSE 'OTHER'
            END;
        END IF;
      END $$
    `);
    logger.info("Migration 022a: backfilled portfolios.cat_category_id from legacy type field");
  });

  // Migration 023a: create credit_rules, credit_transactions tables + seed default rules (CRITICAL)
  await once("023a", true, async () => {
    // Step 1: credit_action_type enum
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_action_type') THEN
          CREATE TYPE credit_action_type AS ENUM (
            'order_completed',
            'five_star_review',
            'bad_review',
            'order_disputed',
            'manual_adjustment'
          );
        END IF;
      END $$
    `);
    // Step 2: credit_rules table + seed
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'credit_rules'
        ) THEN
          CREATE TABLE credit_rules (
            id           SERIAL PRIMARY KEY,
            action_type  VARCHAR(50) NOT NULL UNIQUE,
            points_delta INTEGER NOT NULL DEFAULT 0,
            description  TEXT,
            is_active    BOOLEAN NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          INSERT INTO credit_rules (action_type, points_delta, description, is_active) VALUES
            ('order_completed',   10, '订单成功完成',     TRUE),
            ('five_star_review',   5, '客户5星好评',       TRUE),
            ('bad_review',       -10, '客户差评（1-2星）', TRUE),
            ('order_disputed',   -20, '订单进入争议流程', TRUE),
            ('manual_adjustment',  0, '管理员手动调整',   TRUE);
        END IF;
      END $$
    `);
    logger.info("Migration 023a: created credit_rules table");
    // Step 3: credit_transactions table
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'credit_transactions'
        ) THEN
          CREATE TABLE credit_transactions (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER NOT NULL REFERENCES users(id),
            delta         INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            action_type   VARCHAR(50) NOT NULL,
            ref_id        INTEGER,
            note          TEXT,
            operator_id   INTEGER,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
        END IF;
      END $$
    `);
    logger.info("Migration 023a: created credit_transactions table");
  });

  // Migration 025a: add manually_granted column to opc_track_certs (non-critical)
  await once("025a", false, async () => {
    await db.execute(sql`
      ALTER TABLE opc_track_certs ADD COLUMN IF NOT EXISTS manually_granted BOOLEAN NOT NULL DEFAULT FALSE
    `);
    logger.info("Migration 025a: ensured opc_track_certs.manually_granted column exists");
  });

  // Migration 026a: create demand_invitations table (CRITICAL)
  await once("026a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS demand_invitations (
        id           SERIAL PRIMARY KEY,
        demand_id    INTEGER NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
        opc_id       INTEGER NOT NULL REFERENCES users(id),
        track_level  VARCHAR(1) NOT NULL,
        source       VARCHAR(20) NOT NULL DEFAULT 'auto',
        invited_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        emailed_at   TIMESTAMP,
        CONSTRAINT demand_invitations_demand_opc_uniq UNIQUE (demand_id, opc_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS demand_invitations_demand_idx ON demand_invitations(demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS demand_invitations_opc_idx ON demand_invitations(opc_id)`);
    logger.info("Migration 026a: ensured demand_invitations table exists");
  });

  // Migration 027a: backfill sub_orders for existing orders without them (CRITICAL)
  await once("027a", true, async () => {
    const ordersWithoutSubOrders = await db.execute(sql`
      SELECT o.order_no, o.opc_share, o.platform_fee, o.opc_id
      FROM orders o
      WHERE NOT EXISTS (
        SELECT 1 FROM sub_orders s WHERE s.order_no = o.order_no
      )
    `);
    if (ordersWithoutSubOrders.rows.length > 0) {
      const platformSettingRows = await db.execute(sql`
        SELECT value FROM site_settings WHERE key = 'platform_ccb_merchant_no' LIMIT 1
      `);
      const platformMerchantNo = (platformSettingRows.rows[0] as any)?.value ?? null;
      for (const row of ordersWithoutSubOrders.rows as Array<{ order_no: string; opc_share: string | number; platform_fee: string | number; opc_id: number }>) {
        const opcSettlementRows = await db.execute(sql`
          SELECT ccb_merchant_no, company_name FROM settlement_accounts WHERE user_id = ${row.opc_id} LIMIT 1
        `);
        const opcSA = opcSettlementRows.rows[0] as { ccb_merchant_no: string | null; company_name: string | null } | undefined;
        await db.execute(sql`
          INSERT INTO sub_orders (order_no, sub_order_no, party_name, merchant_no, amount, role)
          VALUES
            (${row.order_no}, ${row.order_no + "-OPC"},      ${opcSA?.company_name ?? null}, ${opcSA?.ccb_merchant_no ?? null}, ${String(row.opc_share)},    'opc'),
            (${row.order_no}, ${row.order_no + "-PLATFORM"}, '平台',                          ${platformMerchantNo},             ${String(row.platform_fee)}, 'platform')
          ON CONFLICT (sub_order_no) DO NOTHING
        `);
      }
      logger.info(`Migration 027a: backfilled sub_orders for ${ordersWithoutSubOrders.rows.length} existing orders`);
    } else {
      logger.info("Migration 027a: all orders already have sub_orders, nothing to backfill");
    }
  });

  // Migration 028a: ensure budget_min / budget_max columns exist on demands (CRITICAL)
  // Replaces the now-removed migration 009a. No backfill — 0 means "not set".
  await once("028a", true, async () => {
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS budget_min real NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE demands ADD COLUMN IF NOT EXISTS budget_max real NOT NULL DEFAULT 0`);
    logger.info("Migration 028a: ensured budget_min / budget_max columns exist on demands");
  });

  // Migration 029a: add sub_role, releasable_at, settled_at to sub_orders
  await once("029a", true, async () => {
    await db.execute(sql`ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS sub_role varchar(30)`);
    await db.execute(sql`ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS releasable_at timestamp`);
    await db.execute(sql`ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS settled_at timestamp`);
    logger.info("Migration 029a: added sub_role, releasable_at, settled_at to sub_orders");
  });

  // Migration 029b: backfill sub_role for existing records and settled_at for completed orders
  await once("029b", true, async () => {
    await db.execute(sql`
      UPDATE sub_orders SET sub_role = 'platform'
      WHERE sub_role IS NULL AND role = 'platform'
    `);
    await db.execute(sql`
      UPDATE sub_orders SET sub_role = 'opc_primary'
      WHERE sub_role IS NULL AND role = 'opc'
    `);
    // For completed orders, treat the legacy opc_primary and platform sub-orders as already settled
    await db.execute(sql`
      UPDATE sub_orders s
      SET settled_at = o.updated_at
      FROM orders o
      WHERE s.order_no = o.order_no
        AND o.status = 'completed'
        AND s.sub_role IN ('opc_primary', 'platform')
        AND s.settled_at IS NULL
    `);
    logger.info("Migration 029b: backfilled sub_role and settled_at for existing sub_orders");
  });

  // Migration 030a: fix demands stuck in "matched" status after their order moved to in_progress/completed
  await once("030a", false, async () => {
    const result = await db.execute(sql`
      UPDATE demands d
      SET status = 'in_progress', updated_at = NOW()
      WHERE d.status = 'matched'
        AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.demand_id = d.id
            AND o.status IN ('in_progress', 'pending_acceptance', 'completed', 'disputed')
        )
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.demand_id = d.id
            AND o2.status = 'pending_payment'
        )
    `);
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Migration 030a: fixed demands stuck in matched status");
  });

  // Migration 031a: create user_login_logs table (CRITICAL)
  await once("031a", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_login_logs (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar(20) NOT NULL,
        ip varchar(60),
        city varchar(100),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_login_logs_user_id_idx ON user_login_logs(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_login_logs_created_at_idx ON user_login_logs(created_at)`);
    logger.info("Migration 031a: created user_login_logs table");
  });

  // ── V2 Business Flow Migrations ───────────────────────────────────────────

  // Migration 032a: v2 enums
  await once("032a", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_client_demand_status AS ENUM (
          'draft','negotiating','quoting','pending_contract','executing','warranty','completed','closed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_outsource_demand_status AS ENUM (
          'negotiating','executing','warranty','completed','closed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_outsource_demand_mode AS ENUM ('public','invited');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_tender_status AS ENUM ('negotiating','quoted','won','lost');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_outsource_order_status AS ENUM (
          'pending_contract','executing','warranty','completed','cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_quotation_card_parent_type AS ENUM ('client_demand','tender');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_contract_channel AS ENUM ('a','b');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_contract_status AS ENUM (
          'draft','pending_publisher_confirm','publisher_rejected','pending_sign','signed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_payment_plan_status AS ENUM ('pending','awaiting_review','paid');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_settlement_plan_status AS ENUM ('pending','payable','paid');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_deliverable_status AS ENUM ('pending','confirmed','revision','approved');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_ticket_status AS ENUM ('open','closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE v2_discussion_parent_type AS ENUM (
          'client_demand','outsource_demand','tender',
          'deliverable_a','deliverable_b','ticket_a','ticket_b'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    logger.info("Migration 032a: created v2 enums");
  });

  // Migration 032b: v2_client_demands and v2_client_demand_versions
  await once("032b", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_client_demands (
        id serial PRIMARY KEY,
        demand_no varchar(50) NOT NULL UNIQUE,
        publisher_id integer NOT NULL REFERENCES users(id),
        title varchar(200) NOT NULL,
        demand_type varchar(50),
        is_urgent boolean NOT NULL DEFAULT false,
        budget_min real,
        budget_max real,
        hope_delivery_date timestamp,
        status v2_client_demand_status NOT NULL DEFAULT 'draft',
        warranty_end_date timestamp,
        closed_reason text,
        closed_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_client_demands_publisher_idx ON v2_client_demands(publisher_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_client_demands_status_idx ON v2_client_demands(status)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_client_demand_versions (
        id serial PRIMARY KEY,
        demand_id integer NOT NULL REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        version_no integer NOT NULL DEFAULT 1,
        detail text NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]',
        edited_by integer REFERENCES users(id),
        edit_comment text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_client_demand_versions_demand_idx ON v2_client_demand_versions(demand_id)`);
    logger.info("Migration 032b: created v2_client_demands and versions");
  });

  // Migration 032c: v2_outsource_demands and v2_outsource_demand_versions
  await once("032c", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_outsource_demands (
        id serial PRIMARY KEY,
        demand_no varchar(50) NOT NULL UNIQUE,
        client_demand_id integer REFERENCES v2_client_demands(id) ON DELETE SET NULL,
        created_by integer NOT NULL REFERENCES users(id),
        title varchar(200) NOT NULL,
        demand_type varchar(50),
        is_urgent boolean NOT NULL DEFAULT false,
        mode v2_outsource_demand_mode NOT NULL DEFAULT 'public',
        expected_price_min real,
        expected_price_max real,
        milestones jsonb NOT NULL DEFAULT '[]',
        status v2_outsource_demand_status NOT NULL DEFAULT 'negotiating',
        closed_reason text,
        closed_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_demands_client_demand_idx ON v2_outsource_demands(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_demands_status_idx ON v2_outsource_demands(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_demands_mode_idx ON v2_outsource_demands(mode)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_outsource_demand_versions (
        id serial PRIMARY KEY,
        outsource_demand_id integer NOT NULL REFERENCES v2_outsource_demands(id) ON DELETE CASCADE,
        version_no integer NOT NULL DEFAULT 1,
        detail text NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]',
        edited_by integer REFERENCES users(id),
        edit_comment text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_demand_versions_demand_idx ON v2_outsource_demand_versions(outsource_demand_id)`);
    logger.info("Migration 032c: created v2_outsource_demands and versions");
  });

  // Migration 032d: v2_tenders
  await once("032d", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_tenders (
        id serial PRIMARY KEY,
        outsource_demand_id integer NOT NULL REFERENCES v2_outsource_demands(id) ON DELETE CASCADE,
        opc_id integer NOT NULL REFERENCES users(id),
        status v2_tender_status NOT NULL DEFAULT 'negotiating',
        total_price real,
        price_breakdown jsonb NOT NULL DEFAULT '[]',
        quoted_at timestamp,
        selected_by integer REFERENCES users(id),
        selected_at timestamp,
        cancelled_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tenders_outsource_demand_idx ON v2_tenders(outsource_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tenders_opc_idx ON v2_tenders(opc_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tenders_status_idx ON v2_tenders(status)`);
    logger.info("Migration 032d: created v2_tenders");
  });

  // Migration 032e: v2_outsource_orders
  await once("032e", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_outsource_orders (
        id serial PRIMARY KEY,
        order_no varchar(50) NOT NULL UNIQUE,
        outsource_demand_id integer NOT NULL REFERENCES v2_outsource_demands(id),
        tender_id integer NOT NULL REFERENCES v2_tenders(id),
        opc_id integer NOT NULL REFERENCES users(id),
        status v2_outsource_order_status NOT NULL DEFAULT 'pending_contract',
        warranty_start_date timestamp,
        warranty_end_date timestamp,
        verified_by integer REFERENCES users(id),
        verified_at timestamp,
        cancelled_reason text,
        cancelled_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_orders_demand_idx ON v2_outsource_orders(outsource_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_orders_tender_idx ON v2_outsource_orders(tender_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_orders_opc_idx ON v2_outsource_orders(opc_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_outsource_orders_status_idx ON v2_outsource_orders(status)`);
    logger.info("Migration 032e: created v2_outsource_orders");
  });

  // Migration 032f: v2_quotation_cards
  await once("032f", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_quotation_cards (
        id serial PRIMARY KEY,
        parent_type v2_quotation_card_parent_type NOT NULL,
        client_demand_id integer REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        tender_id integer REFERENCES v2_tenders(id) ON DELETE CASCADE,
        total_price real NOT NULL DEFAULT 0,
        breakdown jsonb NOT NULL DEFAULT '[]',
        note text,
        created_by integer NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_quotation_cards_client_demand_idx ON v2_quotation_cards(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_quotation_cards_tender_idx ON v2_quotation_cards(tender_id)`);
    logger.info("Migration 032f: created v2_quotation_cards");
  });

  // Migration 032g: v2_contracts
  await once("032g", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_contracts (
        id serial PRIMARY KEY,
        contract_no varchar(50) NOT NULL UNIQUE,
        channel v2_contract_channel NOT NULL,
        client_demand_id integer REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        outsource_order_id integer REFERENCES v2_outsource_orders(id) ON DELETE CASCADE,
        status v2_contract_status NOT NULL DEFAULT 'draft',
        content text,
        signed_file_url text,
        publisher_confirmed_at timestamp,
        publisher_rejected_at timestamp,
        publisher_rejected_reason text,
        opc_confirmed_at timestamp,
        signed_at timestamp,
        signed_by integer REFERENCES users(id),
        finalized_by integer REFERENCES users(id),
        finalized_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_contracts_client_demand_idx ON v2_contracts(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_contracts_outsource_order_idx ON v2_contracts(outsource_order_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_contracts_status_idx ON v2_contracts(status)`);
    logger.info("Migration 032g: created v2_contracts");
  });

  // Migration 032h: v2_payment_plans (A channel) and v2_settlement_plans (B channel)
  await once("032h", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_payment_plans (
        id serial PRIMARY KEY,
        client_demand_id integer NOT NULL REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        contract_id integer REFERENCES v2_contracts(id) ON DELETE SET NULL,
        item_no integer NOT NULL DEFAULT 1,
        description varchar(200),
        amount real NOT NULL,
        due_date timestamp NOT NULL,
        status v2_payment_plan_status NOT NULL DEFAULT 'pending',
        voucher_url text,
        voucher_note text,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        paid_at timestamp,
        is_last_item boolean NOT NULL DEFAULT false,
        created_by integer NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_payment_plans_client_demand_idx ON v2_payment_plans(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_payment_plans_status_idx ON v2_payment_plans(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_payment_plans_due_date_idx ON v2_payment_plans(due_date)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_settlement_plans (
        id serial PRIMARY KEY,
        outsource_order_id integer NOT NULL REFERENCES v2_outsource_orders(id) ON DELETE CASCADE,
        contract_id integer REFERENCES v2_contracts(id) ON DELETE SET NULL,
        opc_id integer NOT NULL REFERENCES users(id),
        item_no integer NOT NULL DEFAULT 1,
        description varchar(200),
        amount real NOT NULL,
        due_date timestamp NOT NULL,
        status v2_settlement_plan_status NOT NULL DEFAULT 'pending',
        is_last_item boolean NOT NULL DEFAULT false,
        payment_voucher_url text,
        payment_note text,
        paid_by integer REFERENCES users(id),
        paid_at timestamp,
        bank_account_snapshot text,
        created_by integer NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_settlement_plans_order_idx ON v2_settlement_plans(outsource_order_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_settlement_plans_opc_idx ON v2_settlement_plans(opc_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_settlement_plans_status_idx ON v2_settlement_plans(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_settlement_plans_due_date_idx ON v2_settlement_plans(due_date)`);
    logger.info("Migration 032h: created v2_payment_plans and v2_settlement_plans");
  });

  // Migration 032i: v2_deliverables_a and v2_deliverables_b
  await once("032i", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_deliverables_a (
        id serial PRIMARY KEY,
        client_demand_id integer NOT NULL REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        content text,
        attachments jsonb NOT NULL DEFAULT '[]',
        status v2_deliverable_status NOT NULL DEFAULT 'pending',
        created_by integer NOT NULL REFERENCES users(id),
        confirmed_by integer REFERENCES users(id),
        confirmed_at timestamp,
        rejected_by integer REFERENCES users(id),
        rejected_at timestamp,
        rejected_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_deliverables_a_demand_idx ON v2_deliverables_a(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_deliverables_a_status_idx ON v2_deliverables_a(status)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_deliverables_b (
        id serial PRIMARY KEY,
        outsource_order_id integer NOT NULL REFERENCES v2_outsource_orders(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        content text,
        attachments jsonb NOT NULL DEFAULT '[]',
        status v2_deliverable_status NOT NULL DEFAULT 'pending',
        submitted_by integer NOT NULL REFERENCES users(id),
        approved_by integer REFERENCES users(id),
        approved_at timestamp,
        rejected_by integer REFERENCES users(id),
        rejected_at timestamp,
        rejected_reason text,
        submission_count integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_deliverables_b_order_idx ON v2_deliverables_b(outsource_order_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_deliverables_b_status_idx ON v2_deliverables_b(status)`);
    logger.info("Migration 032i: created v2_deliverables_a and v2_deliverables_b");
  });

  // Migration 032j: v2_tickets_a and v2_tickets_b
  await once("032j", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_tickets_a (
        id serial PRIMARY KEY,
        client_demand_id integer NOT NULL REFERENCES v2_client_demands(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        description text,
        status v2_ticket_status NOT NULL DEFAULT 'open',
        created_by integer NOT NULL REFERENCES users(id),
        closed_by integer REFERENCES users(id),
        closed_at timestamp,
        closed_note text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tickets_a_demand_idx ON v2_tickets_a(client_demand_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tickets_a_status_idx ON v2_tickets_a(status)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_tickets_b (
        id serial PRIMARY KEY,
        outsource_order_id integer NOT NULL REFERENCES v2_outsource_orders(id) ON DELETE CASCADE,
        opc_id integer NOT NULL REFERENCES users(id),
        title varchar(200) NOT NULL,
        description text,
        status v2_ticket_status NOT NULL DEFAULT 'open',
        created_by integer NOT NULL REFERENCES users(id),
        closed_by integer REFERENCES users(id),
        closed_at timestamp,
        closed_note text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tickets_b_order_idx ON v2_tickets_b(outsource_order_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tickets_b_opc_idx ON v2_tickets_b(opc_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_tickets_b_status_idx ON v2_tickets_b(status)`);
    logger.info("Migration 032j: created v2_tickets_a and v2_tickets_b");
  });

  // Migration 032k: v2_discussion_posts (shared discussion thread component)
  await once("032k", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS v2_discussion_posts (
        id serial PRIMARY KEY,
        parent_type v2_discussion_parent_type NOT NULL,
        parent_id integer NOT NULL,
        parent_post_id integer,
        author_id integer NOT NULL REFERENCES users(id),
        content text NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]',
        is_system_message integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_discussion_posts_parent_idx ON v2_discussion_posts(parent_type, parent_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_discussion_posts_author_idx ON v2_discussion_posts(author_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS v2_discussion_posts_parent_post_idx ON v2_discussion_posts(parent_post_id)`);
    logger.info("Migration 032k: created v2_discussion_posts");
  });

  // Migration 032l: extend notification_type enum with v2 event types
  await once("032l", true, async () => {
    const v2Types = [
      "v2_demand_submitted",
      "v2_demand_detail_updated",
      "v2_quote_initiated",
      "v2_quote_confirmed",
      "v2_quote_commented",
      "v2_contract_finalized",
      "v2_contract_confirmed",
      "v2_contract_rejected",
      "v2_contract_signed",
      "v2_payment_voucher_uploaded",
      "v2_payment_approved",
      "v2_delivery_a_created",
      "v2_delivery_a_confirmed",
      "v2_delivery_a_rejected",
      "v2_warranty_started",
      "v2_demand_verified",
      "v2_ticket_a_created",
      "v2_ticket_a_closed",
      "v2_outsource_detail_updated",
      "v2_tender_won",
      "v2_tender_lost",
      "v2_tender_cancelled",
      "v2_delivery_b_submitted",
      "v2_delivery_b_approved",
      "v2_delivery_b_rejected",
      "v2_settlement_paid",
      "v2_ticket_b_created",
      "v2_ticket_b_closed",
      "v2_discussion_replied",
    ];
    for (const t of v2Types) {
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS ${sql.raw(`'${t}'`)};
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
      `);
    }
    logger.info("Migration 032l: extended notification_type enum with v2 event types");
  });

  // Migration 032m: add attachments column to v2_tickets_a
  await once("032m", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_tickets_a ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'
    `);
    logger.info("Migration 032m: added attachments column to v2_tickets_a");
  });

  // Migration 032n: add is_blocking_payment column to v2_tickets_b
  await once("032n", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_tickets_b ADD COLUMN IF NOT EXISTS is_blocking_payment boolean NOT NULL DEFAULT false
    `);
    logger.info("Migration 032n: added is_blocking_payment column to v2_tickets_b");
  });

  // Migration 032o: add opc_signed_file_url to v2_contracts
  await once("032o", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_contracts ADD COLUMN IF NOT EXISTS opc_signed_file_url text
    `);
    logger.info("Migration 032o: added opc_signed_file_url column to v2_contracts");
  });

  // Migration 032p: add url column to v2_deliverables_a
  await once("032p", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_deliverables_a ADD COLUMN IF NOT EXISTS url text
    `);
    logger.info("Migration 032p: added url column to v2_deliverables_a");
  });

  // Migration 033a: add payment_order_no to v2_payment_plans for online payment
  await once("033a", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_payment_plans ADD COLUMN IF NOT EXISTS payment_order_no text
    `);
    logger.info("Migration 033a: added payment_order_no column to v2_payment_plans");
  });

  // Migration 033b: add v2_tender to v2_discussion_parent_type enum
  await once("033b", true, async () => {
    await db.execute(sql`
      ALTER TYPE v2_discussion_parent_type ADD VALUE IF NOT EXISTS 'v2_tender'
    `);
    logger.info("Migration 033b: added v2_tender to v2_discussion_parent_type enum");
  });

  // Migration 033c: add 'draft' to v2_outsource_order_status enum
  await once("033c", true, async () => {
    await db.execute(sql`
      ALTER TYPE v2_outsource_order_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending_contract'
    `);
    logger.info("Migration 033c: added draft to v2_outsource_order_status enum");
  });

  // Migration 034a: add attachments column to v2_tickets_b
  await once("034a", true, async () => {
    await db.execute(sql`ALTER TABLE v2_tickets_b ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'`);
    logger.info("Migration 034a: added attachments to v2_tickets_b");
  });

  // Migration 034b: add 'cancelled' to v2_payment_plan_status enum
  await once("034b", true, async () => {
    await db.execute(sql`ALTER TYPE v2_payment_plan_status ADD VALUE IF NOT EXISTS 'cancelled'`);
    logger.info("Migration 034b: added cancelled to v2_payment_plan_status enum");
  });

  // Migration 035a: add 'draft' to v2_outsource_demand_status enum
  await once("035a", true, async () => {
    await db.execute(sql`ALTER TYPE v2_outsource_demand_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'negotiating'`);
    logger.info("Migration 035a: added draft to v2_outsource_demand_status enum");
  });

  // Migration 035b: add missing v2 notification types to notification_type enum
  await once("035b", true, async () => {
    await db.execute(sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'v2_demand_invited'`);
    await db.execute(sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'v2_payment_online_paid'`);
    await db.execute(sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'v2_contract_officially_signed'`);
    await db.execute(sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'v2_opc_confirmed_contract'`);
    logger.info("Migration 035b: added missing v2 notification types to notification_type enum");
  });

  // Migration 035c: add last_opc_activity_at and last_admin_activity_at to v2_tenders
  await once("035c", true, async () => {
    await db.execute(sql`ALTER TABLE v2_tenders ADD COLUMN IF NOT EXISTS last_opc_activity_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE v2_tenders ADD COLUMN IF NOT EXISTS last_admin_activity_at TIMESTAMP`);
    logger.info("Migration 035c: added last_opc_activity_at and last_admin_activity_at to v2_tenders");
  });

  // Migration 036a: add doc_template column to cat_categories
  await once("036a", true, async () => {
    await db.execute(sql`ALTER TABLE cat_categories ADD COLUMN IF NOT EXISTS doc_template text`);
    logger.info("Migration 036a: added doc_template column to cat_categories");
  });

  // Migration 036b: seed initial doc templates for each built-in category
  await once("036b", false, async () => {
    const tmplSA = `# 项目需求说明书

## 一、项目背景

> 请简述您所在企业/团队的基本情况，以及此次项目要解决的核心问题或业务痛点。

**当前业务情况：**
（例：我们是一家做××的公司，目前存在××流程繁琐/效率低下的问题）

**项目发起原因：**
（为什么现在要做这个项目？是因为业务增长、竞争压力还是内部降本增效需求？）

---

## 二、项目目标

> 这个系统/工具做完之后，您希望达到什么效果？

- 目标一：（例：将某业务环节的人工操作时间从 X 小时降至 X 分钟）
- 目标二：（例：支持同时处理 X 个客户咨询）
- 目标三：

---

## 三、主要使用人群

> 这个系统谁在用？

| 使用角色 | 描述 | 大概人数 |
|------|------|------|
| （例：客服专员） | （日常使用系统处理客户问题） | （约 50 人） |
| | | |

---

## 四、核心功能需求

> 请描述您需要的主要功能，每个功能尽量说清楚"是什么、谁来用、用在哪个场景"。

### 功能一：[功能名称]
- **用途**：这个功能是干什么的？
- **使用场景**：什么情况下会用到？
- **预期效果**：做完之后应该达到什么效果？

### 功能二：[功能名称]
- **用途**：
- **使用场景**：
- **预期效果**：

（如有更多功能，请继续添加）

---

## 五、数据与信息说明

> 系统需要处理哪些数据？

- **输入数据**：系统从哪里获取数据？（例：从企业微信导出的客户记录、Excel 表格、已有的数据库）
- **输出数据**：系统产出什么？（例：分析报告、自动回复消息、更新后的表格）
- **数据量级**：大概有多少条数据？每天新增多少？
- **是否涉及敏感信息**：（例：客户个人信息、财务数据等）

---

## 六、对接与集成需求

> 这个系统需要和其他工具/平台打通吗？

- [ ] 微信 / 企业微信
- [ ] 钉钉 / 飞书
- [ ] 已有内部系统（请说明系统名称）：
- [ ] 第三方平台（请说明平台名称）：
- [ ] 不需要对接，独立使用

**补充说明：**

---

## 七、界面与使用方式

> 您希望以什么方式使用这个产品？

- [ ] 网页（在浏览器里打开）
- [ ] 手机 App
- [ ] 微信小程序
- [ ] 嵌入现有系统中
- [ ] 无需界面，后台自动运行
- [ ] 其他：

---

## 八、交付与时间

| 项目 | 内容 |
|------|------|
| 期望上线时间 | |
| 有无阶段性节点 | （例：需要在 X 月 X 日前完成第一期） |
| 是否需要培训 | （需要 / 不需要） |
| 是否需要后期维护 | （需要 / 不需要，请说明预期维护方式） |

---

## 九、预算参考（非必填）

- 预算范围：大约 ¥_____ 至 ¥_____
- 付款方式偏好：（里程碑付款 / 验收后一次性付款 / 其他）

---

## 十、其他补充

> 还有什么想法或要求，可以在这里自由描述
`;

    const tmplCG = `# 内容创作需求说明

## 一、项目背景

> 简述此次内容创作的背景：是品牌推广、产品发布、活动宣传还是日常运营？

**所属品牌/公司：**

**内容用途：**（这批内容是为了什么目的而做？）

---

## 二、内容类型与数量

> 勾选您需要的内容类型，并填写数量

| 内容类型 | 是否需要 | 数量 / 规格 | 备注 |
|------|------|------|------|
| 文案（活动 / 品牌 / 产品介绍） | | | |
| 海报 / 视觉设计 | | 尺寸：___×___ px | |
| 短视频脚本 | | 时长：约 ___ 秒 | |
| 短视频拍摄 + 剪辑 | | | |
| H5 / 落地页 | | | |
| 其他 | | | |

---

## 三、使用场景

> 这些内容将在哪里发布或使用？

- [ ] 微信公众号
- [ ] 微信朋友圈 / 视频号
- [ ] 抖音 / 快手
- [ ] 小红书
- [ ] 官网
- [ ] 线下物料（印刷）
- [ ] 内部使用（培训 / 汇报等）
- [ ] 其他：

---

## 四、目标受众

> 这些内容给谁看？

- **核心受众人群**：（例：25-35 岁女性白领、中小企业主、在校大学生）
- **受众痛点或关注点**：（他们最关心什么？希望内容解决他们什么问题？）
- **期望受众的行为**：（看完后希望受众做什么？例：点击购买、扫码咨询、转发分享）

---

## 五、内容风格与调性

> 描述您期望的风格，越具体越好

- **整体调性**：（例：专业严肃 / 活泼有趣 / 高端大气 / 亲切温暖）
- **可参考的竞品或风格案例**：（附链接或描述）
- **禁忌**：（有哪些风格、表达方式是一定不能有的？）

---

## 六、品牌规范

> 如有品牌 VI / 设计规范，请提供

- [ ] 有品牌色（请提供色值）：
- [ ] 有品牌字体（请提供字体名称）：
- [ ] 有 Logo（请在附件中上传文件）
- [ ] 有品牌手册 / VI 规范（请在附件中上传文件）
- [ ] 暂无，可自由发挥

---

## 七、素材与参考资料

> 您能提供哪些素材？

- **已有素材**：（产品图片、公司照片、相关文字资料等）
- **参考案例**：（希望参考的风格案例，提供链接或截图）
- **关键信息**：（必须出现在内容中的信息，如价格、活动日期、联系方式等）

---

## 八、交付要求

| 项目 | 内容 |
|------|------|
| 交付格式 | （例：PSD 源文件 + JPG 成品 / MP4 视频 / Word 文档） |
| 修改次数 | 期望包含 ___ 次修改机会 |
| 期望交付时间 | |

---

## 九、其他说明

> 还有什么补充？
`;

    const tmplTK = `# 培训项目需求说明

## 一、项目背景

> 请简述此次培训的背景及发起原因

**组织情况：**（您所在单位 / 企业的基本情况）

**发起培训的原因：**（为什么要做这次培训？解决什么问题？）

---

## 二、培训目标

> 培训结束后，学员应该能达到什么状态？

- **能力目标**：（例：学员能够独立使用 AI 工具完成日常文案撰写）
- **行为目标**：（例：培训后 90% 的学员在工作中开始使用 AI 辅助工具）
- **知识目标**：（例：了解大模型基本原理，掌握提示词工程核心方法）

---

## 三、学员情况

| 项目 | 描述 |
|------|------|
| 学员人数 | 约 _____ 人 |
| 学员职位 / 角色 | |
| 学员年龄层 | |
| 学员当前能力水平 | （例：零基础 / 有一定 AI 使用经验） |
| 学员参加培训的主要动机 | （主动报名 / 单位安排 / 考证需求） |

---

## 四、培训内容与大纲

> 您对培训内容有什么要求或设想？（可粗略描述，讲师可协助细化）

**核心模块（必须涵盖）：**
1.
2.
3.

**可选模块（有时间则讲）：**
1.
2.

**明确不需要的内容：**

---

## 五、培训形式

| 项目 | 您的需求 |
|------|------|
| 线上 / 线下 | （线下集中 / 线上直播 / 录播视频 / 混合形式） |
| 课时总长 | 约 _____ 天 / _____ 小时 |
| 每次课时长 | （半天 / 一天 / 2 小时一节） |
| 是否需要实操环节 | （需要 / 不需要） |
| 是否需要课后作业 / 练习 | （需要 / 不需要） |
| 是否需要结业考核 / 认证 | （需要 / 不需要，如需请说明） |

---

## 六、场地与设备（仅限线下培训）

| 项目 | 情况 |
|------|------|
| 培训地点 | （城市 + 大致区域，或"由我方提供场地"） |
| 场地情况 | （我方提供 / 需供应商协助安排） |
| 设备情况 | （投影 / 大屏：有/无；电脑：人手一台 / 自带 / 需提供） |
| 网络条件 | （稳定 / 一般，带宽约 ___M） |

---

## 七、配套资料需求

> 培训结束后，需要提供哪些材料？

- [ ] 课件 PPT（可供学员留存）
- [ ] 学员手册 / 讲义
- [ ] 工具清单 / 资源包
- [ ] 录制视频（供未出席人员回看）
- [ ] 培训总结报告
- [ ] 不需要额外资料

---

## 八、时间安排

| 项目 | 时间 |
|------|------|
| 期望培训时间 | （具体日期或大致时间范围） |
| 时间灵活度 | （固定 / 可协商） |
| 有无特殊时间限制 | （例：避开某些节假日） |

---

## 九、预算参考（非必填）

- 预算范围：¥_____ 至 _____（含 / 不含差旅）
- 付款方式：

---

## 十、其他要求

> 还有什么特别说明或要求？
`;

    const tmplBO = `# 营销运营需求说明

## 一、项目背景

> 简述品牌 / 产品情况和此次营销项目的背景

**品牌 / 产品介绍：**
（您在推广什么？主要面向什么客群？）

**当前主要问题：**
（例：账号粉丝增长停滞 / 直播间流量不稳定 / 品牌知名度低）

**为什么现在启动这个项目：**

---

## 二、营销目标

> 这次项目要达到什么结果？请尽量量化

| 目标类型 | 期望数值 |
|------|------|
| 账号粉丝增长 | 目标增长 _____ 个 |
| 直播间 GMV | 单场 / 月目标 ¥_____ |
| 内容播放量 / 阅读量 | 单篇 / 条 _____ 次 |
| 新增潜在客户（线索） | 目标 _____ 条 |
| 品牌曝光量 | 目标 _____ 次 |
| 其他目标 | |

---

## 三、目标受众

> 您的目标客户是谁？

- **基本画像**：（年龄 / 性别 / 职业 / 地域）
- **核心需求与痛点**：（他们有什么烦恼或需求？）
- **购买决策特点**：（容易冲动消费 / 需要多次触达 / 重视口碑推荐）
- **他们活跃在哪个平台**：

---

## 四、渠道与平台

> 此次项目在哪些平台运营？

| 平台 | 是否包含 | 当前状态 | 账号信息 |
|------|------|------|------|
| 抖音 | | 从零开始 / 已有账号 | 粉丝量：_____ |
| 视频号 | | 从零开始 / 已有账号 | |
| 小红书 | | 从零开始 / 已有账号 | |
| 微信公众号 | | 从零开始 / 已有账号 | |
| 快手 | | 从零开始 / 已有账号 | |
| 其他 | | | |

---

## 五、内容与执行需求

> 需要服务方做什么？

**内容创作：**
- [ ] 短视频策划 + 脚本
- [ ] 短视频拍摄（需服务方到场）
- [ ] 短视频剪辑
- [ ] 图文内容（公众号 / 小红书）
- [ ] 直播策划与话术

**账号运营：**
- [ ] 日常内容发布与维护
- [ ] 评论互动回复
- [ ] 数据监控与周报

**直播支持：**
- [ ] 直播间搭建 / 布置建议
- [ ] 主播（服务方提供 / 我方自有主播）
- [ ] 直播运营（场控 / 上链接 / 互动引导）

**投放推广：**
- [ ] 信息流广告投放
- [ ] 达人 / KOL 合作
- [ ] 不需要付费推广

---

## 六、品牌调性与内容风格

- **品牌调性**：（例：专业权威 / 接地气 / 年轻时尚 / 高端商务）
- **内容风格偏好**：（例：干货教程 / 情绪共鸣 / 剧情反转 / 生活方式）
- **参考案例**：（请列举 1-3 个您喜欢的同类账号或内容）
- **一定不能有的内容 / 风格**：

---

## 七、资源与配合

> 我方能提供哪些配合？

- **素材**：（产品图片 / 样品 / 场地 / 拍摄道具）
- **人员配合**：（能提供专人对接 / 时间有限，需服务方尽量独立操作）
- **已有资源**：（例：已有私域社群 X 人 / 已有媒体资源 / 已有 KOL 合作关系）

---

## 八、服务周期与交付

| 项目 | 内容 |
|------|------|
| 合作周期 | （例：3 个月 / 6 个月 / 单次项目） |
| 每月 / 每周内容产量 | （例：每周 3 条短视频 + 1 篇公众号） |
| 数据汇报频率 | （每周 / 每月 / 按需） |
| 期望启动时间 | |

---

## 九、预算（非必填）

- 月度预算：¥_____/月（含 / 不含广告投放费用）
- 总预算：¥_____
- 是否有 KPI 激励机制：（有 / 无，有则说明）

---

## 十、其他说明
`;

    const tmplOTHER = `# 需求说明书

## 一、项目背景

> 请简述您的基本情况和此次需求的背景

**您的身份 / 组织：**
（个人 / 企业，大概做什么的）

**需求背景：**
（为什么有这个需求？要解决什么问题？）

---

## 二、具体需求内容

> 请尽量详细描述您需要做什么

（请在这里自由描述您的需求，包括：要做什么事情、产出什么、通过什么方式来完成）

---

## 三、目标与预期效果

> 这件事做好之后，您希望达到什么效果？

- 预期效果一：
- 预期效果二：
- 成功的标准是什么：（您认为什么情况下算做好了？）

---

## 四、目标受众

> 这件事的最终受益人或使用者是谁？

（例：公司内部员工 / 外部客户 / 政府部门 / 社会公众）

---

## 五、交付物

> 服务方完成工作后，需要提交什么？

- 交付物一：（例：一份报告 / 一套方案 / 一段代码 / 一批内容）
- 交付物二：
- 交付格式：（例：Word 文档 / PPT / 可执行程序 / 实体物品）

---

## 六、时间要求

| 项目 | 内容 |
|------|------|
| 期望完成时间 | |
| 有无阶段性节点 | |
| 时间是否有弹性 | |

---

## 七、参考资料

> 有没有可以参考的案例、样本或相关资料？

（附链接、文件或描述）

---

## 八、预算（非必填）

- 预算范围：¥_____ 至 ¥_____

---

## 九、其他说明

> 还有什么补充？
`;

    await db.execute(sql`
      UPDATE cat_categories SET doc_template = ${tmplSA}    WHERE code = 'SA'    AND (doc_template IS NULL OR doc_template = '')
    `);
    await db.execute(sql`
      UPDATE cat_categories SET doc_template = ${tmplCG}    WHERE code = 'CG'    AND (doc_template IS NULL OR doc_template = '')
    `);
    await db.execute(sql`
      UPDATE cat_categories SET doc_template = ${tmplTK}    WHERE code = 'TK'    AND (doc_template IS NULL OR doc_template = '')
    `);
    await db.execute(sql`
      UPDATE cat_categories SET doc_template = ${tmplBO}    WHERE code = 'BO'    AND (doc_template IS NULL OR doc_template = '')
    `);
    await db.execute(sql`
      UPDATE cat_categories SET doc_template = ${tmplOTHER} WHERE code = 'OTHER' AND (doc_template IS NULL OR doc_template = '')
    `);
    logger.info("Migration 036b: seeded doc templates for built-in cat_categories");
  });

  await once("037a", true, async () => {
    await db.execute(sql`
      ALTER TABLE agent_conversations
      ADD COLUMN IF NOT EXISTS linked_client_demand_id INTEGER
    `);
    logger.info("Migration 037a: added linked_client_demand_id to agent_conversations");
  });

  await once("038a", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_outsource_demands
      ADD COLUMN IF NOT EXISTS deadline DATE
    `);
    logger.info("Migration 038a: added deadline to v2_outsource_demands");
  });

  await once("039a", true, async () => {
    await db.execute(sql`
      ALTER TABLE v2_outsource_demands
      ADD COLUMN IF NOT EXISTS opc_level VARCHAR(10) NOT NULL DEFAULT 'any'
    `);
    logger.info("Migration 039a: added opc_level to v2_outsource_demands");
  });

  // Migration 040a: add contest_test_graded / contest_assignment_graded to notification_type enum (CRITICAL)
  await once("040a", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contest_test_graded' AFTER 'v2_discussion_replied';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contest_assignment_graded' AFTER 'contest_test_graded';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    logger.info("Migration 040a: added contest notification types to enum");
  });

  // Migration 040b: create contest_status enum and contests table (CRITICAL)
  await once("040b", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE contest_status AS ENUM ('draft', 'published', 'ended');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contests (
        id            serial PRIMARY KEY,
        title         varchar(200) NOT NULL,
        details       text NOT NULL DEFAULT '',
        announcement_at  timestamp NOT NULL,
        registration_at  timestamp NOT NULL,
        public_at        timestamp NOT NULL,
        benefit_at       timestamp NOT NULL,
        deadline_at      timestamp NOT NULL,
        status        contest_status NOT NULL DEFAULT 'draft',
        created_at    timestamp NOT NULL DEFAULT now(),
        updated_at    timestamp NOT NULL DEFAULT now()
      )
    `);
    logger.info("Migration 040b: created contests table");
  });

  // Migration 040c: create contest_questions table (CRITICAL)
  await once("040c", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contest_questions (
        id              serial PRIMARY KEY,
        cat_category_id integer NOT NULL REFERENCES cat_categories(id),
        title           varchar(200) NOT NULL,
        content         text NOT NULL DEFAULT '',
        attachments     jsonb NOT NULL DEFAULT '[]',
        created_at      timestamp NOT NULL DEFAULT now(),
        updated_at      timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS contest_questions_cat_idx ON contest_questions(cat_category_id)`);
    logger.info("Migration 040c: created contest_questions table");
  });

  // Migration 040d: create contest_tracks table (CRITICAL)
  await once("040d", true, async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contest_tracks (
        id                  serial PRIMARY KEY,
        contest_id          integer NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
        cat_category_id     integer NOT NULL REFERENCES cat_categories(id),
        test_question_id    integer REFERENCES contest_questions(id),
        a_question_id       integer REFERENCES contest_questions(id),
        b_question_id       integer REFERENCES contest_questions(id),
        c_question_id       integer REFERENCES contest_questions(id),
        test_duration_hours integer NOT NULL DEFAULT 72,
        a_duration_hours    integer NOT NULL DEFAULT 72,
        b_duration_hours    integer NOT NULL DEFAULT 72,
        c_duration_hours    integer NOT NULL DEFAULT 72,
        quota_total         integer NOT NULL DEFAULT 0,
        quota_used          integer NOT NULL DEFAULT 0,
        created_at          timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS contest_tracks_contest_idx ON contest_tracks(contest_id)`);
    logger.info("Migration 040d: created contest_tracks table");
  });

  // Migration 040e: create contest_grade, contest_registration_status enums and contest_registrations table (CRITICAL)
  await once("040e", true, async () => {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE contest_grade AS ENUM ('A', 'B', 'C', 'fail');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE contest_registration_status AS ENUM (
          'registered', 'test_submitted', 'test_passed', 'test_failed',
          'assignment_submitted', 'assignment_passed', 'assignment_failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contest_registrations (
        id                      serial PRIMARY KEY,
        contest_id              integer NOT NULL REFERENCES contests(id),
        track_id                integer NOT NULL REFERENCES contest_tracks(id),
        user_id                 integer NOT NULL REFERENCES users(id),
        status                  contest_registration_status NOT NULL DEFAULT 'registered',

        test_submitted_at       timestamp,
        test_content            text,
        test_attachments        jsonb NOT NULL DEFAULT '[]',
        test_urls               jsonb NOT NULL DEFAULT '[]',
        test_grade              contest_grade,

        assignment_submitted_at timestamp,
        assignment_content      text,
        assignment_attachments  jsonb NOT NULL DEFAULT '[]',
        assignment_urls         jsonb NOT NULL DEFAULT '[]',
        assignment_grade        contest_grade,

        grade_note              varchar(500),

        created_at              timestamp NOT NULL DEFAULT now(),
        updated_at              timestamp NOT NULL DEFAULT now(),

        UNIQUE(track_id, user_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS contest_registrations_contest_idx ON contest_registrations(contest_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS contest_registrations_user_idx ON contest_registrations(user_id)`);
    logger.info("Migration 040e: created contest_registrations table");
  });

  // Migration 040f: add registration_end_at, announcement_title, announcement_details to contests
  await once("040f", true, async () => {
    await db.execute(sql`ALTER TABLE contests ADD COLUMN IF NOT EXISTS registration_end_at timestamp`);
    await db.execute(sql`ALTER TABLE contests ADD COLUMN IF NOT EXISTS announcement_title text`);
    await db.execute(sql`ALTER TABLE contests ADD COLUMN IF NOT EXISTS announcement_details text`);
    logger.info("Migration 040f: added registration_end_at, announcement_title, announcement_details to contests");
  });

  logger.info("Startup data migrations complete.");
}
