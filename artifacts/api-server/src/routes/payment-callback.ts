import { Router, type IRouter } from "express";
import { db, enrollmentsTable, demandPaymentsTable, demandsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PAYMENT_STATUS } from "../lib/payment";

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

export default router;
