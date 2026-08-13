import { Router, type IRouter } from "express";
import { db, opcProfilesTable, ordersTable, demandsTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { GetOverviewStatsResponse } from "@workspace/api-zod";
const router: IRouter = Router();

router.get("/stats/overview", async (_req, res) => {
  try {
    const [opcCount] = await db.select({
      count: count(),
    }).from(opcProfilesTable);

    // 原版统计:结算总额 = 已完成订单金额合计(orders 表)
    const [settlementStats] = await db.select({
      totalPaid: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    }).from(ordersTable)
      .where(eq(ordersTable.status, "completed"));

    // 原版统计:订单完成率 = 已完成订单数 / 总订单数(orders 表)
    const [orderTotals] = await db.select({
      total: count(),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${ordersTable.status} = 'completed')`,
    }).from(ordersTable);

    const [monthlyDemandsResult] = await db.select({
      cnt: count(),
    }).from(demandsTable)
      .where(sql`date_trunc('month', ${demandsTable.createdAt}) = date_trunc('month', now())`);

    const totalPayout = Number(settlementStats.totalPaid) || 0;
    const monthlyDemands = Number(monthlyDemandsResult.cnt) || 0;
    const totalOrders = Number(orderTotals.total) || 0;
    const completedOrders = Number(orderTotals.completed) || 0;
    const completionRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 1000) / 10
      : 0;

    const data = GetOverviewStatsResponse.parse({
      totalPayout,
      payoutGrowth: 12.5,
      activeOpcs: Number(opcCount.count) || 0,
      monthlyOrders: monthlyDemands,
      monthlyDemands,
      completionRate,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
