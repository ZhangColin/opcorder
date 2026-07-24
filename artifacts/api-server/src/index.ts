import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { runSeed } from "./lib/seed";
import { runMigrations } from "./lib/migrations";
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

// Hard-fail at startup when required e签宝 credentials are missing in production.
// An absent APP_SECRET means verifyWebhookSignature() always returns false, so
// every callback would be silently rejected — worse, a misconfigured deploy
// could let forged callbacks through if the skip-in-dev branch were ever reached.
if (process.env["NODE_ENV"] === "production") {
  const missingEsignVars: string[] = [];
  if (!process.env["ESIGN_APP_ID"])     missingEsignVars.push("ESIGN_APP_ID");
  if (!process.env["ESIGN_APP_SECRET"]) missingEsignVars.push("ESIGN_APP_SECRET");
  // ESIGN_ORG_ID is not required in V3 — platform auto-sign is configured at the
  // e签宝 console level and does not need to be passed in API calls.

  if (missingEsignVars.length > 0) {
    logger.fatal(
      { missingVars: missingEsignVars },
      "FATAL: Required e签宝 environment variables are not set. " +
      "The server will NOT start to prevent forged webhook callbacks from being accepted. " +
      `Missing: ${missingEsignVars.join(", ")}`,
    );
    process.exit(1);
  }
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
  // Schema sync is handled at build time by migrate.mjs and by Replit's
  // publish-time diff — no startup-time DDL needed here.
  try {
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
