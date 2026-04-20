import { spawn } from "child_process";
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
 *
 * Uses async spawn (not spawnSync) so the Node.js event loop is never
 * blocked — the HTTP server can respond to health checks while drizzle-kit
 * runs in a child process.
 */
export async function syncSchema(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    logger.warn("syncSchema: DATABASE_URL not set — skipping schema sync");
    return;
  }

  logger.info("syncSchema: syncing database schema (additive only)…");

  const workspaceRoot = path.resolve(__dirname, "../../..");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@workspace/db", "run", "push-force"],
      {
        stdio: "inherit",
        cwd: workspaceRoot,
        env: { ...process.env },
      },
    );

    child.on("close", (code) => {
      if (code !== 0) {
        const msg = `syncSchema: drizzle-kit push exited with code ${code}`;
        logger.error(msg);
        reject(new Error(msg));
      } else {
        logger.info("syncSchema: schema sync complete — existing data untouched");
        resolve();
      }
    });

    child.on("error", (err) => {
      logger.error({ err }, "syncSchema: failed to spawn drizzle-kit push");
      reject(err);
    });
  });
}
