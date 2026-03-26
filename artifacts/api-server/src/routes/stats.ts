import { Router, type IRouter } from "express";
import { db, ordersTable, usersTable, opcProfilesTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { GetOverviewStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/overview", async (_req, res) => {
  try {
    const [orderStats] = await db.select({
      totalOrders: count(),
      totalAmount: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    }).from(ordersTable);

    const [opcCount] = await db.select({
      count: count(),
    }).from(opcProfilesTable);

    const [completedOrders] = await db.select({
      count: count(),
    }).from(ordersTable).where(eq(ordersTable.status, "completed"));

    const totalOrders = Number(orderStats.totalOrders) || 0;
    const completionRate = totalOrders > 0 ? (Number(completedOrders.count) / totalOrders) * 100 : 0;

    const data = GetOverviewStatsResponse.parse({
      totalPayout: Number(orderStats.totalAmount) || 0,
      payoutGrowth: 12.5,
      activeOpcs: Number(opcCount.count) || 0,
      monthlyOrders: totalOrders || 0,
      completionRate: completionRate || 0,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
