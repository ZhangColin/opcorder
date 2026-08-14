import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import crypto from "crypto";
import {
  db,
  computeNotebooksTable,
  computeTrainingJobsTable,
  computeInferenceServicesTable,
  computeStoragesTable,
  computeResourcesTable,
  computeTokenResourcesTable,
  computeApiKeysTable,
  computeImagesTable,
  computeOrdersTable,
  computeBillsTable,
  computeRepoItemsTable,
  computeFavoritesTable,
} from "@workspace/db";
import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { billSegment } from "../lib/compute-scheduler";

const router: IRouter = Router();

function serialize<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

function genOrderNo(prefix: string): string {
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}${ts}${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notebooks
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/notebooks", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeNotebooksTable)
      .where(eq(computeNotebooksTable.userId, req.user!.id))
      .orderBy(desc(computeNotebooksTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list notebooks");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/notebooks", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeNotebooksTable).values({
      userId: req.user!.id,
      name: b.name,
      envType: b.envType ?? null,
      image: b.image ?? null,
      resourceSpec: b.resourceSpec ?? null,
      sshEnabled: b.sshEnabled ?? false,
      description: b.description ?? null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create notebook");
    return res.status(500).json({ error: "创建失败" });
  }
});

async function ownNotebook(id: number, userId: number) {
  const [row] = await db.select().from(computeNotebooksTable).where(eq(computeNotebooksTable.id, id));
  if (!row) return { err: 404 as const };
  if (row.userId !== userId) return { err: 403 as const };
  return { row };
}

router.patch("/compute/notebooks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownNotebook(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    // status / 计费水位等生命周期字段禁止通过通用 PATCH 修改
    for (const f of ["name", "envType", "image", "resourceSpec", "sshEnabled", "description"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(computeNotebooksTable).set(patch).where(eq(computeNotebooksTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch notebook");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/notebooks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownNotebook(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    await db.transaction(async (tx) => {
      const [nb] = await tx.select().from(computeNotebooksTable)
        .where(eq(computeNotebooksTable.id, id)).for("update");
      if (nb && nb.status === "running") {
        // 运行中删除：先结清计费
        await billSegment(tx, {
          userId: nb.userId, itemType: "notebook",
          lastBilledAt: nb.lastBilledAt, resourceSpec: nb.resourceSpec,
        });
      }
      await tx.delete(computeNotebooksTable).where(eq(computeNotebooksTable.id, id));
    });
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete notebook");
    return res.status(500).json({ error: "删除失败" });
  }
});

router.post("/compute/notebooks/:id/start", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownNotebook(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const now = new Date();
    // 前置条件：running 状态不允许重复 start（会重置计费水位）
    const [row] = await db.update(computeNotebooksTable)
      .set({ status: "running", startedAt: now, lastBilledAt: now, updatedAt: now })
      .where(and(eq(computeNotebooksTable.id, id), sql`${computeNotebooksTable.status} <> 'running'`))
      .returning();
    if (!row) return res.status(409).json({ error: "已在运行中" });
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "start notebook");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/compute/notebooks/:id/stop", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownNotebook(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const result = await db.transaction(async (tx) => {
      const [nb] = await tx.select().from(computeNotebooksTable)
        .where(eq(computeNotebooksTable.id, id)).for("update");
      if (!nb) return null;
      if (nb.status !== "running") return nb; // 幂等：非运行中直接返回现状
      const now = new Date();
      const extra = nb.startedAt ? Math.floor((now.getTime() - nb.startedAt.getTime()) / 1000) : 0;
      await billSegment(tx, {
        userId: nb.userId, itemType: "notebook",
        lastBilledAt: nb.lastBilledAt, resourceSpec: nb.resourceSpec, now,
      });
      const [row] = await tx.update(computeNotebooksTable)
        .set({ status: "stopped", stoppedAt: now, lastBilledAt: null, totalRuntimeSeconds: nb.totalRuntimeSeconds + extra, updatedAt: now })
        .where(eq(computeNotebooksTable.id, id)).returning();
      return row;
    });
    if (!result) return res.status(404).json({ error: "不存在" });
    return res.json(serialize(result));
  } catch (err) {
    logger.error({ err }, "stop notebook");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Training jobs
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/training-jobs", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeTrainingJobsTable)
      .where(eq(computeTrainingJobsTable.userId, req.user!.id))
      .orderBy(desc(computeTrainingJobsTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list training jobs");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/training-jobs", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeTrainingJobsTable).values({
      userId: req.user!.id,
      name: b.name,
      mode: b.mode ?? "custom",
      image: b.image ?? null,
      resourceSpec: b.resourceSpec ?? null,
      command: b.command ?? null,
      datasetPath: b.datasetPath ?? null,
      outputPath: b.outputPath ?? null,
      description: b.description ?? null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create training job");
    return res.status(500).json({ error: "创建失败" });
  }
});

async function ownTraining(id: number, userId: number) {
  const [row] = await db.select().from(computeTrainingJobsTable).where(eq(computeTrainingJobsTable.id, id));
  if (!row) return { err: 404 as const };
  if (row.userId !== userId) return { err: 403 as const };
  return { row };
}

router.patch("/compute/training-jobs/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownTraining(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    // status / 计费水位等生命周期字段禁止通过通用 PATCH 修改
    for (const f of ["name", "mode", "image", "resourceSpec", "command", "datasetPath", "outputPath", "description"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(computeTrainingJobsTable).set(patch).where(eq(computeTrainingJobsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch training job");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/training-jobs/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownTraining(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    await db.transaction(async (tx) => {
      const [job] = await tx.select().from(computeTrainingJobsTable)
        .where(eq(computeTrainingJobsTable.id, id)).for("update");
      if (job && job.status === "running") {
        // 运行中删除：先结清计费
        await billSegment(tx, {
          userId: job.userId, itemType: "training",
          lastBilledAt: job.lastBilledAt, resourceSpec: job.resourceSpec,
        });
      }
      await tx.delete(computeTrainingJobsTable).where(eq(computeTrainingJobsTable.id, id));
    });
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete training job");
    return res.status(500).json({ error: "删除失败" });
  }
});

router.post("/compute/training-jobs/:id/stop", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownTraining(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const result = await db.transaction(async (tx) => {
      const [job] = await tx.select().from(computeTrainingJobsTable)
        .where(eq(computeTrainingJobsTable.id, id)).for("update");
      if (!job) return null;
      if (job.status !== "running" && job.status !== "pending") return job; // 幂等
      const now = new Date();
      const billed = await billSegment(tx, {
        userId: job.userId, itemType: "training",
        lastBilledAt: job.lastBilledAt, resourceSpec: job.resourceSpec, now,
      });
      const [row] = await tx.update(computeTrainingJobsTable)
        .set({
          status: "stopped", finishedAt: now, lastBilledAt: null,
          totalRuntimeSeconds: job.totalRuntimeSeconds + billed, updatedAt: now,
        })
        .where(eq(computeTrainingJobsTable.id, id)).returning();
      return row;
    });
    if (!result) return res.status(404).json({ error: "不存在" });
    return res.json(serialize(result));
  } catch (err) {
    logger.error({ err }, "stop training job");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/compute/training-jobs/:id/clone", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownTraining(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const src = owned.row!;
    const [row] = await db.insert(computeTrainingJobsTable).values({
      userId: req.user!.id,
      name: `${src.name} (副本)`,
      status: "pending",
      mode: src.mode,
      image: src.image,
      resourceSpec: src.resourceSpec,
      command: src.command,
      datasetPath: src.datasetPath,
      outputPath: src.outputPath,
      description: src.description,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "clone training job");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Inference services
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/inference-services", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeInferenceServicesTable)
      .where(eq(computeInferenceServicesTable.userId, req.user!.id))
      .orderBy(desc(computeInferenceServicesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list inference");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/inference-services", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeInferenceServicesTable).values({
      userId: req.user!.id,
      name: b.name,
      serviceType: b.serviceType ?? "custom",
      modelSource: b.modelSource ?? null,
      image: b.image ?? null,
      resourceSpec: b.resourceSpec ?? null,
      replicas: b.replicas ?? 1,
      endpointUrl: b.endpointUrl ?? null,
      description: b.description ?? null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create inference");
    return res.status(500).json({ error: "创建失败" });
  }
});

async function ownInference(id: number, userId: number) {
  const [row] = await db.select().from(computeInferenceServicesTable).where(eq(computeInferenceServicesTable.id, id));
  if (!row) return { err: 404 as const };
  if (row.userId !== userId) return { err: 403 as const };
  return { row };
}

router.patch("/compute/inference-services/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownInference(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    // status / runningReplicas / 计费水位等生命周期字段禁止通过通用 PATCH 修改
    for (const f of ["name", "serviceType", "modelSource", "image", "resourceSpec", "replicas", "endpointUrl", "description"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(computeInferenceServicesTable).set(patch).where(eq(computeInferenceServicesTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch inference");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/inference-services/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownInference(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    await db.transaction(async (tx) => {
      const [svc] = await tx.select().from(computeInferenceServicesTable)
        .where(eq(computeInferenceServicesTable.id, id)).for("update");
      if (svc && svc.status === "running") {
        // 运行中删除：先结清计费
        await billSegment(tx, {
          userId: svc.userId, itemType: "inference",
          lastBilledAt: svc.lastBilledAt, resourceSpec: svc.resourceSpec,
          replicas: svc.runningReplicas || svc.replicas,
        });
      }
      await tx.delete(computeInferenceServicesTable).where(eq(computeInferenceServicesTable.id, id));
    });
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete inference");
    return res.status(500).json({ error: "删除失败" });
  }
});

router.post("/compute/inference-services/:id/start", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownInference(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const now = new Date();
    // 前置条件：running 状态不允许重复 start（会重置计费水位）
    const [row] = await db.update(computeInferenceServicesTable)
      .set({ status: "running", runningReplicas: owned.row!.replicas, startedAt: now, lastBilledAt: now, updatedAt: now })
      .where(and(eq(computeInferenceServicesTable.id, id), sql`${computeInferenceServicesTable.status} <> 'running'`))
      .returning();
    if (!row) return res.status(409).json({ error: "已在运行中" });
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "start inference");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/compute/inference-services/:id/stop", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownInference(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const result = await db.transaction(async (tx) => {
      const [svc] = await tx.select().from(computeInferenceServicesTable)
        .where(eq(computeInferenceServicesTable.id, id)).for("update");
      if (!svc) return null;
      if (svc.status !== "running" && svc.status !== "deploying") return svc; // 幂等
      const now = new Date();
      const billed = await billSegment(tx, {
        userId: svc.userId, itemType: "inference",
        lastBilledAt: svc.lastBilledAt, resourceSpec: svc.resourceSpec,
        replicas: svc.runningReplicas || svc.replicas, now,
      });
      const [row] = await tx.update(computeInferenceServicesTable)
        .set({
          status: "stopped", runningReplicas: 0, lastBilledAt: null,
          totalRuntimeSeconds: svc.totalRuntimeSeconds + billed, updatedAt: now,
        })
        .where(eq(computeInferenceServicesTable.id, id)).returning();
      return row;
    });
    if (!result) return res.status(404).json({ error: "不存在" });
    return res.json(serialize(result));
  } catch (err) {
    logger.error({ err }, "stop inference");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Storages
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/storages", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeStoragesTable)
      .where(eq(computeStoragesTable.userId, req.user!.id))
      .orderBy(desc(computeStoragesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list storages");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/storages", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeStoragesTable).values({
      userId: req.user!.id,
      name: b.name,
      storageType: b.storageType ?? "file",
      region: b.region ?? null,
      capacityGb: b.capacityGb ?? 0,
      usedGb: b.usedGb ?? 0,
      status: b.status ?? "running",
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create storage");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.patch("/compute/storages/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeStoragesTable).where(eq(computeStoragesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "storageType", "region", "capacityGb", "usedGb", "status"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(computeStoragesTable).set(patch).where(eq(computeStoragesTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch storage");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/storages/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeStoragesTable).where(eq(computeStoragesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(computeStoragesTable).where(eq(computeStoragesTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete storage");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/resources", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeResourcesTable)
      .where(eq(computeResourcesTable.userId, req.user!.id))
      .orderBy(desc(computeResourcesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list resources");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/resources", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeResourcesTable).values({
      userId: req.user!.id,
      name: b.name,
      gpuModel: b.gpuModel ?? null,
      gpuCount: b.gpuCount ?? 0,
      cpuCores: b.cpuCores ?? 0,
      memoryGb: b.memoryGb ?? 0,
      region: b.region ?? null,
      status: b.status ?? "running",
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create resource");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.patch("/compute/resources/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeResourcesTable).where(eq(computeResourcesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "gpuModel", "gpuCount", "cpuCores", "memoryGb", "region", "status"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    if (b.expiresAt !== undefined) patch.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    const [row] = await db.update(computeResourcesTable).set(patch).where(eq(computeResourcesTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch resource");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/resources/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeResourcesTable).where(eq(computeResourcesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(computeResourcesTable).where(eq(computeResourcesTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete resource");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Token resources
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/token-resources", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeTokenResourcesTable)
      .where(eq(computeTokenResourcesTable.userId, req.user!.id))
      .orderBy(desc(computeTokenResourcesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list token resources");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/token-resources", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeTokenResourcesTable).values({
      userId: req.user!.id,
      name: b.name,
      modelName: b.modelName ?? null,
      totalTokens: b.totalTokens ?? 0,
      usedTokens: b.usedTokens ?? 0,
      status: b.status ?? "running",
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create token resource");
    return res.status(500).json({ error: "创建失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// API keys
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/api-keys", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeApiKeysTable)
      .where(eq(computeApiKeysTable.userId, req.user!.id))
      .orderBy(desc(computeApiKeysTable.createdAt));
    return res.json({ items: items.map((k) => serialize({ ...k, keyHash: undefined, keyMasked: k.keyPrefix })) });
  } catch (err) {
    logger.error({ err }, "list api keys");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/api-keys", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const secret = "sk-" + crypto.randomBytes(16).toString("hex");
    const keyPrefix = secret.slice(0, 8) + "..." + secret.slice(-4);
    const keyHash = crypto.createHash("sha256").update(secret).digest("hex");
    const [row] = await db.insert(computeApiKeysTable).values({
      userId: req.user!.id,
      name: b.name,
      keyPrefix,
      keyHash,
    }).returning();
    return res.status(201).json(serialize({ ...row, keyHash: undefined, key: secret }));
  } catch (err) {
    logger.error({ err }, "create api key");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.delete("/compute/api-keys/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeApiKeysTable).where(eq(computeApiKeysTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(computeApiKeysTable).where(eq(computeApiKeysTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete api key");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/images", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeImagesTable)
      .where(eq(computeImagesTable.userId, req.user!.id))
      .orderBy(desc(computeImagesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list images");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/images", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(computeImagesTable).values({
      userId: req.user!.id,
      name: b.name,
      tag: b.tag ?? null,
      region: b.region ?? null,
      sizeMb: b.sizeMb ?? 0,
      source: b.source ?? "custom",
      description: b.description ?? null,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create image");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.patch("/compute/images/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeImagesTable).where(eq(computeImagesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "tag", "region", "sizeMb", "source", "description"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(computeImagesTable).set(patch).where(eq(computeImagesTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch image");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/compute/images/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeImagesTable).where(eq(computeImagesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(computeImagesTable).where(eq(computeImagesTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete image");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/orders", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeOrdersTable)
      .where(eq(computeOrdersTable.userId, req.user!.id))
      .orderBy(desc(computeOrdersTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list orders");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/orders", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    const amountFen = b.amountFen ?? 0;
    if (!(typeof amountFen === "number" && Number.isInteger(amountFen) && amountFen >= 0)) {
      return res.status(400).json({ error: "金额必须为非负整数(分)" });
    }
    const [row] = await db.insert(computeOrdersTable).values({
      userId: req.user!.id,
      orderNo: genOrderNo("CO"),
      itemType: b.itemType ?? null,
      itemName: b.itemName ?? null,
      amountFen,
      status: "pending",
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create order");
    return res.status(500).json({ error: "创建失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bills & account
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/bills", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeBillsTable)
      .where(eq(computeBillsTable.userId, req.user!.id))
      .orderBy(desc(computeBillsTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list bills");
    return res.status(500).json({ error: "获取失败" });
  }
});

async function computeBalanceFen(userId: number): Promise<number> {
  const [row] = await db.select({
    balance: sql<number>`COALESCE(SUM(CASE WHEN ${computeBillsTable.direction} = 'income' THEN ${computeBillsTable.amountFen} ELSE -${computeBillsTable.amountFen} END), 0)`,
  }).from(computeBillsTable).where(eq(computeBillsTable.userId, userId));
  return Number(row?.balance ?? 0);
}

router.get("/compute/account", requireAuth, async (req, res) => {
  try {
    const balanceFen = await computeBalanceFen(req.user!.id);
    return res.json({ balanceFen });
  } catch (err) {
    logger.error({ err }, "get account");
    return res.status(500).json({ error: "获取失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Repo items
// ─────────────────────────────────────────────────────────────────────────────
const REPO_TYPES = ["model", "dataset", "image"];

router.get("/compute/repo-items", requireAuth, async (req, res) => {
  try {
    const repoType = typeof req.query.repoType === "string" ? req.query.repoType : undefined;
    if (repoType && !REPO_TYPES.includes(repoType)) return res.status(400).json({ error: "无效的仓库类型" });
    const conds = [eq(computeRepoItemsTable.ownerId, req.user!.id)];
    if (repoType) conds.push(eq(computeRepoItemsTable.repoType, repoType));
    const items = await db.select().from(computeRepoItemsTable)
      .where(and(...conds))
      .orderBy(desc(computeRepoItemsTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list repo items");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/repo-items", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    if (!b.repoType || !REPO_TYPES.includes(b.repoType)) return res.status(400).json({ error: "无效的仓库类型" });
    const [row] = await db.insert(computeRepoItemsTable).values({
      ownerId: req.user!.id,
      repoType: b.repoType,
      name: b.name,
      description: b.description ?? null,
      visibility: b.visibility ?? "private",
      sizeMb: b.sizeMb ?? 0,
      downloads: b.downloads ?? 0,
      tags: Array.isArray(b.tags) ? b.tags : [],
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create repo item");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.delete("/compute/repo-items/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(computeRepoItemsTable).where(eq(computeRepoItemsTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(computeRepoItemsTable).where(eq(computeRepoItemsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete repo item");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Favorites
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/favorites", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(computeFavoritesTable)
      .where(eq(computeFavoritesTable.userId, req.user!.id))
      .orderBy(desc(computeFavoritesTable.createdAt));
    const repoIds = items.filter(f => f.targetType === "repo_item").map(f => f.targetId);
    const repoRows = repoIds.length
      ? await db.select().from(computeRepoItemsTable).where(inArray(computeRepoItemsTable.id, repoIds))
      : [];
    const repoMap = new Map(repoRows.map(r => [r.id, r]));
    const userId = req.user!.id;
    return res.json({
      items: items.map(f => {
        let item: Record<string, unknown> | null = null;
        if (f.targetType === "repo_item" && repoMap.has(f.targetId)) {
          const repo = repoMap.get(f.targetId)!;
          // 已变为 private 且非本人拥有时,不暴露内容
          if (repo.visibility === "public" || repo.ownerId === userId) {
            item = serialize(repo as Record<string, unknown>);
          }
        }
        return { ...serialize(f), item };
      }),
    });
  } catch (err) {
    logger.error({ err }, "list favorites");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/compute/favorites/toggle", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.targetType || b.targetId === undefined) return res.status(400).json({ error: "参数缺失" });
    if (b.targetType !== "repo_item") return res.status(400).json({ error: "无效的收藏类型" });
    const targetId = parseInt(String(b.targetId));
    if (isNaN(targetId)) return res.status(400).json({ error: "无效的目标 ID" });
    // 校验目标存在且可访问(public 或本人拥有)
    const [repo] = await db.select().from(computeRepoItemsTable).where(eq(computeRepoItemsTable.id, targetId));
    if (!repo || (repo.visibility !== "public" && repo.ownerId !== req.user!.id)) {
      return res.status(404).json({ error: "收藏目标不存在" });
    }
    const [existing] = await db.select().from(computeFavoritesTable).where(and(
      eq(computeFavoritesTable.userId, req.user!.id),
      eq(computeFavoritesTable.targetType, b.targetType),
      eq(computeFavoritesTable.targetId, targetId),
    ));
    if (existing) {
      await db.delete(computeFavoritesTable).where(eq(computeFavoritesTable.id, existing.id));
      return res.json({ favorited: false });
    }
    await db.insert(computeFavoritesTable).values({
      userId: req.user!.id,
      targetType: b.targetType,
      targetId,
    });
    return res.json({ favorited: true });
  } catch (err) {
    logger.error({ err }, "toggle favorite");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compute/overview", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    async function countNotebooks() {
      const [t] = await db.select({ c: count() }).from(computeNotebooksTable).where(eq(computeNotebooksTable.userId, userId));
      const [r] = await db.select({ c: count() }).from(computeNotebooksTable).where(and(eq(computeNotebooksTable.userId, userId), eq(computeNotebooksTable.status, "running")));
      return { total: Number(t.c), running: Number(r.c) };
    }
    async function countTraining() {
      const [t] = await db.select({ c: count() }).from(computeTrainingJobsTable).where(eq(computeTrainingJobsTable.userId, userId));
      const [r] = await db.select({ c: count() }).from(computeTrainingJobsTable).where(and(eq(computeTrainingJobsTable.userId, userId), eq(computeTrainingJobsTable.status, "running")));
      return { total: Number(t.c), running: Number(r.c) };
    }
    async function countInference() {
      const [t] = await db.select({ c: count() }).from(computeInferenceServicesTable).where(eq(computeInferenceServicesTable.userId, userId));
      const [r] = await db.select({ c: count() }).from(computeInferenceServicesTable).where(and(eq(computeInferenceServicesTable.userId, userId), eq(computeInferenceServicesTable.status, "running")));
      return { total: Number(t.c), running: Number(r.c) };
    }
    async function countResources() {
      const [t] = await db.select({ c: count() }).from(computeResourcesTable).where(eq(computeResourcesTable.userId, userId));
      const [r] = await db.select({ c: count() }).from(computeResourcesTable).where(and(eq(computeResourcesTable.userId, userId), eq(computeResourcesTable.status, "running")));
      return { total: Number(t.c), running: Number(r.c) };
    }
    const [notebooks, training, inference, resources] = await Promise.all([
      countNotebooks(),
      countTraining(),
      countInference(),
      countResources(),
    ]);
    const balanceFen = await computeBalanceFen(userId);
    const recentOrders = await db.select().from(computeOrdersTable)
      .where(eq(computeOrdersTable.userId, userId))
      .orderBy(desc(computeOrdersTable.createdAt)).limit(5);
    const recentBills = await db.select().from(computeBillsTable)
      .where(eq(computeBillsTable.userId, userId))
      .orderBy(desc(computeBillsTable.createdAt)).limit(5);
    return res.json({
      notebooks,
      trainingJobs: training,
      inferenceServices: inference,
      resources,
      balanceFen,
      recentOrders: recentOrders.map(serialize),
      recentBills: recentBills.map(serialize),
    });
  } catch (err) {
    logger.error({ err }, "compute overview");
    return res.status(500).json({ error: "获取失败" });
  }
});

export default router;
