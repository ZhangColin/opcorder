import { Router, type IRouter } from "express";
import { db, enrollmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PAYMENT_STATUS } from "../lib/payment";

const router: IRouter = Router();

/**
 * Async payment notification from the payment provider.
 * No session auth required — this is called server-to-server.
 *
 * The request body IS the PaymentOrderResponse directly (same shape as
 * the data field in query/create responses). Key fields:
 *   paymentOrderNo — payment provider's order number (our FK in enrollments)
 *   status         — integer: 1=待支付 2=已支付 3=支付失败 4=已取消 5=已过期
 *
 * We look up the enrollment by paymentOrderNo (not by parsing businessOrderNo)
 * and update it if status === 2 (paid). Idempotent — safe to receive multiple times.
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
      return res.status(200).send(); // always 200 so provider doesn't retry
    }

    // Find enrollment by paymentOrderNo
    const [enrollment] = await db
      .select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.paymentOrderNo, paymentOrderNo));

    if (!enrollment) {
      console.warn(`[payment-callback] no enrollment found for paymentOrderNo=${paymentOrderNo}`);
      return res.status(200).send();
    }

    // Idempotent: already marked paid
    if (enrollment.paymentStatus === "paid") {
      console.log(`[payment-callback] enrollment ${enrollment.id} already paid, skipping`);
      return res.status(200).send();
    }

    // status === 2 means paid
    if (status === PAYMENT_STATUS.PAID) {
      await db
        .update(enrollmentsTable)
        .set({ paymentStatus: "paid" })
        .where(eq(enrollmentsTable.id, enrollment.id));
      console.log(`[payment-callback] enrollment ${enrollment.id} marked paid`);
    } else {
      console.log(`[payment-callback] enrollment ${enrollment.id} status=${status} — no update`);
    }

    res.status(200).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "回调处理失败";
    console.error(`[payment-callback] error: ${msg}`);
    res.status(200).send(); // always 200 — provider does not retry anyway
  }
});

export default router;
