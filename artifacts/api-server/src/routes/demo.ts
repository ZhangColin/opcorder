import { Router, type IRouter, type Request, type Response } from "express";
import { db, demoProjectsTable, demoProjectVersionsTable, v2ClientDemandsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminAuth";
import { generateDemo, classifyDemoFeedback } from "../lib/demoAgent";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** Verify caller has access to this demand's Demo (publisher or admin; OPC blocked). */
async function getDemandAndCheckAccess(
  req: Request,
  res: Response
): Promise<{ demandId: number; isAdmin: boolean } | null> {
  const demandId = parseInt(req.params.id);
  if (!Number.isFinite(demandId)) {
    res.status(400).json({ error: "无效需求 ID" });
    return null;
  }
  const user = req.user!;
  if (user.role === "opc") {
    res.status(403).json({ error: "OPC 无权访问 Demo" });
    return null;
  }
  if (user.role === "publisher") {
    const [demand] = await db
      .select({ publisherId: v2ClientDemandsTable.publisherId })
      .from(v2ClientDemandsTable)
      .where(eq(v2ClientDemandsTable.id, demandId))
      .limit(1);
    if (!demand) { res.status(404).json({ error: "需求不存在" }); return null; }
    if (demand.publisherId !== user.id) { res.status(403).json({ error: "无权访问" }); return null; }
  }
  return { demandId, isAdmin: user.role === "admin" };
}

/* ─── GET /api/demands/:id/demo ─────────────────────────────────────────── */
router.get("/demands/:id/demo", requireAuth, async (req, res) => {
  const ctx = await getDemandAndCheckAccess(req, res);
  if (!ctx) return;
  try {
    const [demo] = await db
      .select()
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, ctx.demandId))
      .limit(1);
    if (!demo) return res.status(404).json({ error: "Demo 尚未生成" });
    return res.json({
      status: demo.status,
      version: demo.version,
      files: ["generating", "updating"].includes(demo.status) ? null : demo.files,
      dependencies: demo.dependencies,
      entryFile: demo.entryFile,
      errorMsg: demo.errorMsg,
      updatedAt: demo.updatedAt,
    });
  } catch (err) {
    logger.error({ err }, "GET /demands/:id/demo failed");
    return res.status(500).json({ error: "获取 Demo 状态失败" });
  }
});

/* ─── POST /api/demands/:id/demo/feedback ──────────────────────────────── */
router.post("/demands/:id/demo/feedback", requireAuth, async (req, res) => {
  const ctx = await getDemandAndCheckAccess(req, res);
  if (!ctx) return;
  const { feedback } = req.body as { feedback?: string };
  if (!feedback?.trim()) return res.status(400).json({ error: "修改意见不能为空" });

  try {
    const [demo] = await db
      .select({ status: demoProjectsTable.status })
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, ctx.demandId))
      .limit(1);
    if (!demo) return res.status(404).json({ error: "Demo 尚未生成" });
    if (["generating", "updating"].includes(demo.status)) {
      return res.status(409).json({ error: "Demo 正在生成中，请稍后再提交意见" });
    }

    const { valid, hint } = await classifyDemoFeedback(feedback.trim());
    if (!valid) {
      return res.json({ accepted: false, message: hint || "请提供针对页面视觉或交互的具体修改意见" });
    }

    await db.update(demoProjectsTable)
      .set({ status: "updating", updatedAt: new Date() })
      .where(eq(demoProjectsTable.demandId, ctx.demandId));

    setImmediate(() => {
      generateDemo(ctx.demandId, feedback.trim()).catch((err) =>
        logger.error({ err, demandId: ctx.demandId }, "generateDemo (feedback) failed in background")
      );
    });

    return res.json({ accepted: true, message: "意见已接受，Demo 更新中" });
  } catch (err) {
    logger.error({ err }, "POST /demands/:id/demo/feedback failed");
    return res.status(500).json({ error: "提交意见失败" });
  }
});

/* ─── POST /api/demands/:id/demo/regenerate (admin only) ──────────────── */
router.post("/demands/:id/demo/regenerate", requireAuth, requireAdmin, async (req, res) => {
  const demandId = parseInt(req.params.id);
  if (!Number.isFinite(demandId)) return res.status(400).json({ error: "无效需求 ID" });
  try {
    const [demo] = await db
      .select({ id: demoProjectsTable.id })
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, demandId))
      .limit(1);
    if (demo) {
      await db.update(demoProjectsTable)
        .set({ status: "generating", updatedAt: new Date() })
        .where(eq(demoProjectsTable.demandId, demandId));
    } else {
      await db.insert(demoProjectsTable).values({
        demandId,
        status: "generating",
        version: 1,
        files: null,
        entryFile: "src/App.tsx",
        dependencies: {},
        revisionLog: [],
      });
    }
    setImmediate(() => {
      generateDemo(demandId).catch((err) =>
        logger.error({ err, demandId }, "generateDemo (regenerate) failed in background")
      );
    });
    return res.json({ ok: true, message: "已触发重新生成" });
  } catch (err) {
    logger.error({ err }, "POST /demands/:id/demo/regenerate failed");
    return res.status(500).json({ error: "触发重新生成失败" });
  }
});

/* ─── GET /api/demands/:id/demo/versions (admin only) ─────────────────── */
router.get("/demands/:id/demo/versions", requireAuth, requireAdmin, async (req, res) => {
  const demandId = parseInt(req.params.id);
  if (!Number.isFinite(demandId)) return res.status(400).json({ error: "无效需求 ID" });
  try {
    const [demo] = await db
      .select({ id: demoProjectsTable.id, revisionLog: demoProjectsTable.revisionLog, version: demoProjectsTable.version })
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, demandId))
      .limit(1);
    if (!demo) return res.status(404).json({ error: "Demo 不存在" });

    const versions = await db
      .select()
      .from(demoProjectVersionsTable)
      .where(eq(demoProjectVersionsTable.demoProjectId, demo.id))
      .orderBy(asc(demoProjectVersionsTable.version));

    const revLog = (demo.revisionLog ?? []) as Array<{ version: number; feedback: string; valid: boolean; timestamp: string }>;
    const result = versions.map((v) => {
      const logEntry = revLog.find((r) => r.version === v.version);
      return {
        version: v.version,
        isCurrent: v.version === demo.version,
        feedback: logEntry?.feedback ?? null,
        createdAt: v.createdAt,
        files: v.files,
        dependencies: v.dependencies,
      };
    });

    return res.json({ data: result });
  } catch (err) {
    logger.error({ err }, "GET /demands/:id/demo/versions failed");
    return res.status(500).json({ error: "获取版本列表失败" });
  }
});

/* ─── GET /api/demands/:id/demo/versions/:v/download (admin only) ─────── */
router.get("/demands/:id/demo/versions/:v/download", requireAuth, requireAdmin, async (req, res) => {
  const demandId = parseInt(req.params.id);
  const versionNo = parseInt(req.params.v);
  if (!Number.isFinite(demandId) || !Number.isFinite(versionNo)) {
    return res.status(400).json({ error: "无效参数" });
  }
  try {
    const [demo] = await db
      .select({ id: demoProjectsTable.id })
      .from(demoProjectsTable)
      .where(eq(demoProjectsTable.demandId, demandId))
      .limit(1);
    if (!demo) return res.status(404).json({ error: "Demo 不存在" });

    const [ver] = await db
      .select()
      .from(demoProjectVersionsTable)
      .where(eq(demoProjectVersionsTable.demoProjectId, demo.id))
      .limit(1000);

    const target = (await db.select().from(demoProjectVersionsTable)
      .where(eq(demoProjectVersionsTable.demoProjectId, demo.id))
    ).find((v) => v.version === versionNo);

    if (!target) return res.status(404).json({ error: `版本 v${versionNo} 不存在` });

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const files = (target.files ?? {}) as Record<string, string>;
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="demo-v${versionNo}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.send(zipBuffer);
  } catch (err) {
    logger.error({ err }, "GET /demands/:id/demo/versions/:v/download failed");
    return res.status(500).json({ error: "生成 zip 失败" });
  }
});

export default router;
