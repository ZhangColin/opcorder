import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run drizzle-kit push to sync the Drizzle schema to the database.
 *
 * This is called at startup (before runMigrations) so that all base tables
 * exist before the data-level migration scripts run.  It is safe to call on
 * every boot because drizzle-kit push is additive-only and idempotent.
 *
 * In production Replit deployments, DATABASE_URL is only available at
 * runtime (not during the build phase), so we cannot rely on the build-time
 * migrate.mjs script to have already synced the schema.
 */
export async function syncSchema(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    logger.warn("syncSchema: DATABASE_URL not set — skipping schema sync");
    return;
  }

  logger.info("syncSchema: syncing database schema (additive only)…");

  const workspaceRoot = path.resolve(__dirname, "../../..");

  const result = spawnSync(
    "pnpm",
    ["--filter", "@workspace/db", "run", "push"],
    {
      input: "\n\n\n\n\n",
      stdio: ["pipe", "inherit", "inherit"],
      cwd: workspaceRoot,
      env: { ...process.env },
    },
  );

  if (result.status !== 0) {
    const msg = `syncSchema: drizzle-kit push exited with code ${result.status}`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info("syncSchema: schema sync complete — existing data untouched");
}
