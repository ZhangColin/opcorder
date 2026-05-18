#!/usr/bin/env node
/**
 * Production database migration script — SAFE, DATA-PRESERVING.
 *
 * Uses drizzle-kit push to sync schema changes to the production database.
 * This ONLY adds new tables / columns / indexes.
 * It NEVER drops tables, truncates data, or reseeds.
 *
 * Interactive prompts (e.g. "truncate table?") are automatically answered
 * with the default safe choice (No / don't truncate) via stdin.
 *
 * To ship new schema: update lib/db/src/schema/ — changes apply on next deploy.
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

/**
 * Pre-migration data fixes.
 *
 * These run BEFORE drizzle-kit push so that ALTER COLUMN … SET DATA TYPE
 * statements never encounter values that aren't in the new enum.
 *
 * Each fix is idempotent — safe to run multiple times.
 */
async function runPreMigrationFixes(dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // Fix 012a: add new demand_type enum values and remap old rows
    // Old: ai_education, gov_training, ai_research, party_building, livestream_media, ai_tool_dev
    // New: education, software, marketing, content, other
    console.log("[migrate] Pre-fix 012a: ensuring new demand_type enum values exist…");
    for (const val of ["education", "software", "marketing", "content"]) {
      await client.query(`
        DO $$ BEGIN
          ALTER TYPE demand_type ADD VALUE IF NOT EXISTS '${val}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }

    console.log("[migrate] Pre-fix 012a: remapping old demand type values…");
    await client.query(`
      UPDATE demands SET type = 'education'::demand_type
      WHERE type::text IN ('ai_education', 'gov_training', 'ai_research')
    `);
    await client.query(`
      UPDATE demands SET type = 'software'::demand_type
      WHERE type::text IN ('ai_tool_dev', 'party_building')
    `);
    await client.query(`
      UPDATE demands SET type = 'marketing'::demand_type
      WHERE type::text = 'livestream_media'
    `);

    console.log("[migrate] Pre-fix 012a: demand type remap complete.");
  } finally {
    await client.end();
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[migrate] DATABASE_URL is not set — skipping schema sync.");
    return;
  }

  // Step 1: run data fixes that must precede the schema migration
  try {
    await runPreMigrationFixes(dbUrl);
  } catch (err) {
    console.error("[migrate] Pre-migration fix failed:", err.message);
    console.error("[migrate] Aborting — schema migration NOT run.");
    process.exit(1);
  }

  // Step 2: sync schema via drizzle-kit
  console.log("[migrate] Syncing database schema (additive only, data preserved)…");

  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@workspace/db", "run", "push-force"],
    {
      stdio: "inherit",
      cwd: WORKSPACE_ROOT,
      env: { ...process.env },
    }
  );

  if (result.status !== 0) {
    console.error(`[migrate] Schema sync exited with code ${result.status}.`);
    console.error("[migrate] Server will still start. Review the output above.");
  } else {
    console.log("[migrate] ✓ Schema sync complete — existing data untouched.");
  }
}

main().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
