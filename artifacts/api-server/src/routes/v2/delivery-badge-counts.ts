import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2DeliverablesATable, v2DeliverablesBTable, v2ClientDemandsTable, v2OutsourceOrdersTable } from "@workspace/db";
import { eq, and, inArray, count } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/delivery-badge-counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let pendingA = 0;
    let pendingB = 0;

    if (role === "publisher") {
      const myDemands = await db
        .select({ id: v2ClientDemandsTable.id })
        .from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.publisherId, userId));
      const ids = myDemands.map(d => d.id);
      if (ids.length > 0) {
        const [row] = await db
          .select({ cnt: count() })
          .from(v2DeliverablesATable)
          .where(and(
            inArray(v2DeliverablesATable.clientDemandId, ids),
            eq(v2DeliverablesATable.status, "pending"),
          ));
        pendingA = Number(row?.cnt ?? 0);
      }
    } else if (role === "admin") {
      const [rowA] = await db
        .select({ cnt: count() })
        .from(v2DeliverablesATable)
        .where(eq(v2DeliverablesATable.status, "pending"));
      pendingA = Number(rowA?.cnt ?? 0);

      const [rowB] = await db
        .select({ cnt: count() })
        .from(v2DeliverablesBTable)
        .where(eq(v2DeliverablesBTable.status, "pending"));
      pendingB = Number(rowB?.cnt ?? 0);
    } else if (role === "opc") {
      const myOrders = await db
        .select({ id: v2OutsourceOrdersTable.id })
        .from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.opcId, userId));
      const ids = myOrders.map(o => o.id);
      if (ids.length > 0) {
        const [row] = await db
          .select({ cnt: count() })
          .from(v2DeliverablesBTable)
          .where(and(
            inArray(v2DeliverablesBTable.outsourceOrderId, ids),
            eq(v2DeliverablesBTable.status, "pending"),
          ));
        pendingB = Number(row?.cnt ?? 0);
      }
    }

    return res.json({ pendingA, pendingB });
  } catch (err) {
    logger.error({ err }, "GET /v2/delivery-badge-counts failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
