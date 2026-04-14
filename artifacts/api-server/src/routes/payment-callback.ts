import { Router, type IRouter } from "express";
import { db, enrollmentsTable, demandPaymentsTable, demandsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { PAYMENT_STATUS } from "../lib/payment";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { paymentOrderNo, status } = body;

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

    // No matching record found
    console.warn(`[payment-callback] no matching enrollment or demand payment for paymentOrderNo=${paymentOrderNo}`);
    res.status(200).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "回调处理失败";
    console.error(`[payment-callback] error: ${msg}`);
    res.status(200).send(); // always 200 — provider does not retry anyway
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

    res.status(200).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "退款回调处理失败";
    console.error(`[refund-callback] error: ${msg}`);
    res.status(200).send();
  }
});

export default router;
