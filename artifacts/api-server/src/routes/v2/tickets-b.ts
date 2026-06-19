import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2TicketsBTable, v2OutsourceOrdersTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/tickets-b", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看此通道工单" });

    const { outsourceOrderId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (outsourceOrderId) conditions.push(eq(v2TicketsBTable.outsourceOrderId, parseInt(outsourceOrderId)));
    if (status) conditions.push(eq(v2TicketsBTable.status, status as any));

    if (role === "opc") {
      const myOrders = await db
        .select({ id: v2OutsourceOrdersTable.id })
        .from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.opcId, userId));
      const ids = myOrders.map(o => o.id);
      if (ids.length === 0) return res.json([]);
    }

    const rows = await db
      .select({
        id: v2TicketsBTable.id,
        outsourceOrderId: v2TicketsBTable.outsourceOrderId,
        title: v2TicketsBTable.title,
        description: v2TicketsBTable.description,
        status: v2TicketsBTable.status,
        createdByNickname: usersTable.nickname,
        closedAt: v2TicketsBTable.closedAt,
        closedNote: v2TicketsBTable.closedNote,
        createdAt: v2TicketsBTable.createdAt,
      })
      .from(v2TicketsBTable)
      .leftJoin(usersTable, eq(v2TicketsBTable.createdBy, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2TicketsBTable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/tickets-b failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tickets-b", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权发起此通道工单" });

    const { outsourceOrderId, title, description } = req.body as {
      outsourceOrderId: number; title: string; description?: string;
    };
    if (!outsourceOrderId || !title?.trim()) return res.status(400).json({ error: "outsourceOrderId 和 title 必填" });

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo, status: v2OutsourceOrdersTable.status })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, outsourceOrderId)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (role === "opc" && order.opcId !== userId) return res.status(403).json({ error: "无权操作" });
    if (role === "opc" && order.status !== "warranty") return res.status(400).json({ error: "仅质保期内可发起工单" });

    const [created] = await db.insert(v2TicketsBTable).values({
      outsourceOrderId,
      title: title.trim(),
      description,
      status: "open",
      createdBy: userId,
    }).returning();

    if (role === "opc") {
      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      for (const admin of admins) {
        await notify(admin.id, "v2_ticket_b_created", "OPC 发起了质保工单",
          `OPC 在外包订单 ${order.orderNo} 质保期内发起了工单「${title}」，请处理。`, outsourceOrderId, "v2_outsource_order");
      }
    } else {
      await notify(order.opcId, "v2_ticket_b_created", "外包订单有新工单",
        `运营方为外包订单 ${order.orderNo} 发起了工单「${title}」，请关注。`, outsourceOrderId, "v2_outsource_order");
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/tickets-b failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tickets-b/:id/close", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [ticket] = await db.select().from(v2TicketsBTable).where(eq(v2TicketsBTable.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: "工单不存在" });
    if (ticket.status === "closed") return res.status(400).json({ error: "工单已关闭" });

    const { note } = req.body as { note?: string };
    const [updated] = await db.update(v2TicketsBTable)
      .set({ status: "closed", closedBy: userId, closedAt: new Date(), closedNote: note, updatedAt: new Date() })
      .where(eq(v2TicketsBTable.id, id))
      .returning();

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, ticket.outsourceOrderId)).limit(1);
    if (order) {
      await notify(order.opcId, "v2_ticket_b_closed", "质保工单已关闭",
        `您的工单「${ticket.title}」已由运营方关闭${note ? `：${note}` : ""}。`, ticket.outsourceOrderId, "v2_outsource_order");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/tickets-b/:id/close failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
