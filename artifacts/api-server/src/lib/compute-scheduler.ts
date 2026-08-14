/**
 * 算力中心模拟调度器
 * - 驱动 Notebook / 训练任务 / 推理服务状态自动流转
 *   creating|pending|deploying →(约30s)→ running；训练任务在计划时长后自动完成
 * - 按运行时长计费：每满 60s 结算一次账单流水（compute_bills, direction=expense）
 *
 * 一致性设计：
 * - 调度器 tick 在单个事务内执行，先取 pg_try_advisory_xact_lock 保证多实例（3000/8080 同库）只有一个执行
 * - 所有候选行用 SELECT ... FOR UPDATE SKIP LOCKED 锁定后再「写账单 + 推进水位」，与路由侧串行化
 * - 路由的 start/stop/delete 也在事务内用 FOR UPDATE 行锁 + 状态前置条件（见 routes/compute.ts）
 * - 计费顺序：同一事务内写账单并推进 last_billed_at，二者原子提交，不会重复开单
 */
import {
  db,
  computeNotebooksTable,
  computeTrainingJobsTable,
  computeInferenceServicesTable,
  computeBillsTable,
} from "@workspace/db";
import { eq, and, lt, isNotNull, sql as drizzleSql } from "drizzle-orm";
import { logger } from "./logger";

/** drizzle 事务句柄类型 */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PROVISION_DELAY_MS = 30 * 1000;   // 创建后多久转为运行中
const BILL_MIN_SECONDS = 60;            // 每满 60 秒结算一次
export const TICK_MS = 30 * 1000;

/** 按资源规格估算小时单价（分/小时），GPU 规格更贵 */
export function rateFenPerHour(resourceSpec: string | null | undefined): number {
  const s = (resourceSpec ?? "").toLowerCase();
  if (/h100|h800/.test(s)) return 2400;
  if (/a100|a800/.test(s)) return 1600;
  if (/v100|4090|3090|l20|l40|gpu/.test(s)) return 800;
  return 100; // CPU
}

function genBillNo(): string {
  return `B${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
}

const ITEM_LABEL: Record<string, string> = {
  notebook: "模型开发",
  training: "模型训练",
  inference: "推理服务",
};

function billAmount(seconds: number, ratePerHour: number): number {
  return Math.ceil((seconds * ratePerHour) / 3600);
}

/**
 * 在事务内为一段运行时长写账单。调用方必须已持有该资源行的锁（FOR UPDATE），
 * 并在同一事务内推进 last_billed_at / 状态，保证「账单 + 水位」原子提交。
 * 返回计费秒数。
 */
export async function billSegment(tx: DbTx, opts: {
  userId: number;
  itemType: "notebook" | "training" | "inference";
  lastBilledAt: Date | null;
  resourceSpec: string | null | undefined;
  replicas?: number;
  now?: Date;
}): Promise<number> {
  if (!opts.lastBilledAt) return 0;
  const now = opts.now ?? new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - opts.lastBilledAt.getTime()) / 1000));
  if (seconds <= 0) return 0;
  const rate = rateFenPerHour(opts.resourceSpec) * Math.max(1, opts.replicas ?? 1);
  const amountFen = billAmount(seconds, rate);
  if (amountFen > 0) {
    await tx.insert(computeBillsTable).values({
      userId: opts.userId,
      billNo: genBillNo(),
      itemType: ITEM_LABEL[opts.itemType] ?? opts.itemType,
      amountFen,
      direction: "expense",
      billedAt: now,
    });
  }
  return seconds;
}

/* ── 状态流转（tx 内执行，行已由 FOR UPDATE 锁定） ── */

async function transitionCreating(tx: DbTx) {
  const cutoff = new Date(Date.now() - PROVISION_DELAY_MS);
  const now = new Date();

  // Notebook: creating → running
  const nbs = await tx.select().from(computeNotebooksTable)
    .where(and(eq(computeNotebooksTable.status, "creating"), lt(computeNotebooksTable.createdAt, cutoff)))
    .for("update", { skipLocked: true });
  for (const nb of nbs) {
    await tx.update(computeNotebooksTable)
      .set({ status: "running", startedAt: now, lastBilledAt: now, updatedAt: now })
      .where(eq(computeNotebooksTable.id, nb.id));
    logger.info({ id: nb.id }, "compute: notebook auto-started");
  }

  // 训练任务: pending → running（计划运行 2-5 分钟后自动完成）
  const jobs = await tx.select().from(computeTrainingJobsTable)
    .where(and(eq(computeTrainingJobsTable.status, "pending"), lt(computeTrainingJobsTable.createdAt, cutoff)))
    .for("update", { skipLocked: true });
  for (const j of jobs) {
    const planned = 120 + Math.floor(Math.random() * 180);
    await tx.update(computeTrainingJobsTable)
      .set({ status: "running", startedAt: now, lastBilledAt: now, plannedDurationSeconds: planned, updatedAt: now })
      .where(eq(computeTrainingJobsTable.id, j.id));
    logger.info({ id: j.id, planned }, "compute: training auto-started");
  }

  // 推理服务: deploying → running
  const svcs = await tx.select().from(computeInferenceServicesTable)
    .where(and(eq(computeInferenceServicesTable.status, "deploying"), lt(computeInferenceServicesTable.createdAt, cutoff)))
    .for("update", { skipLocked: true });
  for (const s of svcs) {
    await tx.update(computeInferenceServicesTable)
      .set({ status: "running", runningReplicas: s.replicas, startedAt: now, lastBilledAt: now, updatedAt: now })
      .where(eq(computeInferenceServicesTable.id, s.id));
    logger.info({ id: s.id }, "compute: inference auto-started");
  }
}

/** 训练任务到达计划时长后自动完成并结清计费 */
async function completeTrainingJobs(tx: DbTx) {
  const now = new Date();
  const jobs = await tx.select().from(computeTrainingJobsTable)
    .where(and(eq(computeTrainingJobsTable.status, "running"), isNotNull(computeTrainingJobsTable.startedAt)))
    .for("update", { skipLocked: true });
  for (const j of jobs) {
    const planned = j.plannedDurationSeconds ?? 180;
    const elapsed = Math.floor((now.getTime() - j.startedAt!.getTime()) / 1000);
    if (elapsed < planned) continue;
    const billed = await billSegment(tx, {
      userId: j.userId, itemType: "training",
      lastBilledAt: j.lastBilledAt, resourceSpec: j.resourceSpec, now,
    });
    await tx.update(computeTrainingJobsTable)
      .set({
        status: "completed", finishedAt: now, lastBilledAt: null,
        totalRuntimeSeconds: j.totalRuntimeSeconds + billed, updatedAt: now,
      })
      .where(eq(computeTrainingJobsTable.id, j.id));
    logger.info({ id: j.id, elapsed }, "compute: training auto-completed");
  }
}

/* ── 周期计费 ─────────────────────────────────────── */

async function billRunning(tx: DbTx) {
  const now = new Date();

  const nbs = await tx.select().from(computeNotebooksTable)
    .where(and(eq(computeNotebooksTable.status, "running"), isNotNull(computeNotebooksTable.lastBilledAt)))
    .for("update", { skipLocked: true });
  for (const nb of nbs) {
    const secs = Math.floor((now.getTime() - nb.lastBilledAt!.getTime()) / 1000);
    if (secs < BILL_MIN_SECONDS) continue;
    await billSegment(tx, {
      userId: nb.userId, itemType: "notebook",
      lastBilledAt: nb.lastBilledAt, resourceSpec: nb.resourceSpec, now,
    });
    await tx.update(computeNotebooksTable)
      .set({ lastBilledAt: now, updatedAt: now })
      .where(eq(computeNotebooksTable.id, nb.id));
  }

  const jobs = await tx.select().from(computeTrainingJobsTable)
    .where(and(eq(computeTrainingJobsTable.status, "running"), isNotNull(computeTrainingJobsTable.lastBilledAt)))
    .for("update", { skipLocked: true });
  for (const j of jobs) {
    const secs = Math.floor((now.getTime() - j.lastBilledAt!.getTime()) / 1000);
    if (secs < BILL_MIN_SECONDS) continue;
    await billSegment(tx, {
      userId: j.userId, itemType: "training",
      lastBilledAt: j.lastBilledAt, resourceSpec: j.resourceSpec, now,
    });
    await tx.update(computeTrainingJobsTable)
      .set({ lastBilledAt: now, totalRuntimeSeconds: j.totalRuntimeSeconds + secs, updatedAt: now })
      .where(eq(computeTrainingJobsTable.id, j.id));
  }

  const svcs = await tx.select().from(computeInferenceServicesTable)
    .where(and(eq(computeInferenceServicesTable.status, "running"), isNotNull(computeInferenceServicesTable.lastBilledAt)))
    .for("update", { skipLocked: true });
  for (const s of svcs) {
    const secs = Math.floor((now.getTime() - s.lastBilledAt!.getTime()) / 1000);
    if (secs < BILL_MIN_SECONDS) continue;
    await billSegment(tx, {
      userId: s.userId, itemType: "inference",
      lastBilledAt: s.lastBilledAt, resourceSpec: s.resourceSpec,
      replicas: s.runningReplicas || s.replicas || 1, now,
    });
    await tx.update(computeInferenceServicesTable)
      .set({ lastBilledAt: now, totalRuntimeSeconds: s.totalRuntimeSeconds + secs, updatedAt: now })
      .where(eq(computeInferenceServicesTable.id, s.id));
  }
}

const LOCK_KEY = 88231001; // 全局咨询锁：多实例（3000/8080）同库时只允许一个实例执行 tick

async function computeTick() {
  try {
    // 事务级咨询锁：同一连接内获取，事务结束自动释放，避免连接池导致锁泄漏
    await db.transaction(async (tx) => {
      const locked = await tx.execute<{ locked: boolean }>(
        drizzleSql`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`
      );
      if (!(locked.rows?.[0] as { locked?: boolean } | undefined)?.locked) return;
      await transitionCreating(tx);
      await completeTrainingJobs(tx);
      await billRunning(tx);
    });
  } catch (err) {
    logger.error({ err }, "compute scheduler tick failed");
  }
}

export function startComputeScheduler() {
  computeTick();
  setInterval(computeTick, TICK_MS);
  logger.info("Compute scheduler started (tick every 30s)");
}
