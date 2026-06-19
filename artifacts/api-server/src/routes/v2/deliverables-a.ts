import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2DeliverablesATable, v2ClientDemandsTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/deliverables-a", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { clientDemandId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];

    if (clientDemandId) conditions.push(eq(v2DeliverablesATable.clientDemandId, parseInt(clientDemandId)));
    if (status) conditions.push(eq(v2DeliverablesATable.status, status as any));

    if (role === "opc") return res.status(403).json({ error: "OPC 无权查看此通道交付" });
    if (role === "publisher") {
      const myDemands = await db
        .select({ id: v2ClientDemandsTable.id })
        .from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.publisherId, userId));
      const ids = myDemands.map(d => d.id);
      if (ids.length === 0) return res.json([]);
      conditions.push(inArray(v2DeliverablesATable.clientDemandId, ids));
    }

    const rows = await db
      .select({
        id: v2DeliverablesATable.id,
        clientDemandId: v2DeliverablesATable.clientDemandId,
        title: v2DeliverablesATable.title,
        content: v2DeliverablesATable.content,
        attachments: v2DeliverablesATable.attachments,
        status: v2DeliverablesATable.status,
        createdByNickname: usersTable.nickname,
        confirmedAt: v2DeliverablesATable.confirmedAt,
        rejectedAt: v2DeliverablesATable.rejectedAt,
        rejectedReason: v2DeliverablesATable.rejectedReason,
        createdAt: v2DeliverablesATable.createdAt,
        updatedAt: v2DeliverablesATable.updatedAt,
      })
      .from(v2DeliverablesATable)
      .leftJoin(usersTable, eq(v2DeliverablesATable.createdBy, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2DeliverablesATable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/deliverables-a failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-a", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { clientDemandId, title, content, attachments } = req.body as {
      clientDemandId: number; title: string; content?: string; attachments?: any[];
    };
    if (!clientDemandId || !title?.trim()) return res.status(400).json({ error: "clientDemandId 和 title 必填" });

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title, status: v2ClientDemandsTable.status })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, clientDemandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (!["executing", "warranty"].includes(demand.status)) return res.status(400).json({ error: "需求未在执行中" });

    const [created] = await db.insert(v2DeliverablesATable).values({
      clientDemandId,
      title: title.trim(),
      content,
      attachments: attachments ?? [],
      status: "pending",
      createdBy: userId,
    }).returning();

    await notify(demand.publisherId, "v2_delivery_a_created", "您有新的交付物待确认",
      `运营方已提交需求「${demand.title}」的交付物「${title}」，请查阅并确认。`, clientDemandId, "v2_client_demand");

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-a failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-a/:id/publisher-confirm", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role !== "publisher") return res.status(403).json({ error: "仅发单方可确认交付" });

    const [deliverable] = await db.select().from(v2DeliverablesATable).where(eq(v2DeliverablesATable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "pending") return res.status(400).json({ error: "交付物不在待确认状态" });

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, deliverable.clientDemandId)).limit(1);
    if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作" });

    const [updated] = await db.update(v2DeliverablesATable)
      .set({ status: "confirmed", confirmedBy: userId, confirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(v2DeliverablesATable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_delivery_a_confirmed", "发单方已确认交付",
        `发单方已确认交付物「${deliverable.title}」。`, deliverable.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-a/:id/publisher-confirm failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-a/:id/publisher-reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role !== "publisher") return res.status(403).json({ error: "仅发单方可驳回交付" });

    const [deliverable] = await db.select().from(v2DeliverablesATable).where(eq(v2DeliverablesATable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "pending") return res.status(400).json({ error: "交付物不在待确认状态" });

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, deliverable.clientDemandId)).limit(1);
    if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作" });

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2DeliverablesATable)
      .set({ status: "revision", rejectedBy: userId, rejectedAt: new Date(), rejectedReason: reason, updatedAt: new Date() })
      .where(eq(v2DeliverablesATable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_delivery_a_rejected", "发单方驳回了交付物",
        `发单方驳回了交付物「${deliverable.title}」${reason ? `，理由：${reason}` : ""}，请修改后重新提交。`, deliverable.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-a/:id/publisher-reject failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-a/:id/resubmit", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [deliverable] = await db.select().from(v2DeliverablesATable).where(eq(v2DeliverablesATable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "revision") return res.status(400).json({ error: "非驳回状态，无法重新提交" });

    const { title, content, attachments } = req.body as { title?: string; content?: string; attachments?: any[] };
    const updates: any = { status: "pending", updatedAt: new Date() };
    if (title) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (attachments) updates.attachments = attachments;

    const [updated] = await db.update(v2DeliverablesATable).set(updates)
      .where(eq(v2DeliverablesATable.id, id)).returning();

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, deliverable.clientDemandId)).limit(1);
    if (demand) {
      await notify(demand.publisherId, "v2_delivery_a_created", "交付物已重新提交",
        `运营方已重新提交需求「${demand.title}」的交付物，请查阅并确认。`, deliverable.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-a/:id/resubmit failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
