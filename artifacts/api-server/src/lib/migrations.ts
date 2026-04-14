import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Deterministic startup data migrations.
 * Each migration is idempotent and safe to run on every boot.
 * Add new migrations at the bottom — never remove existing ones.
 */
export async function runMigrations(): Promise<void> {
  logger.info("Running startup data migrations...");

  // Migration 001: backfill demands.budget from budget_max for any rows at 0
  // Added when budget_min/budget_max was consolidated into a single budget field.
  try {
    const result = await db.execute(
      sql`UPDATE demands SET budget = budget_max WHERE (budget IS NULL OR budget = 0) AND budget_max > 0`
    );
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Migration 001: backfilled budget from budget_max");
    }
  } catch (err) {
    logger.warn({ err }, "Migration 001: skipped (column may not exist yet)");
  }

  logger.info("Startup data migrations complete.");
}
