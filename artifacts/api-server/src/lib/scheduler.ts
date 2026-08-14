import {
  db,
  demandsTable,
  bidsTable,
  deliverableStatusEnum,
  ordersTable,
  notificationsTable,
  demandPaymentsTable,
  usersTable,
  v2ClientDemandsTable,
  v2OutsourceOrdersTable,
} from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { startComputeScheduler } from "./compute-scheduler";
import { queryRefundStatus, isRefundSuccess, isRefundFailed } from "./payment";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_missing_placeholder");

function buildSimpleEmail(nickname: string, body: string): string {
  const escaped = body.replace(/\n/g, "<br>");
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>您好，${nickname}，</p><p>${escaped}</p><p>— 接单吧团队</p></div>`;
}

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
   JOB 3: Poll online refund status
   For demands with status=refunding + online payment, periodically
   query the payment service for the refund result.
   ───────────────────────────────────────────────── */
async function pollOnlineRefundStatus() {
  try {
    const refundingPayments = await db
      .select({
        id: demandPaymentsTable.id,
        demandId: demandPaymentsTable.demandId,
        refundOrderNo: demandPaymentsTable.refundOrderNo,
        method: demandPaymentsTable.method,
      })
      .from(demandPaymentsTable)
      .where(and(
        eq(demandPaymentsTable.status, "refunding"),
        eq(demandPaymentsTable.method, "online"),
      ));

    for (const p of refundingPayments) {
      if (!p.refundOrderNo) continue;
      try {
        const result = await queryRefundStatus(p.refundOrderNo);

        if (isRefundSuccess(result)) {
          const now = new Date();
          const [demand] = await db
            .select({ publisherId: demandsTable.publisherId, title: demandsTable.title })
            .from(demandsTable)
            .where(eq(demandsTable.id, p.demandId))
            .limit(1);

          await db.transaction(async (tx) => {
            await tx.update(demandPaymentsTable).set({
              status: "refunded",
              refundedAt: now,
            }).where(eq(demandPaymentsTable.id, p.id));

            await tx.update(demandsTable).set({ status: "refunded", updatedAt: now })
              .where(eq(demandsTable.id, p.demandId));

            if (demand?.publisherId) {
              await tx.insert(notificationsTable).values({
                userId: demand.publisherId, type: "system",
                title: "保证金已退款成功",
                content: `您的需求「${demand?.title}」的保证金已成功退还，请确认到账情况。`,
                relatedId: p.demandId, relatedType: "demand",
              });

              const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
                .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);
              if (pub?.email) {
                await resend.emails.send({
                  from: "接单吧 <noreply@opcorder.com>", to: pub.email,
                  subject: `保证金已退款 — 需求「${demand?.title}」`,
                  html: buildSimpleEmail(pub.nickname ?? pub.email, `您的需求「${demand?.title}」的保证金已成功退还，请确认到账情况。如有问题请联系平台客服。`),
                }).catch(() => {});
              }
            }
          });

          logger.info({ paymentId: p.id, demandId: p.demandId, refundOrderNo: p.refundOrderNo }, "Online refund confirmed via polling");
        } else if (isRefundFailed(result)) {
          logger.warn({ paymentId: p.id, refundOrderNo: p.refundOrderNo, status: result.status, statusName: result.statusName }, "Online refund failed via polling");
        } else {
          logger.info({ paymentId: p.id, refundOrderNo: p.refundOrderNo, status: result.status, statusName: result.statusName }, "Online refund still processing");
        }
      } catch (innerErr) {
        logger.error({ err: innerErr, paymentId: p.id, refundOrderNo: p.refundOrderNo }, "Failed to query refund status");
      }
    }
  } catch (err) {
    logger.error({ err }, "pollOnlineRefundStatus job failed");
  }
}

/* ─────────────────────────────────────────────────
   JOB 4: V2 warranty auto-complete
   Once warrantyEndDate has passed, mark v2_client_demands and
   v2_outsource_orders as 'completed'.
   ───────────────────────────────────────────────── */
async function autoCompleteV2WarrantyPeriods() {
  try {
    const now = new Date();

    const expiredClientDemands = await db
      .select({ id: v2ClientDemandsTable.id, publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
      .from(v2ClientDemandsTable)
      .where(and(
        eq(v2ClientDemandsTable.status, "warranty"),
        lt(v2ClientDemandsTable.warrantyEndDate, now),
      ));

    for (const demand of expiredClientDemands) {
      await db.update(v2ClientDemandsTable)
        .set({ status: "completed", updatedAt: now })
        .where(eq(v2ClientDemandsTable.id, demand.id));
      await db.insert(notificationsTable).values({
        userId: demand.publisherId,
        type: "order_completed",
        title: "需求质保期已满，项目完成",
        content: `需求「${demand.title}」质保期已结束，项目已自动完成。`,
        relatedId: demand.id,
        relatedType: "v2_client_demand",
      });
      logger.info({ demandId: demand.id }, "V2 client demand warranty expired → completed");
    }

    const expiredOrders = await db
      .select({ id: v2OutsourceOrdersTable.id, opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable)
      .where(and(
        eq(v2OutsourceOrdersTable.status, "warranty"),
        lt(v2OutsourceOrdersTable.warrantyEndDate, now),
      ));

    for (const order of expiredOrders) {
      await db.update(v2OutsourceOrdersTable)
        .set({ status: "completed", updatedAt: now })
        .where(eq(v2OutsourceOrdersTable.id, order.id));
      await db.insert(notificationsTable).values({
        userId: order.opcId,
        type: "order_completed",
        title: "外包订单质保期已满，已完成",
        content: `外包订单 ${order.orderNo} 质保期已结束，订单已自动完成。`,
        relatedId: order.id,
        relatedType: "v2_outsource_order",
      });
      logger.info({ orderId: order.id }, "V2 outsource order warranty expired → completed");
    }

    if (expiredClientDemands.length > 0 || expiredOrders.length > 0) {
      logger.info(
        { clientDemands: expiredClientDemands.length, orders: expiredOrders.length },
        "V2 warranty auto-complete job ran"
      );
    }
  } catch (err) {
    logger.error({ err }, "V2 warranty auto-complete job failed");
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

  pollOnlineRefundStatus();
  setInterval(pollOnlineRefundStatus, 5 * 60 * 1000); // every 5 min

  autoCompleteV2WarrantyPeriods();
  setInterval(autoCompleteV2WarrantyPeriods, HOUR_MS); // hourly

  startComputeScheduler();

  logger.info("Background scheduler started (48h auto-convert every 15min, 7-day auto-accept every 1h, refund poll every 5min, v2 warranty every 1h)");
}
