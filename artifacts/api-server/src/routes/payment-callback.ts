import { Router, type IRouter } from "express";
import { db, enrollmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/* Async payment notification from payment service — no auth required */
router.post("/payment/callback", async (req, res) => {
  try {
    const { businessOrderNo, status } = req.body as { businessOrderNo?: string; status?: string };

    if (!businessOrderNo || !status) {
      return res.status(400).json({ error: "缺少必要参数" });
    }

    if (status === "PAID") {
      const match = businessOrderNo.match(/^JDB-(\d+)-\d+$/);
      if (match) {
        const enrollmentId = parseInt(match[1]);
        await db.update(enrollmentsTable)
          .set({ paymentStatus: "paid" })
          .where(eq(enrollmentsTable.id, enrollmentId));
      }
    }

    res.json({ code: 0, message: "success" });
  } catch {
    res.status(500).json({ error: "回调处理失败" });
  }
});

export default router;
