import { Router, type IRouter } from "express";
import { db, opcProfilesTable, v2SettlementPlansTable, v2OutsourceDemandsTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { GetOverviewStatsResponse } from "@workspace/api-zod";
const router: IRouter = Router();

router.get("/stats/overview", async (_req, res) => {
  try {
    const [opcCount] = await db.select({
      count: count(),
    }).from(opcProfilesTable);

    const [settlementStats] = await db.select({
      totalPaid: sql<number>`COALESCE(SUM(${v2SettlementPlansTable.amount}), 0)`,
    }).from(v2SettlementPlansTable)
      .where(eq(v2SettlementPlansTable.status, "paid"));

    const [monthlyDemandsResult] = await db.select({
      cnt: count(),
    }).from(v2OutsourceDemandsTable)
      .where(sql`date_trunc('month', ${v2OutsourceDemandsTable.createdAt}) = date_trunc('month', now())`);

    const totalPayout = Number(settlementStats.totalPaid) || 0;
    const monthlyDemands = Number(monthlyDemandsResult.cnt) || 0;

    const data = GetOverviewStatsResponse.parse({
      totalPayout,
      payoutGrowth: 12.5,
      activeOpcs: Number(opcCount.count) || 0,
      monthlyOrders: monthlyDemands,
      monthlyDemands,
      completionRate: 0,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
