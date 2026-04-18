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
  // Start listening immediately so production health checks pass without timing out.
  // Schema sync and migrations run after the server is accepting connections.
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });

  // Run startup tasks after the port is open.
  // In production Replit deployments DATABASE_URL is unavailable during the
  // build phase, so build-time migrate.mjs may have been skipped — we must
  // sync schema at runtime.
  try {
    await syncSchema();
    await runMigrations();
    await runSeed();
  } catch (e) {
    logger.error({ err: e }, "Startup initialization failed — server continues but may be degraded");
  }

  startScheduler();

  generateManualPdf()
    .then((outPath) => logger.info({ outPath }, "OPC manual PDF generated"))
    .catch((e) => logger.error({ err: e }, "Failed to generate manual PDF"));
}

start().catch((e) => {
  logger.error({ err: e }, "Startup initialization failed");
  process.exit(1);
});
