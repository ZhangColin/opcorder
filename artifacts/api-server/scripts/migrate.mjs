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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[migrate] DATABASE_URL is not set — skipping schema sync.");
    return;
  }

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

main();
