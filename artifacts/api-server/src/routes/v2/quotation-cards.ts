import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2QuotationCardsTable, v2ClientDemandsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/quotation-cards", requireAuth, async (req: Request, res: Response) => {
  try {
    const { clientDemandId, tenderId } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (clientDemandId) conditions.push(eq(v2QuotationCardsTable.clientDemandId, parseInt(clientDemandId)));
    if (tenderId) conditions.push(eq(v2QuotationCardsTable.tenderId, parseInt(tenderId)));

    const rows = await db
      .select({
        id: v2QuotationCardsTable.id,
        parentType: v2QuotationCardsTable.parentType,
        clientDemandId: v2QuotationCardsTable.clientDemandId,
        tenderId: v2QuotationCardsTable.tenderId,
        totalPrice: v2QuotationCardsTable.totalPrice,
        breakdown: v2QuotationCardsTable.breakdown,
        note: v2QuotationCardsTable.note,
        createdByNickname: usersTable.nickname,
        createdAt: v2QuotationCardsTable.createdAt,
        updatedAt: v2QuotationCardsTable.updatedAt,
      })
      .from(v2QuotationCardsTable)
      .leftJoin(usersTable, eq(v2QuotationCardsTable.createdBy, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2QuotationCardsTable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/quotation-cards failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/quotation-cards", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { parentType, clientDemandId, tenderId, totalPrice, breakdown, note } = req.body as {
      parentType: "client_demand" | "tender";
      clientDemandId?: number;
      tenderId?: number;
      totalPrice: number;
      breakdown?: Array<{ item: string; amount: number; note?: string }>;
      note?: string;
    };

    if (!parentType) return res.status(400).json({ error: "parentType 必填" });
    if (parentType === "client_demand" && !clientDemandId) return res.status(400).json({ error: "需要 clientDemandId" });
    if (parentType === "tender" && !tenderId) return res.status(400).json({ error: "需要 tenderId" });
    if (typeof totalPrice !== "number") return res.status(400).json({ error: "totalPrice 必填" });

    const [created] = await db.insert(v2QuotationCardsTable).values({
      parentType,
      clientDemandId: parentType === "client_demand" ? clientDemandId : undefined,
      tenderId: parentType === "tender" ? tenderId : undefined,
      totalPrice,
      breakdown: breakdown ?? [],
      note,
      createdBy: userId,
    }).returning();

    // 当需求已在报价中状态（未走 initiate-quote）时，手动触发红点 + 通知
    if (parentType === "client_demand" && clientDemandId) {
      const [demand] = await db.select().from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.id, clientDemandId)).limit(1);
      if (demand && demand.status === "quoting") {
        await db.update(v2ClientDemandsTable)
          .set({ updatedAt: new Date() })
          .where(eq(v2ClientDemandsTable.id, clientDemandId));
        await notify(demand.publisherId, "v2_quote_initiated", "运营方已发起报价",
          `运营方已对您的需求「${demand.title}」发起报价，请查阅报价卡并确认。`,
          clientDemandId, "v2_client_demand");
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/quotation-cards failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/quotation-cards/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [card] = await db.select().from(v2QuotationCardsTable).where(eq(v2QuotationCardsTable.id, id)).limit(1);
    if (!card) return res.status(404).json({ error: "报价卡不存在" });
    return res.json(card);
  } catch (err) {
    logger.error({ err }, "GET /v2/quotation-cards/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/quotation-cards/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [card] = await db.select().from(v2QuotationCardsTable).where(eq(v2QuotationCardsTable.id, id)).limit(1);
    if (!card) return res.status(404).json({ error: "报价卡不存在" });

    const { totalPrice, breakdown, note } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (totalPrice !== undefined) updates.totalPrice = totalPrice;
    if (breakdown !== undefined) updates.breakdown = breakdown;
    if (note !== undefined) updates.note = note;

    const [updated] = await db.update(v2QuotationCardsTable).set(updates)
      .where(eq(v2QuotationCardsTable.id, id)).returning();

    // 触发发单方红点 + 通知
    if (card.clientDemandId) {
      const [demand] = await db.select().from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.id, card.clientDemandId)).limit(1);
      if (demand) {
        await db.update(v2ClientDemandsTable)
          .set({ updatedAt: new Date() })
          .where(eq(v2ClientDemandsTable.id, card.clientDemandId));
        await notify(demand.publisherId, "v2_quote_initiated", "运营方已更新报价",
          `运营方已更新您的需求「${demand.title}」的报价，请查阅报价卡并确认。`,
          card.clientDemandId, "v2_client_demand");
      }
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/quotation-cards/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
