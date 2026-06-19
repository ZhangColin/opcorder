import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ClientDemandsTable, v2OutsourceDemandsTable, v2OutsourceOrdersTable,
  v2ContractsTable, v2TendersTable, v2PaymentPlansTable, v2SettlementPlansTable,
  usersTable,
} from "@workspace/db";
import { eq, and, count, desc, sql } from "drizzle-orm";
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
