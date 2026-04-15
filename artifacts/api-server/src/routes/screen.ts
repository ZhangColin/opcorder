import { Router, type IRouter } from "express";
import { db, usersTable, demandsTable, ordersTable, portfoliosTable, opcProfilesTable } from "@workspace/db";
import { eq, gte, sql, count, and, inArray, desc } from "drizzle-orm";
import { requireAdmin, requirePermission } from "../middleware/adminAuth";

const router: IRouter = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDailyBuckets(days: number): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[dateKey(d)] = 0;
  }
  return buckets;
}

router.get("/screen", requireAdmin, requirePermission("screen"), async (_req, res) => {
  try {
    const DAYS = 14;
    const since14 = daysAgo(DAYS);

    /* ── KPIs ──────────────────────────────────────────── */

    const usersByRole = await db
      .select({ role: usersTable.role, cnt: count() })
      .from(usersTable)
      .where(eq(usersTable.status, "active"))
      .groupBy(usersTable.role);

    const roleMap: Record<string, number> = {};
    for (const r of usersByRole) roleMap[r.role] = Number(r.cnt);

    const totalUsers  = Object.values(roleMap).reduce((a, b) => a + b, 0);
    const opcCount    = roleMap["opc"] ?? 0;
    const pubCount    = roleMap["publisher"] ?? 0;

    const POSITIVE_DEMAND_STATUSES = ["published", "matched", "in_progress", "pending_acceptance", "completed"] as const;
    const demandByStatus = await db
      .select({ status: demandsTable.status, cnt: count() })
      .from(demandsTable)
      .groupBy(demandsTable.status);

    const demandStatusMap: Record<string, number> = {};
    for (const d of demandByStatus) demandStatusMap[d.status] = Number(d.cnt);

    const publishedDemands = (POSITIVE_DEMAND_STATUSES as readonly string[])
      .reduce((sum, s) => sum + (demandStatusMap[s] ?? 0), 0);

    const orderByStatus = await db
      .select({ status: ordersTable.status, cnt: count() })
      .from(ordersTable)
      .groupBy(ordersTable.status);

    const orderStatusMap: Record<string, number> = {};
    for (const o of orderByStatus) orderStatusMap[o.status] = Number(o.cnt);

    const inProgressOrders = (orderStatusMap["in_progress"] ?? 0) + (orderStatusMap["pending_acceptance"] ?? 0);
    const completedOrders  = orderStatusMap["completed"] ?? 0;
    const totalOrders      = Object.values(orderStatusMap).reduce((a, b) => a + b, 0);
    const completionRate   = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    const [settled] = await db
      .select({ total: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)` })
      .from(ordersTable)
      .where(eq(ordersTable.status, "completed"));
    const totalSettled = Number(settled.total) || 0;

    /* ── Time series (last 14 days) ────────────────────── */

    const newUserRows = await db
      .select({
        day: sql<string>`DATE(${usersTable.createdAt})`,
        cnt: count(),
      })
      .from(usersTable)
      .where(gte(usersTable.createdAt, since14))
      .groupBy(sql`DATE(${usersTable.createdAt})`);

    const newDemandRows = await db
      .select({
        day: sql<string>`DATE(${demandsTable.createdAt})`,
        cnt: count(),
      })
      .from(demandsTable)
      .where(and(
        gte(demandsTable.createdAt, since14),
        inArray(demandsTable.status, [...POSITIVE_DEMAND_STATUSES] as string[]),
      ))
      .groupBy(sql`DATE(${demandsTable.createdAt})`);

    const newOrderRows = await db
      .select({
        day: sql<string>`DATE(${ordersTable.createdAt})`,
        cnt: count(),
      })
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, since14))
      .groupBy(sql`DATE(${ordersTable.createdAt})`);

    const userBuckets   = buildDailyBuckets(DAYS);
    const demandBuckets = buildDailyBuckets(DAYS);
    const orderBuckets  = buildDailyBuckets(DAYS);

    for (const r of newUserRows)   if (r.day in userBuckets)   userBuckets[r.day]   = Number(r.cnt);
    for (const r of newDemandRows) if (r.day in demandBuckets) demandBuckets[r.day] = Number(r.cnt);
    for (const r of newOrderRows)  if (r.day in orderBuckets)  orderBuckets[r.day]  = Number(r.cnt);

    const dates = Object.keys(userBuckets).sort();
    const timeSeries = dates.map(date => ({
      date,
      label: date.slice(5),
      newUsers:   userBuckets[date],
      newDemands: demandBuckets[date],
      newOrders:  orderBuckets[date],
    }));

    /* ── Chart: demand status distribution ─────────────── */

    const DEMAND_STATUS_LABELS: Record<string, string> = {
      published:          "已发布",
      matched:            "匹配中",
      in_progress:        "进行中",
      pending_acceptance: "待验收",
      completed:          "已完成",
    };
    const demandStatusChart = POSITIVE_DEMAND_STATUSES.map(s => ({
      status: s,
      label:  DEMAND_STATUS_LABELS[s] ?? s,
      value:  demandStatusMap[s] ?? 0,
    }));

    /* ── Chart: user role distribution ──────────────────── */

    const userRoleChart = [
      { role: "opc",       label: "OPC",  value: opcCount },
      { role: "publisher", label: "发单方", value: pubCount },
    ];

    /* ── Ticker events ───────────────────────────────────── */

    const recentOpcs = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(and(eq(usersTable.role, "opc"), eq(usersTable.status, "active")))
      .orderBy(desc(usersTable.createdAt))
      .limit(20);

    const recentOrders = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        opcNickname: usersTable.nickname,
        demandTitle: demandsTable.title,
      })
      .from(ordersTable)
      .innerJoin(usersTable, eq(ordersTable.opcId, usersTable.id))
      .innerJoin(demandsTable, eq(ordersTable.demandId, demandsTable.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(20);

    const recentCerts = await db
      .select({
        id: portfoliosTable.id,
        applyLevel: portfoliosTable.applyLevel,
        reviewedAt: portfoliosTable.reviewedAt,
        nickname: usersTable.nickname,
      })
      .from(portfoliosTable)
      .innerJoin(usersTable, eq(portfoliosTable.userId, usersTable.id))
      .where(eq(portfoliosTable.levelApplyStatus, "approved"))
      .orderBy(desc(portfoliosTable.reviewedAt))
      .limit(15);

    const recentDemands = await db
      .select({ id: demandsTable.id, title: demandsTable.title, createdAt: demandsTable.createdAt, nickname: usersTable.nickname })
      .from(demandsTable)
      .innerJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
      .where(inArray(demandsTable.status, [...POSITIVE_DEMAND_STATUSES] as string[]))
      .orderBy(desc(demandsTable.createdAt))
      .limit(20);

    const ticker1 = [
      ...recentOpcs.map(u => ({ text: `欢迎 ${u.nickname} 注册成为 OPC` })),
      ...recentOrders.map(o => ({ text: `恭喜 ${o.opcNickname} 中标《${o.demandTitle}》项目` })),
    ].sort(() => Math.random() - 0.5);

    const ticker2 = [
      ...recentCerts.map(c => ({ text: `${c.nickname} 成功晋升为 ${c.applyLevel} 级 OPC` })),
      ...recentDemands.map(d => ({ text: `${d.nickname} 发布新需求《${d.title}》` })),
    ].sort(() => Math.random() - 0.5);

    res.json({
      kpi: { totalUsers, opcCount, publisherCount: pubCount, publishedDemands, inProgressOrders, completedOrders, completionRate, totalSettled },
      timeSeries,
      demandStatusChart,
      userRoleChart,
      ticker1,
      ticker2,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "数据加载失败" });
  }
});

export default router;
