import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { runSeed } from "./lib/seed";
import { runMigrations } from "./lib/migrations";
import { syncSchema } from "./lib/syncSchema";
import { generateManualPdf } from "./lib/generateManualPdf";

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason instanceof Error ? reason : new Error(String(reason)) }, "Unhandled promise rejection");
});

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // 1. Sync Drizzle schema → DB (additive only, idempotent).
  //    Must run before data-level migrations because those reference tables
  //    that only exist after the schema is applied.  In production Replit
  //    deployments DATABASE_URL is unavailable during the build phase, so
  //    the build-time migrate.mjs may have been skipped.
  await syncSchema();

  // 2. Run data-level migrations (idempotent ALTER TABLE / enum value additions).
  await runMigrations();

  // 3. Seed required application data (roles, demo users, etc.).
  await runSeed();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startScheduler();

    generateManualPdf()
      .then((outPath) => logger.info({ outPath }, "OPC manual PDF generated"))
      .catch((e) => logger.error({ err: e }, "Failed to generate manual PDF"));
  });
}

start().catch((e) => {
  logger.error({ err: e }, "Startup initialization failed");
  process.exit(1);
});
