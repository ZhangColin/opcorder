#!/usr/bin/env node
/**
 * Production database migration / seed script.
 * Uses a version-based strategy to decide whether to reseed.
 *
 * Logic:
 *  - Read SEED_TARGET_VERSION from seed.sql (set by _seed_meta insert)
 *  - Read current version from _seed_meta table in production DB
 *  - If versions differ (or table missing) → full resync:
 *      DROP SCHEMA public CASCADE → CREATE SCHEMA public → apply seed.sql
 *  - If versions match → skip (already up to date)
 *
 * To force a resync on next deploy: bump the seed_version value in seed.sql
 * and append the new _seed_meta upsert at the end of seed.sql.
 */

import { execSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const pg = require("pg");
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.resolve(__dirname, "..", "seed.sql");

const SEED_TARGET_VERSION = "2";

async function getCurrentVersion(pool) {
  try {
    const tableCheck = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_seed_meta'
    `);
    if (parseInt(tableCheck.rows[0].cnt, 10) === 0) return null;

    const versionRow = await pool.query(
      "SELECT value FROM _seed_meta WHERE key = 'seed_version'"
    );
    if (versionRow.rows.length === 0) return null;
    return versionRow.rows[0].value;
  } catch {
    return null;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[migrate] DATABASE_URL is not set — skipping migration.");
    return;
  }

  if (!fs.existsSync(SEED_FILE)) {
    console.error(`[migrate] Seed file not found at ${SEED_FILE} — skipping.`);
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const currentVersion = await getCurrentVersion(pool);
    console.log(
      `[migrate] DB seed version: ${currentVersion ?? "(none)"} → target: ${SEED_TARGET_VERSION}`
    );

    if (currentVersion === SEED_TARGET_VERSION) {
      console.log("[migrate] Already at target version — skipping reseed.");
      return;
    }

    console.log("[migrate] Version mismatch — performing full resync …");
    await pool.end();

    execSync(
      `psql "${dbUrl}" -v ON_ERROR_STOP=0 --quiet -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
      { stdio: "inherit", shell: true }
    );

    execSync(
      `psql "${dbUrl}" -v ON_ERROR_STOP=0 --quiet -f "${SEED_FILE}"`,
      { stdio: "inherit", shell: true }
    );

    console.log(
      `[migrate] ✓ Database resynced to seed version ${SEED_TARGET_VERSION}.`
    );
  } catch (err) {
    console.error("[migrate] Migration error:", err.message ?? err);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

main();
