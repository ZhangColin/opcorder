/**
 * backup-scheduler.ts
 *
 * Long-running process that triggers a PostgreSQL database backup every day
 * at 03:00 local time and retains the last 30 days of backups.
 *
 * Scheduled via the "数据库每日备份" Replit workflow:
 *   pnpm --filter @workspace/scripts exec tsx ./src/backup-scheduler.ts
 */

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, "..", "..");
const BACKUP_SCRIPT = resolve(WORKSPACE_ROOT, "scripts/backup-db.sh");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[backup-scheduler] ${new Date().toISOString()}  ${msg}`);
}

/** Milliseconds until the next occurrence of HH:MM (today or tomorrow). */
function msUntil(targetHour: number, targetMin: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMin, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function humanDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Backup runner
// ---------------------------------------------------------------------------

function runBackup() {
  log("Running database backup...");
  try {
    execSync(`bash "${BACKUP_SCRIPT}"`, {
      stdio: "inherit",
      cwd: WORKSPACE_ROOT,
      env: { ...process.env },
    });
    log("Backup completed successfully.");
  } catch (err) {
    log(`ERROR: Backup failed — ${(err as Error).message}`);
    // Do not rethrow; keep the scheduler alive so the next run can still fire.
  }
}

// ---------------------------------------------------------------------------
// Scheduler loop
// ---------------------------------------------------------------------------

const BACKUP_HOUR = 3;
const BACKUP_MIN = 0;

function scheduleNext() {
  const ms = msUntil(BACKUP_HOUR, BACKUP_MIN);
  const nextRun = new Date(Date.now() + ms);
  log(
    `Next backup scheduled for ${nextRun.toLocaleString()} ` +
      `(in ${humanDuration(ms)})`
  );

  // setTimeout max is ~24.8 days; well within the 1-day interval, so this is safe.
  setTimeout(() => {
    runBackup();
    scheduleNext(); // Reschedule for the following day.
  }, ms);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

log("Backup scheduler started.");
log(`Backup script: ${BACKUP_SCRIPT}`);
log(`Schedule: every day at ${String(BACKUP_HOUR).padStart(2, "0")}:${String(BACKUP_MIN).padStart(2, "0")} local time`);
log("Retention: 30 days (managed by backup-db.sh)");

scheduleNext();

// Keep the process alive (the setTimeout above already does, but this makes
// the intent explicit and survives any future refactor that removes it).
process.on("SIGTERM", () => {
  log("Received SIGTERM, shutting down scheduler.");
  process.exit(0);
});
