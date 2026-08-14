import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, enrollmentsTable, demandPaymentsTable, demandsTable, notificationsTable, usersTable, v2PaymentPlansTable, v2ClientDemandsTable, toolSubscriptionsTable } from "@workspace/db";
import { activateToolSubscription } from "./tools";
import { eq, and, or } from "drizzle-orm";
import { PAYMENT_STATUS } from "../lib/payment";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_missing_placeholder");

const router: IRouter = Router();

/**
 * Async payment notification from the payment provider.
 * No session auth required — this is called server-to-server.
 *
 * The request body IS the PaymentOrderResponse directly (same shape as
 * the data field in query/create responses). Key fields:
 *   paymentOrderNo — payment provider's order number (our FK in enrollments / demand_payments)
 *   status         — integer: 1=待支付 2=已支付 3=支付失败 4=已取消 5=已过期
 *
 * Handles two business flows:
 *   1. Course enrollment payments (looks up enrollments.paymentOrderNo)
 *   2. Demand deposit payments    (looks up demand_payments.paymentOrderNo)
 *      → on paid: confirm payment + publish demand + send notification
 */
router.post("/payment/callback", async (req, res) => {
  const body = req.body as {
    paymentOrderNo?: string;
    businessOrderNo?: string;
    status?: number;
    statusName?: string;
    paidAt?: string | null;
  };

  console.log(`[payment-callback] received paymentOrderNo=${body.paymentOrderNo} businessOrderNo=${body.businessOrderNo} status=${body.status}(${body.statusName}) paidAt=${body.paidAt}`);

  try {
    const { paymentOrderNo, status, businessOrderNo } = body;

    if (!paymentOrderNo) {
      console.warn("[payment-callback] missing paymentOrderNo");
      return res.status(200).send();
    }

    // ── 1. Try to match a course enrollment ───────────────────────────────
    const [enrollment] = await db
      .select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.paymentOrderNo, paymentOrderNo));

    if (enrollment) {
      if (enrollment.paymentStatus === "paid") {
        console.log(`[payment-callback] enrollment ${enrollment.id} already paid, skipping`);
        return res.status(200).send();
      }

      if (status === PAYMENT_STATUS.PAID) {
        await db
          .update(enrollmentsTable)
          .set({ paymentStatus: "paid" })
          .where(eq(enrollmentsTable.id, enrollment.id));
        console.log(`[payment-callback] enrollment ${enrollment.id} marked paid`);
      } else {
        console.log(`[payment-callback] enrollment ${enrollment.id} status=${status} — no update`);
      }

      return res.status(200).send();
    }

    // ── 2. Try to match a demand deposit payment ───────────────────────────
    const [demandPayment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.paymentOrderNo, paymentOrderNo));

    if (demandPayment) {
      if (demandPayment.status === "confirmed" || demandPayment.status === "refunded") {
        console.log(`[payment-callback] demandPayment ${demandPayment.id} already ${demandPayment.status}, skipping`);
        return res.status(200).send();
      }

      if (status === PAYMENT_STATUS.PAID) {
        const [demand] = await db
          .select({ publisherId: demandsTable.publisherId, title: demandsTable.title, status: demandsTable.status })
          .from(demandsTable)
          .where(eq(demandsTable.id, demandPayment.demandId));

        const now = new Date();
        await db.transaction(async (tx) => {
          await tx.update(demandPaymentsTable).set({
            status: "confirmed",
            confirmedAt: now,
          }).where(eq(demandPaymentsTable.id, demandPayment.id));

          if (demand && demand.status === "pending_payment") {
            await tx.update(demandsTable).set({
              status: "published",
              updatedAt: now,
            }).where(eq(demandsTable.id, demandPayment.demandId));

            if (demand.publisherId) {
              await tx.insert(notificationsTable).values({
                userId: demand.publisherId,
                type: "system",
                title: "保证金已到账，需求已发布",
                content: `您的需求「${demand.title}」的保证金已到账确认，需求现已在需求大厅公开发布，OPC可以查看并投标。`,
                relatedId: demandPayment.demandId,
                relatedType: "demand",
              });
            }
          }
        });

        console.log(`[payment-callback] demandPayment ${demandPayment.id} confirmed, demand ${demandPayment.demandId} published`);
      } else {
        console.log(`[payment-callback] demandPayment ${demandPayment.id} status=${status} — no update`);
      }

      return res.status(200).send();
    }

    // ── 3. Try to match a v2 payment plan ─────────────────────────────────
    const [v2Plan] = await db
      .select()
      .from(v2PaymentPlansTable)
      .where(eq(v2PaymentPlansTable.paymentOrderNo, paymentOrderNo))
      .limit(1);

    if (v2Plan) {
      if (v2Plan.status === "paid") {
        console.log(`[payment-callback] v2Plan ${v2Plan.id} already paid, skipping`);
        return res.status(200).send();
      }

      if (status === PAYMENT_STATUS.PAID) {
        const now = new Date();
        await db.update(v2PaymentPlansTable)
          .set({ status: "paid", paidAt: now, updatedAt: now })
          .where(eq(v2PaymentPlansTable.id, v2Plan.id));

        const admins = await db.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.role, "admin"));
        for (const admin of admins) {
          await db.insert(notificationsTable).values({
            userId: admin.id,
            type: "system",
            title: "发单方在线支付成功（回调）",
            content: `收款计划项 #${v2Plan.itemNo}（¥${v2Plan.amount.toLocaleString()}）已通过支付网关确认到账。`,
            relatedId: v2Plan.clientDemandId,
            relatedType: "v2_client_demand",
          });
        }
        console.log(`[payment-callback] v2Plan ${v2Plan.id} marked paid via gateway callback`);
      } else {
        console.log(`[payment-callback] v2Plan ${v2Plan.id} status=${status} — no update`);
      }

      return res.status(200).send();
    }

    // ── 4. Try to match a tool platform subscription ──────────────────────
    // 支持按业务单号兜底匹配:网关下单成功但服务崩溃于回填 payment_order_no 之前时,
    // 意向单(business_order_no)已持久化,回调仍可定位并激活(激活前会向网关核验)。
    const [toolSub] = await db
      .select()
      .from(toolSubscriptionsTable)
      .where(businessOrderNo
        ? or(eq(toolSubscriptionsTable.paymentOrderNo, paymentOrderNo), eq(toolSubscriptionsTable.businessOrderNo, businessOrderNo))!
        : eq(toolSubscriptionsTable.paymentOrderNo, paymentOrderNo))
      .limit(1);

    if (toolSub) {
      if (status === PAYMENT_STATUS.PAID) {
        const activated = await activateToolSubscription(paymentOrderNo);
        console.log(`[payment-callback] toolSubscription ${toolSub.id} ${activated ? "activated" : "already processed"}`);
      } else {
        console.log(`[payment-callback] toolSubscription ${toolSub.id} status=${status} — no update`);
      }
      return res.status(200).send();
    }

    // No matching record found
    console.warn(`[payment-callback] no matching enrollment, demand payment, v2 plan, or tool subscription for paymentOrderNo=${paymentOrderNo}`);
    return res.status(200).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "回调处理失败";
    logger.error({ err: msg }, "[payment-callback] error");
    return res.status(200).send(); // always 200 — provider does not retry anyway
  }
});

/**
 * Async refund result notification from the payment provider.
 * Called when a refund transitions to a terminal state.
 * Body contains: { refundOrderNo, status ("SUCCESS"/"FAILED"), amount }
 */
router.post("/payment/refund-callback", async (req, res) => {
  const body = req.body as {
    refundOrderNo?: string;
    status?: string;
    amount?: number;
  };

  console.log(`[refund-callback] received refundOrderNo=${body.refundOrderNo} status=${body.status}`);

  try {
    const { refundOrderNo, status } = body;
    if (!refundOrderNo) {
      console.warn("[refund-callback] missing refundOrderNo");
      return res.status(200).send();
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.refundOrderNo, refundOrderNo))
      .limit(1);

    if (!payment) {
      console.warn(`[refund-callback] no payment found for refundOrderNo=${refundOrderNo}`);
      return res.status(200).send();
    }

    if (payment.status === "refunded") {
      console.log(`[refund-callback] payment ${payment.id} already refunded, skipping`);
      return res.status(200).send();
    }

    const statusUpper = (status ?? "").toUpperCase();
    if (statusUpper === "SUCCESS" || statusUpper === "REFUNDED") {
      const now = new Date();
      const [demand] = await db
        .select({ publisherId: demandsTable.publisherId, title: demandsTable.title })
        .from(demandsTable)
        .where(eq(demandsTable.id, payment.demandId))
        .limit(1);

      await db.transaction(async (tx) => {
        await tx.update(demandPaymentsTable).set({ status: "refunded", refundedAt: now })
          .where(eq(demandPaymentsTable.id, payment.id));
        await tx.update(demandsTable).set({ status: "refunded", updatedAt: now })
          .where(eq(demandsTable.id, payment.demandId));

        if (demand?.publisherId) {
          await tx.insert(notificationsTable).values({
            userId: demand.publisherId, type: "system",
            title: "保证金已退款成功",
            content: `您的需求「${demand.title}」的保证金已成功退还，请确认到账情况。`,
            relatedId: payment.demandId, relatedType: "demand",
          });

          const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
            .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);
          if (pub?.email) {
            await resend.emails.send({
              from: "接单吧 <noreply@opcorder.com>", to: pub.email,
              subject: `保证金已退款 — 需求「${demand.title}」`,
              html: `<p>您好，${pub.nickname ?? pub.email}，</p><p>您的需求「${demand.title}」的保证金已成功退还，请确认到账情况。如有问题请联系平台客服。</p><p>— 接单吧团队</p>`,
            }).catch(() => {});
          }
        }
      });
      console.log(`[refund-callback] payment ${payment.id} marked refunded`);
    } else {
      console.log(`[refund-callback] payment ${payment.id} refund status=${status} — no terminal update`);
    }

    return res.status(200).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "退款回调处理失败";
    logger.error({ err: msg }, "[refund-callback] error");
    return res.status(200).send();
  }
});

export default router;
