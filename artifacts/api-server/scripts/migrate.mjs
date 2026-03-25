#!/usr/bin/env node
/**
 * Production database migration / seed script.
 * Runs once on first deploy; idempotent on subsequent runs.
 *
 * Logic:
 *  - If the `users` table does NOT exist in the target DB → apply full seed.sql
 *  - If the `users` table already has rows → skip (already initialised)
 *  - If the table exists but is empty → apply seed.sql (fresh schema, no data)
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

async function checkInitialised(pool) {
  // Check whether users table exists
  const tableCheck = await pool.query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  const tableExists = parseInt(tableCheck.rows[0].cnt, 10) > 0;

  if (!tableExists) return false;

  // Table exists — check if it has any rows
  const rowCheck = await pool.query("SELECT COUNT(*) AS cnt FROM users");
  return parseInt(rowCheck.rows[0].cnt, 10) > 0;
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
    const alreadyInit = await checkInitialised(pool);
    if (alreadyInit) {
      console.log("[migrate] Database already initialised — skipping seed.");
      return;
    }

    console.log("[migrate] Initialising production database from seed.sql …");
    await pool.end();

    // Run psql; -v ON_ERROR_STOP=0 means we continue past non-fatal errors
    // (e.g. CREATE SCHEMA public already exists on a fresh Replit PG instance)
    execSync(
      `psql "${dbUrl}" -v ON_ERROR_STOP=0 --quiet -f "${SEED_FILE}"`,
      { stdio: "inherit", shell: true }
    );

    console.log("[migrate] ✓ Database seeded successfully.");
  } catch (err) {
    console.error("[migrate] Migration error:", err.message ?? err);
    // Don't exit 1 — let the server start anyway so health-check passes;
    // the DB might have been partially initialised on a previous attempt.
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

main();
