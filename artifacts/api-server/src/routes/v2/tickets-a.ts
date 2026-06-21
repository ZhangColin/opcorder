import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2TicketsATable, v2ClientDemandsTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/tickets-a", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { clientDemandId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];

    if (clientDemandId) conditions.push(eq(v2TicketsATable.clientDemandId, parseInt(clientDemandId)));
    if (status) conditions.push(eq(v2TicketsATable.status, status as any));
    if (role === "opc") return res.status(403).json({ error: "OPC 无权查看此通道工单" });
    if (role === "publisher") {
      const myDemands = await db
        .select({ id: v2ClientDemandsTable.id })
        .from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.publisherId, userId));
      const ids = myDemands.map(d => d.id);
      if (ids.length === 0) return res.json([]);
      conditions.push(inArray(v2TicketsATable.clientDemandId, ids));
    }

    const rows = await db
      .select({
        id: v2TicketsATable.id,
        clientDemandId: v2TicketsATable.clientDemandId,
        title: v2TicketsATable.title,
        description: v2TicketsATable.description,
        attachments: v2TicketsATable.attachments,
        status: v2TicketsATable.status,
        createdByNickname: usersTable.nickname,
        closedAt: v2TicketsATable.closedAt,
        closedNote: v2TicketsATable.closedNote,
        createdAt: v2TicketsATable.createdAt,
        updatedAt: v2TicketsATable.updatedAt,
        demandTitle: v2ClientDemandsTable.title,
      })
      .from(v2TicketsATable)
      .leftJoin(usersTable, eq(v2TicketsATable.createdBy, usersTable.id))
      .leftJoin(v2ClientDemandsTable, eq(v2TicketsATable.clientDemandId, v2ClientDemandsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2TicketsATable.updatedAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/tickets-a failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tickets-a", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "opc") return res.status(403).json({ error: "OPC 无权发起此通道工单" });

    const { clientDemandId, title, description, attachments } = req.body as {
      clientDemandId: number; title: string; description?: string; attachments?: any[];
    };
    if (!clientDemandId || !title?.trim()) return res.status(400).json({ error: "clientDemandId 和 title 必填" });

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title, status: v2ClientDemandsTable.status })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, clientDemandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });

    if (role === "publisher") {
      if (demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
      if (demand.status !== "warranty") return res.status(400).json({ error: "仅质保期内可发起工单" });
    }

    const [created] = await db.insert(v2TicketsATable).values({
      clientDemandId,
      title: title.trim(),
      description,
      attachments: attachments ?? [],
      status: "open",
      createdBy: userId,
    }).returning();

    if (role === "publisher") {
      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      for (const admin of admins) {
        await notify(admin.id, "v2_ticket_a_created", "发单方发起了质保工单",
          `发单方在需求「${demand.title}」的质保期内发起了工单「${title}」，请处理。`, clientDemandId, "v2_client_demand");
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/tickets-a failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/tickets-a/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [row] = await db
      .select({
        id: v2TicketsATable.id,
        clientDemandId: v2TicketsATable.clientDemandId,
        title: v2TicketsATable.title,
        description: v2TicketsATable.description,
        attachments: v2TicketsATable.attachments,
        status: v2TicketsATable.status,
        createdByNickname: usersTable.nickname,
        closedAt: v2TicketsATable.closedAt,
        closedNote: v2TicketsATable.closedNote,
        createdAt: v2TicketsATable.createdAt,
      })
      .from(v2TicketsATable)
      .leftJoin(usersTable, eq(v2TicketsATable.createdBy, usersTable.id))
      .where(eq(v2TicketsATable.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "工单不存在" });

    if (role === "opc") return res.status(403).json({ error: "OPC 无权查看此工单" });
    if (role === "publisher") {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, row.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权查看" });
    }

    return res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /v2/tickets-a/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tickets-a/:id/close", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [ticket] = await db.select().from(v2TicketsATable).where(eq(v2TicketsATable.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: "工单不存在" });
    if (ticket.status === "closed") return res.status(400).json({ error: "工单已关闭" });

    const { note } = req.body as { note?: string };
    const [updated] = await db.update(v2TicketsATable)
      .set({ status: "closed", closedBy: userId, closedAt: new Date(), closedNote: note, updatedAt: new Date() })
      .where(eq(v2TicketsATable.id, id))
      .returning();

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, ticket.clientDemandId)).limit(1);
    if (demand) {
      await notify(demand.publisherId, "v2_ticket_a_closed", "质保工单已关闭",
        `您的工单「${ticket.title}」已由运营方关闭${note ? `：${note}` : ""}。`, ticket.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/tickets-a/:id/close failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
