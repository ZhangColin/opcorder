import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  ListNotificationsQueryParams,
  ListNotificationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  try {
    const params = ListNotificationsQueryParams.parse(req.query);
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(notificationsTable.userId, 2)];
    if (params.unreadOnly) conditions.push(eq(notificationsTable.isRead, false));

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [totalResult] = await db.select({ count: count() }).from(notificationsTable).where(whereClause);
    const total = Number(totalResult.count);

    const [unreadResult] = await db.select({ count: count() }).from(notificationsTable).where(
      and(eq(notificationsTable.userId, 2), eq(notificationsTable.isRead, false))
    );
    const unreadCount = Number(unreadResult.count);

    const items = await db.select().from(notificationsTable)
      .where(whereClause)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      items: items.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      unreadCount,
      page,
      limit,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

router.patch("/notifications/:notificationId/read", async (req, res) => {
  try {
    const notificationId = parseInt(req.params.notificationId);
    const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, notificationId)).returning();
    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  try {
    const result = await db.update(notificationsTable).set({ isRead: true }).where(
      and(eq(notificationsTable.userId, 2), eq(notificationsTable.isRead, false))
    ).returning();
    res.json({ count: result.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

export default router;
