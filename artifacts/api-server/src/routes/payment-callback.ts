import { Router, type IRouter } from "express";
import { db, enrollmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { queryPaymentStatus } from "../lib/payment";

const router: IRouter = Router();

/**
 * Async payment notification from payment service.
 * No session auth required (called by payment provider), but we NEVER
 * trust the `status` field from the request body. We always re-query the
 * payment provider server-to-server to confirm the true status before
 * updating the enrollment. This prevents forged callbacks from unlocking
 * paid courses for free.
 */
router.post("/payment/callback", async (req, res) => {
  try {
    const { businessOrderNo } = req.body as { businessOrderNo?: string };

    if (!businessOrderNo) {
      return res.status(400).json({ code: 1, message: "缺少 businessOrderNo" });
    }

    const match = businessOrderNo.match(/^JDB-(\d+)-\d+$/);
    if (!match) {
      return res.status(400).json({ code: 1, message: "无效的订单号格式" });
    }

    const enrollmentId = parseInt(match[1]);
    const [enrollment] = await db.select().from(enrollmentsTable)
      .where(eq(enrollmentsTable.id, enrollmentId));

    if (!enrollment) {
      return res.json({ code: 0, message: "success" });
    }

    if (enrollment.paymentStatus === "paid") {
      return res.json({ code: 0, message: "success" });
    }

    if (!enrollment.paymentOrderNo) {
      return res.json({ code: 0, message: "success" });
    }

    /* Server-to-server verification — never trust the callback body's status */
    const order = await queryPaymentStatus(enrollment.paymentOrderNo);

    if (order.status === "PAID") {
      await db.update(enrollmentsTable)
        .set({ paymentStatus: "paid" })
        .where(eq(enrollmentsTable.id, enrollmentId));
    }

    res.json({ code: 0, message: "success" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "回调处理失败";
    res.status(500).json({ code: 1, message: msg });
  }
});

export default router;
