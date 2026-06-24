import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ClientDemandsTable, v2OutsourceDemandsTable, v2OutsourceOrdersTable,
  v2ContractsTable, v2TendersTable, v2PaymentPlansTable, v2SettlementPlansTable,
  v2TicketsATable, v2TicketsBTable, usersTable,
} from "@workspace/db";
import { eq, and, count, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/overview/admin", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "admin") return res.status(403).json({ error: "仅管理员可访问" });

    const [channelA] = await db.select({
      total: count(),
      negotiating: sql<number>`count(*) filter (where status = 'negotiating')`.mapWith(Number),
      quoting: sql<number>`count(*) filter (where status = 'quoting')`.mapWith(Number),
      pendingContract: sql<number>`count(*) filter (where status = 'pending_contract')`.mapWith(Number),
      executing: sql<number>`count(*) filter (where status = 'executing')`.mapWith(Number),
      warranty: sql<number>`count(*) filter (where status = 'warranty')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where status = 'completed')`.mapWith(Number),
    }).from(v2ClientDemandsTable);

    const [channelB] = await db.select({
      total: count(),
      negotiating: sql<number>`count(*) filter (where status = 'negotiating')`.mapWith(Number),
      executing: sql<number>`count(*) filter (where status = 'executing')`.mapWith(Number),
      warranty: sql<number>`count(*) filter (where status = 'warranty')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where status = 'completed')`.mapWith(Number),
    }).from(v2OutsourceDemandsTable);

    const [orders] = await db.select({
      total: count(),
      pendingContract: sql<number>`count(*) filter (where status = 'pending_contract')`.mapWith(Number),
      executing: sql<number>`count(*) filter (where status = 'executing')`.mapWith(Number),
      warranty: sql<number>`count(*) filter (where status = 'warranty')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where status = 'completed')`.mapWith(Number),
    }).from(v2OutsourceOrdersTable);

    const [paymentStats] = await db.select({
      pendingReview: sql<number>`count(*) filter (where status = 'awaiting_review')`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where status = 'pending' and due_date < now())`.mapWith(Number),
    }).from(v2PaymentPlansTable);

    const [settlementStats] = await db.select({
      pendingPay: sql<number>`count(*) filter (where status = 'pending')`.mapWith(Number),
    }).from(v2SettlementPlansTable);

    const recentDemands = await db
      .select({
        id: v2ClientDemandsTable.id,
        demandNo: v2ClientDemandsTable.demandNo,
        title: v2ClientDemandsTable.title,
        status: v2ClientDemandsTable.status,
        publisherNickname: usersTable.nickname,
        createdAt: v2ClientDemandsTable.createdAt,
      })
      .from(v2ClientDemandsTable)
      .leftJoin(usersTable, eq(v2ClientDemandsTable.publisherId, usersTable.id))
      .orderBy(desc(v2ClientDemandsTable.createdAt))
      .limit(5);

    return res.json({
      channelA,
      channelB,
      orders,
      paymentStats,
      settlementStats,
      recentDemands,
    });
  } catch (err) {
    logger.error({ err }, "GET /v2/overview/admin failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/overview/admin/tree", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "admin") return res.status(403).json({ error: "仅管理员可访问" });

    const cdIdFilter = req.query.clientDemandId ? parseInt(req.query.clientDemandId as string) : null;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? "15")));
    const offset = (page - 1) * limit;

    const cds = await db
      .select({
        id: v2ClientDemandsTable.id,
        demandNo: v2ClientDemandsTable.demandNo,
        title: v2ClientDemandsTable.title,
        status: v2ClientDemandsTable.status,
        publisherNickname: usersTable.nickname,
        createdAt: v2ClientDemandsTable.createdAt,
      })
      .from(v2ClientDemandsTable)
      .leftJoin(usersTable, eq(v2ClientDemandsTable.publisherId, usersTable.id))
      .where(cdIdFilter ? eq(v2ClientDemandsTable.id, cdIdFilter) : undefined)
      .orderBy(desc(v2ClientDemandsTable.createdAt))
      .limit(limit)
      .offset(offset);

    if (cds.length === 0) return res.json([]);
    const cdIds = cds.map(d => d.id);
    const now = new Date();

    const [contracts, paymentPlans, ticketsA, outsourceDemands] = await Promise.all([
      db.select({
        id: v2ContractsTable.id,
        clientDemandId: v2ContractsTable.clientDemandId,
        contractNo: v2ContractsTable.contractNo,
        status: v2ContractsTable.status,
      }).from(v2ContractsTable).where(inArray(v2ContractsTable.clientDemandId, cdIds)),

      db.select({
        id: v2PaymentPlansTable.id,
        clientDemandId: v2PaymentPlansTable.clientDemandId,
        itemNo: v2PaymentPlansTable.itemNo,
        description: v2PaymentPlansTable.description,
        amount: v2PaymentPlansTable.amount,
        status: v2PaymentPlansTable.status,
        dueDate: v2PaymentPlansTable.dueDate,
      }).from(v2PaymentPlansTable).where(inArray(v2PaymentPlansTable.clientDemandId, cdIds)),

      db.select({
        clientDemandId: v2TicketsATable.clientDemandId,
        status: v2TicketsATable.status,
      }).from(v2TicketsATable).where(inArray(v2TicketsATable.clientDemandId, cdIds)),

      db.select({
        id: v2OutsourceDemandsTable.id,
        clientDemandId: v2OutsourceDemandsTable.clientDemandId,
        demandNo: v2OutsourceDemandsTable.demandNo,
        title: v2OutsourceDemandsTable.title,
        status: v2OutsourceDemandsTable.status,
      }).from(v2OutsourceDemandsTable).where(inArray(v2OutsourceDemandsTable.clientDemandId, cdIds)),
    ]);

    const odIds = outsourceDemands.map(od => od.id);

    let tenderRows: Array<{ id: number; outsourceDemandId: number; opcNickname: string | null; status: string; totalPrice: number | null }> = [];
    if (odIds.length > 0) {
      tenderRows = await db
        .select({
          id: v2TendersTable.id,
          outsourceDemandId: v2TendersTable.outsourceDemandId,
          opcNickname: usersTable.nickname,
          status: v2TendersTable.status,
          totalPrice: v2TendersTable.totalPrice,
        })
        .from(v2TendersTable)
        .leftJoin(usersTable, eq(v2TendersTable.opcId, usersTable.id))
        .where(inArray(v2TendersTable.outsourceDemandId, odIds));
    }

    const tenderIds = tenderRows.map(t => t.id);

    let orderRows: Array<{ id: number; tenderId: number; orderNo: string; status: string }> = [];
    if (tenderIds.length > 0) {
      orderRows = await db
        .select({
          id: v2OutsourceOrdersTable.id,
          tenderId: v2OutsourceOrdersTable.tenderId,
          orderNo: v2OutsourceOrdersTable.orderNo,
          status: v2OutsourceOrdersTable.status,
        })
        .from(v2OutsourceOrdersTable)
        .where(inArray(v2OutsourceOrdersTable.tenderId, tenderIds));
    }

    const orderIds = orderRows.map(o => o.id);

    let settlements: Array<{ outsourceOrderId: number; status: string; amount: unknown }> = [];
    let ticketsB: Array<{ outsourceOrderId: number; status: string; isBlockingPayment: boolean | null }> = [];
    if (orderIds.length > 0) {
      [settlements, ticketsB] = await Promise.all([
        db.select({
          outsourceOrderId: v2SettlementPlansTable.outsourceOrderId,
          status: v2SettlementPlansTable.status,
          amount: v2SettlementPlansTable.amount,
        }).from(v2SettlementPlansTable).where(inArray(v2SettlementPlansTable.outsourceOrderId, orderIds)),
        db.select({
          outsourceOrderId: v2TicketsBTable.outsourceOrderId,
          status: v2TicketsBTable.status,
          isBlockingPayment: v2TicketsBTable.isBlockingPayment,
        }).from(v2TicketsBTable).where(inArray(v2TicketsBTable.outsourceOrderId, orderIds)),
      ]);
    }

    const enrichedOrders = new Map(orderRows.map(o => [o.id, {
      ...o,
      openTicketBCount: ticketsB.filter(t => t.outsourceOrderId === o.id && t.status === "open").length,
      hasBlockingTicket: ticketsB.some(t => t.outsourceOrderId === o.id && t.status === "open"),
      pendingSettlements: settlements.filter(s => s.outsourceOrderId === o.id && s.status === "pending").length,
      paidSettlements: settlements.filter(s => s.outsourceOrderId === o.id && s.status === "paid").length,
      totalSettlementAmount: settlements.filter(s => s.outsourceOrderId === o.id).reduce((a, s) => a + Number(s.amount), 0),
    }]));

    const enrichedTenders = new Map(tenderRows.map(t => [t.id, {
      ...t,
      orders: orderRows.filter(o => o.tenderId === t.id).map(o => enrichedOrders.get(o.id)!),
    }]));

    const enrichedODs = new Map(outsourceDemands.map(od => [od.id, {
      ...od,
      tenders: tenderRows.filter(t => t.outsourceDemandId === od.id).map(t => enrichedTenders.get(t.id)!),
    }]));

    const tree = cds.map(cd => ({
      ...cd,
      contracts: contracts.filter(c => c.clientDemandId === cd.id),
      paymentPlans: paymentPlans.filter(p => p.clientDemandId === cd.id).map(p => ({
        ...p,
        isOverdue: p.status === "pending" && p.dueDate !== null && new Date(p.dueDate) < now,
      })),
      openTicketACount: ticketsA.filter(t => t.clientDemandId === cd.id && t.status === "open").length,
      outsourceDemands: outsourceDemands.filter(od => od.clientDemandId === cd.id).map(od => enrichedODs.get(od.id)!),
    }));

    return res.json(tree);
  } catch (err) {
    logger.error({ err }, "GET /v2/overview/admin/tree failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/overview/publisher", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== "publisher" && role !== "admin") return res.status(403).json({ error: "无权访问" });

    const publisherId = role === "admin" && req.query.publisherId
      ? parseInt(req.query.publisherId as string)
      : userId;

    const [demandStats] = await db.select({
      total: count(),
      active: sql<number>`count(*) filter (where status not in ('completed', 'closed'))`.mapWith(Number),
      executing: sql<number>`count(*) filter (where status = 'executing')`.mapWith(Number),
      warranty: sql<number>`count(*) filter (where status = 'warranty')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where status = 'completed')`.mapWith(Number),
    }).from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.publisherId, publisherId));

    const recentDemands = await db
      .select({
        id: v2ClientDemandsTable.id,
        demandNo: v2ClientDemandsTable.demandNo,
        title: v2ClientDemandsTable.title,
        status: v2ClientDemandsTable.status,
        createdAt: v2ClientDemandsTable.createdAt,
        updatedAt: v2ClientDemandsTable.updatedAt,
      })
      .from(v2ClientDemandsTable)
      .where(eq(v2ClientDemandsTable.publisherId, publisherId))
      .orderBy(desc(v2ClientDemandsTable.updatedAt))
      .limit(10);

    return res.json({ demandStats, recentDemands });
  } catch (err) {
    logger.error({ err }, "GET /v2/overview/publisher failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/overview/opc", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== "opc" && role !== "admin") return res.status(403).json({ error: "无权访问" });

    const opcId = role === "admin" && req.query.opcId
      ? parseInt(req.query.opcId as string)
      : userId;

    const [tenderStats] = await db.select({
      total: count(),
      won: sql<number>`count(*) filter (where status = 'won')`.mapWith(Number),
      lost: sql<number>`count(*) filter (where status = 'lost')`.mapWith(Number),
      active: sql<number>`count(*) filter (where status in ('negotiating', 'quoted'))`.mapWith(Number),
    }).from(v2TendersTable).where(eq(v2TendersTable.opcId, opcId));

    const [orderStats] = await db.select({
      total: count(),
      executing: sql<number>`count(*) filter (where status = 'executing')`.mapWith(Number),
      warranty: sql<number>`count(*) filter (where status = 'warranty')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where status = 'completed')`.mapWith(Number),
    }).from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.opcId, opcId));

    const [settlementStats] = await db.select({
      total: sql<number>`coalesce(sum(amount), 0)`.mapWith(Number),
      paid: sql<number>`coalesce(sum(amount) filter (where status = 'paid'), 0)`.mapWith(Number),
      pending: sql<number>`coalesce(sum(amount) filter (where status = 'pending'), 0)`.mapWith(Number),
    })
    .from(v2SettlementPlansTable)
    .leftJoin(v2OutsourceOrdersTable, eq(v2SettlementPlansTable.outsourceOrderId, v2OutsourceOrdersTable.id))
    .where(eq(v2OutsourceOrdersTable.opcId, opcId));

    const recentOrders = await db
      .select({
        id: v2OutsourceOrdersTable.id,
        orderNo: v2OutsourceOrdersTable.orderNo,
        status: v2OutsourceOrdersTable.status,
        createdAt: v2OutsourceOrdersTable.createdAt,
        updatedAt: v2OutsourceOrdersTable.updatedAt,
      })
      .from(v2OutsourceOrdersTable)
      .where(eq(v2OutsourceOrdersTable.opcId, opcId))
      .orderBy(desc(v2OutsourceOrdersTable.updatedAt))
      .limit(5);

    return res.json({ tenderStats, orderStats, settlementStats, recentOrders });
  } catch (err) {
    logger.error({ err }, "GET /v2/overview/opc failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
