import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2TendersTable, v2OutsourceDemandsTable, v2OutsourceOrdersTable,
  v2ContractsTable, v2ClientDemandsTable, usersTable,
} from "@workspace/db";
import { eq, and, ne, desc, count, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genOutsourceOrderNo, genContractNo } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/tenders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { outsourceDemandId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];

    if (outsourceDemandId) conditions.push(eq(v2TendersTable.outsourceDemandId, parseInt(outsourceDemandId)));
    if (status) conditions.push(eq(v2TendersTable.status, status as any));

    if (role === "opc") conditions.push(eq(v2TendersTable.opcId, userId));
    else if (role === "publisher") return res.status(403).json({ error: "发单方无权查看投标" });

    const rows = await db
      .select({
        id: v2TendersTable.id,
        outsourceDemandId: v2TendersTable.outsourceDemandId,
        demandTitle: v2OutsourceDemandsTable.title,
        demandUpdatedAt: v2OutsourceDemandsTable.updatedAt,
        opcId: v2TendersTable.opcId,
        opcNickname: usersTable.nickname,
        status: v2TendersTable.status,
        totalPrice: v2TendersTable.totalPrice,
        quotedAt: v2TendersTable.quotedAt,
        selectedAt: v2TendersTable.selectedAt,
        createdAt: v2TendersTable.createdAt,
        updatedAt: v2TendersTable.updatedAt,
      })
      .from(v2TendersTable)
      .leftJoin(v2OutsourceDemandsTable, eq(v2TendersTable.outsourceDemandId, v2OutsourceDemandsTable.id))
      .leftJoin(usersTable, eq(v2TendersTable.opcId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2TendersTable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/tenders failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-demands/:id/apply", requireAuth, async (req: Request, res: Response) => {
  try {
    const outsourceDemandId = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role !== "opc") return res.status(403).json({ error: "仅 OPC 可报名" });

    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, outsourceDemandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });
    if (demand.mode !== "public") return res.status(400).json({ error: "非公开模式需求不可自主报名" });
    if (!["negotiating", "executing"].includes(demand.status)) return res.status(400).json({ error: "该需求当前不接受报名" });

    const [existing] = await db
      .select()
      .from(v2TendersTable)
      .where(and(eq(v2TendersTable.outsourceDemandId, outsourceDemandId), eq(v2TendersTable.opcId, userId)))
      .limit(1);
    if (existing) return res.status(409).json({ error: "您已报名该需求" });

    const [created] = await db.insert(v2TendersTable).values({
      outsourceDemandId,
      opcId: userId,
      status: "negotiating",
      priceBreakdown: [],
    }).returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_tender_won", "OPC 报名了外包需求",
        `OPC 已报名外包需求「${demand.title}」，请安排沟通。`, outsourceDemandId, "v2_outsource_demand");
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-demands/:id/apply failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/tenders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [tender] = await db
      .select({
        id: v2TendersTable.id,
        outsourceDemandId: v2TendersTable.outsourceDemandId,
        demandTitle: v2OutsourceDemandsTable.title,
        opcId: v2TendersTable.opcId,
        opcNickname: usersTable.nickname,
        status: v2TendersTable.status,
        totalPrice: v2TendersTable.totalPrice,
        priceBreakdown: v2TendersTable.priceBreakdown,
        quotedAt: v2TendersTable.quotedAt,
        selectedAt: v2TendersTable.selectedAt,
        cancelledReason: v2TendersTable.cancelledReason,
        createdAt: v2TendersTable.createdAt,
        updatedAt: v2TendersTable.updatedAt,
      })
      .from(v2TendersTable)
      .leftJoin(v2OutsourceDemandsTable, eq(v2TendersTable.outsourceDemandId, v2OutsourceDemandsTable.id))
      .leftJoin(usersTable, eq(v2TendersTable.opcId, usersTable.id))
      .where(eq(v2TendersTable.id, id))
      .limit(1);

    if (!tender) return res.status(404).json({ error: "投标不存在" });
    if (role === "opc" && tender.opcId !== userId) return res.status(403).json({ error: "无权查看" });
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看投标详情" });

    return res.json(tender);
  } catch (err) {
    logger.error({ err }, "GET /v2/tenders/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tenders/:id/submit-quote", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role !== "opc") return res.status(403).json({ error: "仅 OPC 可提交报价" });

    const [tender] = await db.select().from(v2TendersTable).where(eq(v2TendersTable.id, id)).limit(1);
    if (!tender) return res.status(404).json({ error: "投标不存在" });
    if (tender.opcId !== userId) return res.status(403).json({ error: "无权操作" });
    if (!["negotiating", "quoted"].includes(tender.status)) return res.status(400).json({ error: "当前状态不可提交报价" });

    const { totalPrice, priceBreakdown } = req.body as {
      totalPrice: number; priceBreakdown?: Array<{ item: string; amount: number; note?: string }>;
    };
    if (typeof totalPrice !== "number" || totalPrice <= 0) return res.status(400).json({ error: "totalPrice 必须大于0" });

    const [updated] = await db.update(v2TendersTable)
      .set({
        status: "quoted",
        totalPrice,
        priceBreakdown: priceBreakdown ?? [],
        quotedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(v2TendersTable.id, id))
      .returning();

    const [demand] = await db.select({ title: v2OutsourceDemandsTable.title })
      .from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, tender.outsourceDemandId)).limit(1);

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_tender_won", "OPC 提交了报价",
        `OPC 已对外包需求「${demand?.title}」提交报价 ¥${totalPrice.toLocaleString()}，请查阅。`, tender.outsourceDemandId, "v2_outsource_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/tenders/:id/submit-quote failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tenders/:id/select-winner", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    const [tender] = await db.select().from(v2TendersTable).where(eq(v2TendersTable.id, id)).limit(1);
    if (!tender) return res.status(404).json({ error: "投标不存在" });
    if (tender.status !== "quoted") return res.status(400).json({ error: "仅已报价投标可被选定" });

    const [demand] = await db.select().from(v2OutsourceDemandsTable)
      .where(eq(v2OutsourceDemandsTable.id, tender.outsourceDemandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    // D9: If linked to a client demand, that demand's A-channel contract must be signed
    if (demand.clientDemandId) {
      const [signedContract] = await db
        .select({ id: v2ContractsTable.id })
        .from(v2ContractsTable)
        .where(and(
          eq(v2ContractsTable.clientDemandId, demand.clientDemandId),
          eq(v2ContractsTable.channel, "a"),
          eq(v2ContractsTable.status, "signed"),
        ))
        .limit(1);
      if (!signedContract) {
        return res.status(400).json({ error: "关联的客户需求合同尚未签署，不可选定中标 OPC" });
      }
    }

    const orderNo = await genOutsourceOrderNo();
    const [order] = await db.insert(v2OutsourceOrdersTable).values({
      orderNo,
      outsourceDemandId: tender.outsourceDemandId,
      tenderId: id,
      opcId: tender.opcId,
      status: "pending_contract",
    }).returning();

    await db.update(v2TendersTable)
      .set({ status: "won", selectedBy: userId, selectedAt: new Date(), updatedAt: new Date() })
      .where(eq(v2TendersTable.id, id));

    await db.update(v2OutsourceDemandsTable)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(v2OutsourceDemandsTable.id, tender.outsourceDemandId));

    const contractNo = await genContractNo("b");
    const [contract] = await db.insert(v2ContractsTable).values({
      contractNo,
      channel: "b",
      outsourceOrderId: order.id,
      status: "draft",
    }).returning();

    await notify(tender.opcId, "v2_tender_won", "恭喜！您已中标",
      `您已中标外包需求「${demand.title}」，订单号 ${orderNo}，合同已生成待运营定稿。`, order.id, "v2_outsource_order");

    const losers = await db.select({ id: v2TendersTable.id, opcId: v2TendersTable.opcId })
      .from(v2TendersTable)
      .where(and(
        eq(v2TendersTable.outsourceDemandId, tender.outsourceDemandId),
        ne(v2TendersTable.id, id),
        inArray(v2TendersTable.status, ["negotiating", "quoted"]),
      ));
    for (const loser of losers) {
      await db.update(v2TendersTable)
        .set({ status: "lost", updatedAt: new Date() })
        .where(eq(v2TendersTable.id, loser.id));
      await notify(loser.opcId, "v2_tender_lost", "很遗憾，本次投标未入选",
        `外包需求「${demand.title}」已完成投标筛选，本次您未被选中，感谢参与。`,
        tender.outsourceDemandId, "v2_outsource_demand");
    }

    return res.status(201).json({ order, contract });
  } catch (err) {
    logger.error({ err }, "POST /v2/tenders/:id/select-winner failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tenders/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [tender] = await db.select().from(v2TendersTable).where(eq(v2TendersTable.id, id)).limit(1);
    if (!tender) return res.status(404).json({ error: "投标不存在" });
    if (tender.status === "won") return res.status(400).json({ error: "已中标不可取消" });

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2TendersTable)
      .set({ status: "lost", cancelledReason: reason, updatedAt: new Date() })
      .where(eq(v2TendersTable.id, id))
      .returning();

    const [demand] = await db.select({ title: v2OutsourceDemandsTable.title })
      .from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, tender.outsourceDemandId)).limit(1);

    await notify(tender.opcId, "v2_tender_cancelled", "投标已被取消",
      `您在外包需求「${demand?.title}」的投标已被运营方取消${reason ? `，原因：${reason}` : ""}。`, tender.outsourceDemandId, "v2_outsource_demand");

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/tenders/:id/cancel failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/tenders/batch-select-winners", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tenderIds } = req.body as { tenderIds: number[] };
    if (!Array.isArray(tenderIds) || tenderIds.length === 0) {
      return res.status(400).json({ error: "tenderIds 不能为空" });
    }

    const tenders = await db.select().from(v2TendersTable).where(inArray(v2TendersTable.id, tenderIds));
    if (tenders.length !== tenderIds.length) return res.status(400).json({ error: "部分投标不存在" });
    if (!tenders.every(t => t.status === "quoted")) return res.status(400).json({ error: "仅已报价投标可被选定" });

    const demandIds = [...new Set(tenders.map(t => t.outsourceDemandId))];
    if (demandIds.length > 1) return res.status(400).json({ error: "所选投标须属于同一外包需求" });
    const demandId = demandIds[0];

    const [demand] = await db.select().from(v2OutsourceDemandsTable)
      .where(eq(v2OutsourceDemandsTable.id, demandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    if (demand.clientDemandId) {
      const [signedContract] = await db
        .select({ id: v2ContractsTable.id })
        .from(v2ContractsTable)
        .where(and(
          eq(v2ContractsTable.clientDemandId, demand.clientDemandId),
          eq(v2ContractsTable.channel, "a"),
          eq(v2ContractsTable.status, "signed"),
        ))
        .limit(1);
      if (!signedContract) {
        return res.status(400).json({ error: "关联的客户需求合同尚未签署，不可选定中标 OPC" });
      }
    }

    const orders = [];
    const contracts = [];

    for (const tender of tenders) {
      const orderNo = await genOutsourceOrderNo();
      const [order] = await db.insert(v2OutsourceOrdersTable).values({
        orderNo,
        outsourceDemandId: tender.outsourceDemandId,
        tenderId: tender.id,
        opcId: tender.opcId,
        status: "pending_contract",
      }).returning();
      orders.push(order);

      await db.update(v2TendersTable)
        .set({ status: "won", selectedBy: userId, selectedAt: new Date(), updatedAt: new Date() })
        .where(eq(v2TendersTable.id, tender.id));

      const contractNo = await genContractNo("b");
      const [contract] = await db.insert(v2ContractsTable).values({
        contractNo,
        channel: "b",
        outsourceOrderId: order.id,
        status: "draft",
      }).returning();
      contracts.push(contract);

      await notify(tender.opcId, "v2_tender_won", "恭喜！您已中标",
        `您已中标外包需求「${demand.title}」，订单号 ${orderNo}，合同已生成待运营定稿。`, order.id, "v2_outsource_order");
    }

    await db.update(v2OutsourceDemandsTable)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(v2OutsourceDemandsTable.id, demandId));

    const loserTenders = await db
      .select({ id: v2TendersTable.id, opcId: v2TendersTable.opcId })
      .from(v2TendersTable)
      .where(and(
        eq(v2TendersTable.outsourceDemandId, demandId),
        inArray(v2TendersTable.status, ["negotiating", "quoted"]),
      ));

    for (const loser of loserTenders) {
      await db.update(v2TendersTable)
        .set({ status: "lost", updatedAt: new Date() })
        .where(eq(v2TendersTable.id, loser.id));
      await notify(loser.opcId, "v2_tender_lost", "本次外包投标未中选",
        `很遗憾，外包需求「${demand.title}」本次已选定其他 OPC，感谢您的参与。`, demandId, "v2_outsource_demand");
    }

    return res.status(201).json({ orders, contracts });
  } catch (err) {
    logger.error({ err }, "POST /v2/tenders/batch-select-winners failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
