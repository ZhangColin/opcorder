import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { runSeed } from "./lib/seed";
import { runMigrations } from "./lib/migrations";
import { generateManualPdf } from "./lib/generateManualPdf";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Run migrations and seed before accepting traffic to avoid a startup race
  // where requests arrive before schema changes are in place
  await runMigrations();
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
