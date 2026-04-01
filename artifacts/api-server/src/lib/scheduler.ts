import {
  db,
  demandsTable,
  bidsTable,
  deliverableStatusEnum,
  ordersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

/* ─────────────────────────────────────────────────
   JOB 1: 48h auto-convert directed-invite → open
   PRD §2.1.4 ③: 被邀约OPC若48小时内未响应，系统自动转为公开抢单
   ───────────────────────────────────────────────── */
async function autoConvertDirectedToOpen() {
  try {
    const cutoff = new Date(Date.now() - 48 * HOUR_MS);

    const expiredDirected = await db
      .select({ id: demandsTable.id, demandNo: demandsTable.demandNo })
      .from(demandsTable)
      .where(
        and(
          eq(demandsTable.mode, "directed"),
          eq(demandsTable.status, "published"),
          lt(demandsTable.createdAt, cutoff)
        )
      );

    for (const demand of expiredDirected) {
      await db.update(demandsTable)
        .set({ mode: "open" })
        .where(eq(demandsTable.id, demand.id));

      logger.info({ demandId: demand.id, demandNo: demand.demandNo },
        "Auto-converted directed demand to open after 48h");
    }

    if (expiredDirected.length > 0) {
      logger.info({ count: expiredDirected.length }, "48h auto-convert job completed");
    }
  } catch (err) {
    logger.error({ err }, "48h auto-convert job failed");
  }
}

/* ─────────────────────────────────────────────────
   JOB 2: 7-day auto-accept deliverables
   PRD §2.5 ③: 发单方收到交付物后7个自然日未操作，系统自动确认验收通过
   ───────────────────────────────────────────────── */
async function autoAcceptStaleDeliverables() {
  try {
    const cutoff = new Date(Date.now() - 7 * DAY_MS);

    const stale = await db
      .select({
        id: sql<number>`id`,
        orderId: sql<number>`order_id`,
      })
      .from(sql`deliverables`)
      .where(sql`status = 'submitted' AND submitted_at < ${cutoff}`);

    for (const d of stale) {
      await db.execute(
        sql`UPDATE deliverables SET status = 'approved' WHERE id = ${d.id}`
      );

      logger.info({ deliverableId: d.id, orderId: d.orderId },
        "Auto-accepted deliverable after 7-day inactivity");

      await triggerSettlementCheck(d.orderId);
    }

    if (stale.length > 0) {
      logger.info({ count: stale.length }, "7-day auto-accept job completed");
    }
  } catch (err) {
    logger.error({ err }, "7-day auto-accept job failed");
  }
}

/* ─────────────────────────────────────────────────
   HELPER: Check if all milestones approved → auto-settle
   PRD §2.5 ②: 客户验收通过后，系统自动触发分成结算
   ───────────────────────────────────────────────── */
async function triggerSettlementCheck(orderId: number) {
  try {
    const rows = await db.execute(
      sql`
        SELECT
          o.id,
          o.status,
          o.amount,
          o.opc_share,
          o.opc_id,
          o.publisher_id,
          COUNT(d.id) FILTER (WHERE d.status = 'submitted') AS pending_count,
          COUNT(d.id) TOTAL
        FROM orders o
        LEFT JOIN deliverables d ON d.order_id = o.id
        WHERE o.id = ${orderId}
        GROUP BY o.id, o.status, o.amount, o.opc_share, o.opc_id, o.publisher_id
      `
    );

    const order = rows.rows[0] as Record<string, unknown> | undefined;
    if (!order) return;

    const pendingCount = Number(order.pending_count ?? 0);
    const total        = Number(order.total ?? 0);

    if (total > 0 && pendingCount === 0 && order.status === "pending_acceptance") {
      await db.update(ordersTable)
        .set({ status: "completed" })
        .where(eq(ordersTable.id, orderId));

      const opcId       = Number(order.opc_id);
      const publisherId = Number(order.publisher_id);
      const amount      = Number(order.amount ?? 0);
      const opcShare    = Number(order.opc_share ?? amount * 0.9);

      await db.insert(notificationsTable).values({
        userId: opcId,
        type: "delivery_accepted",
        title: "订单已结算",
        content: `订单已通过最终验收，您的结算金额为 ¥${opcShare.toLocaleString()}，将在3个工作日内到账。`,
        relatedId: orderId,
        relatedType: "order",
      });

      await db.insert(notificationsTable).values({
        userId: publisherId,
        type: "delivery_accepted",
        title: "订单已完成",
        content: `您的订单所有里程碑均已通过验收，系统已自动完成结算。`,
        relatedId: orderId,
        relatedType: "order",
      });

      logger.info({ orderId, opcShare }, "Order auto-completed and settlement triggered");
    }
  } catch (err) {
    logger.error({ err, orderId }, "Settlement check failed");
  }
}

/* ─────────────────────────────────────────────────
   Start all scheduled jobs
   ───────────────────────────────────────────────── */
export function startScheduler() {
  logger.info("Starting background scheduler");

  autoConvertDirectedToOpen();
  setInterval(autoConvertDirectedToOpen, 15 * 60 * 1000);

  autoAcceptStaleDeliverables();
  setInterval(autoAcceptStaleDeliverables, HOUR_MS);

  logger.info("Background scheduler started (48h auto-convert every 15min, 7-day auto-accept every 1h)");
}
