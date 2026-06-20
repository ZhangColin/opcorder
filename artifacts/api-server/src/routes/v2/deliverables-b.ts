import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2DeliverablesBTable, v2OutsourceOrdersTable, usersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/deliverables-b", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { outsourceOrderId, status } = req.query as Record<string, string>;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看此通道交付" });

    const conditions: any[] = [];
    if (outsourceOrderId) conditions.push(eq(v2DeliverablesBTable.outsourceOrderId, parseInt(outsourceOrderId)));
    if (status) conditions.push(eq(v2DeliverablesBTable.status, status as any));

    if (role === "opc") {
      const myOrders = await db
        .select({ id: v2OutsourceOrdersTable.id })
        .from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.opcId, userId));
      const ids = myOrders.map(o => o.id);
      if (ids.length > 0 && outsourceOrderId) {
        const requestedId = parseInt(outsourceOrderId);
        if (!ids.includes(requestedId)) return res.status(403).json({ error: "无权访问" });
      }
    }

    const rows = await db
      .select({
        id: v2DeliverablesBTable.id,
        outsourceOrderId: v2DeliverablesBTable.outsourceOrderId,
        title: v2DeliverablesBTable.title,
        content: v2DeliverablesBTable.content,
        attachments: v2DeliverablesBTable.attachments,
        status: v2DeliverablesBTable.status,
        submittedByNickname: usersTable.nickname,
        approvedAt: v2DeliverablesBTable.approvedAt,
        rejectedAt: v2DeliverablesBTable.rejectedAt,
        rejectedReason: v2DeliverablesBTable.rejectedReason,
        createdAt: v2DeliverablesBTable.createdAt,
        updatedAt: v2DeliverablesBTable.updatedAt,
      })
      .from(v2DeliverablesBTable)
      .leftJoin(usersTable, eq(v2DeliverablesBTable.submittedBy, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2DeliverablesBTable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/deliverables-b failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-b", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权提交此通道交付" });

    const { outsourceOrderId, title, content, attachments } = req.body as {
      outsourceOrderId: number; title: string; content?: string; attachments?: any[];
    };
    if (!outsourceOrderId || !title?.trim()) return res.status(400).json({ error: "outsourceOrderId 和 title 必填" });

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo, status: v2OutsourceOrdersTable.status })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, outsourceOrderId)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (role === "opc" && order.opcId !== userId) return res.status(403).json({ error: "无权操作" });
    if (!["executing", "warranty"].includes(order.status)) return res.status(400).json({ error: "订单未在执行阶段" });

    const [created] = await db.insert(v2DeliverablesBTable).values({
      outsourceOrderId,
      title: title.trim(),
      content,
      attachments: attachments ?? [],
      status: "pending",
      createdBy: userId,
    }).returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_delivery_b_submitted", "OPC 提交了交付物",
        `OPC 已提交外包订单 ${order.orderNo} 的交付物「${title}」，请查阅并确认。`, outsourceOrderId, "v2_outsource_order");
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-b failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-b/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [deliverable] = await db.select().from(v2DeliverablesBTable).where(eq(v2DeliverablesBTable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "pending") return res.status(400).json({ error: "交付物不在待审核状态" });

    const [updated] = await db.update(v2DeliverablesBTable)
      .set({ status: "approved", approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(v2DeliverablesBTable.id, id))
      .returning();

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, deliverable.outsourceOrderId)).limit(1);
    if (order) {
      await notify(order.opcId, "v2_delivery_b_approved", "交付物已通过审核",
        `您提交的外包订单 ${order.orderNo} 的交付物「${deliverable.title}」已通过审核。`, deliverable.outsourceOrderId, "v2_outsource_order");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-b/:id/approve failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-b/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [deliverable] = await db.select().from(v2DeliverablesBTable).where(eq(v2DeliverablesBTable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "pending") return res.status(400).json({ error: "交付物不在待审核状态" });

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2DeliverablesBTable)
      .set({ status: "revision", rejectedBy: userId, rejectedAt: new Date(), rejectedReason: reason, updatedAt: new Date() })
      .where(eq(v2DeliverablesBTable.id, id))
      .returning();

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, deliverable.outsourceOrderId)).limit(1);
    if (order) {
      await notify(order.opcId, "v2_delivery_b_rejected", "交付物被驳回，需修改",
        `外包订单 ${order.orderNo} 的交付物「${deliverable.title}」被驳回${reason ? `，原因：${reason}` : ""}，请修改后重新提交。`, deliverable.outsourceOrderId, "v2_outsource_order");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-b/:id/reject failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/deliverables-b/:id/resubmit", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role === "publisher") return res.status(403).json({ error: "无权操作" });

    const [deliverable] = await db.select().from(v2DeliverablesBTable).where(eq(v2DeliverablesBTable.id, id)).limit(1);
    if (!deliverable) return res.status(404).json({ error: "交付记录不存在" });
    if (deliverable.status !== "revision") return res.status(400).json({ error: "非驳回状态，无法重新提交" });

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, deliverable.outsourceOrderId)).limit(1);
    if (req.user!.role === "opc" && order?.opcId !== userId) return res.status(403).json({ error: "无权操作" });

    const { title, content, attachments } = req.body as { title?: string; content?: string; attachments?: any[] };
    const updates: any = { status: "pending", updatedAt: new Date() };
    if (title) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (attachments) updates.attachments = attachments;

    const [updated] = await db.update(v2DeliverablesBTable).set(updates)
      .where(eq(v2DeliverablesBTable.id, id)).returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_delivery_b_submitted", "OPC 重新提交了交付物",
        `OPC 已重新提交外包订单的交付物「${updated.title}」，请重新审核。`, deliverable.outsourceOrderId, "v2_outsource_order");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/deliverables-b/:id/resubmit failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
