import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2SettlementPlansTable, v2OutsourceOrdersTable, v2OutsourceDemandsTable,
  v2TicketsBTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/settlement-plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { outsourceOrderId, status } = req.query as Record<string, string>;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看结算计划" });

    const conditions: any[] = [];
    if (outsourceOrderId) conditions.push(eq(v2SettlementPlansTable.outsourceOrderId, parseInt(outsourceOrderId)));
    if (status) conditions.push(eq(v2SettlementPlansTable.status, status as any));

    if (role === "opc") {
      if (outsourceOrderId) {
        // 查具体订单的收款计划（合同详情用），只要是自己的订单即可
        const [ord] = await db
          .select({ id: v2OutsourceOrdersTable.id })
          .from(v2OutsourceOrdersTable)
          .where(and(eq(v2OutsourceOrdersTable.id, parseInt(outsourceOrderId)), eq(v2OutsourceOrdersTable.opcId, userId)))
          .limit(1);
        if (!ord) return res.json([]);
      } else {
        // 全局收款列表：只显示已签约后的订单收款项
        const signedStatuses = ["executing", "warranty", "completed"] as const;
        const myOrders = await db
          .select({ id: v2OutsourceOrdersTable.id })
          .from(v2OutsourceOrdersTable)
          .where(
            and(
              eq(v2OutsourceOrdersTable.opcId, userId),
              inArray(v2OutsourceOrdersTable.status, signedStatuses as unknown as string[]),
            )
          );
        const ids = myOrders.map(o => o.id);
        if (ids.length === 0) return res.json([]);
        conditions.push(inArray(v2SettlementPlansTable.outsourceOrderId, ids));
      }
    }

    // admin 全局列表（非按订单查询）：排除未签约订单的付款项
    if (role === "admin" && !outsourceOrderId) {
      conditions.push(ne(v2OutsourceOrdersTable.status, "pending_contract"));
    }

    const rows = await db
      .select({
        id: v2SettlementPlansTable.id,
        outsourceOrderId: v2SettlementPlansTable.outsourceOrderId,
        opcId: v2SettlementPlansTable.opcId,
        itemNo: v2SettlementPlansTable.itemNo,
        description: v2SettlementPlansTable.description,
        amount: v2SettlementPlansTable.amount,
        dueDate: v2SettlementPlansTable.dueDate,
        status: v2SettlementPlansTable.status,
        isLastItem: v2SettlementPlansTable.isLastItem,
        paymentVoucherUrl: v2SettlementPlansTable.paymentVoucherUrl,
        paidAt: v2SettlementPlansTable.paidAt,
        createdAt: v2SettlementPlansTable.createdAt,
        updatedAt: v2SettlementPlansTable.updatedAt,
        orderNo: v2OutsourceOrdersTable.orderNo,
        orderStatus: v2OutsourceOrdersTable.status,
        demandTitle: v2OutsourceDemandsTable.title,
      })
      .from(v2SettlementPlansTable)
      .leftJoin(v2OutsourceOrdersTable, eq(v2SettlementPlansTable.outsourceOrderId, v2OutsourceOrdersTable.id))
      .leftJoin(v2OutsourceDemandsTable, eq(v2OutsourceOrdersTable.outsourceDemandId, v2OutsourceDemandsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(v2SettlementPlansTable.dueDate);

    const now = new Date();
    const enriched = rows.map(r => ({
      ...r,
      title: r.description ?? `第 ${r.itemNo} 期`,
      isBlockingPayment: false,
      isOverdue: r.status === "pending" && r.dueDate < now,
    }));

    return res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /v2/settlement-plans failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/settlement-plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看结算计划" });
    const [plan] = await db.select().from(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "结算计划不存在" });
    if (role === "opc") {
      const [order] = await db
        .select({ opcId: v2OutsourceOrdersTable.opcId })
        .from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.id, plan.outsourceOrderId))
        .limit(1);
      if (!order || order.opcId !== userId) return res.status(403).json({ error: "无权访问" });
    }
    const now = new Date();
    return res.json({ ...plan, isOverdue: plan.status === "pending" && plan.dueDate < now });
  } catch (err) {
    logger.error({ err }, "GET /v2/settlement-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/settlement-plans", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { outsourceOrderId, contractId, itemNo, description, amount, dueDate, isLastItem } = req.body as {
      outsourceOrderId: number; contractId?: number; itemNo?: number;
      description?: string; amount: number; dueDate: string; isLastItem?: boolean;
    };
    if (!outsourceOrderId || typeof amount !== "number" || !dueDate) {
      return res.status(400).json({ error: "outsourceOrderId、amount、dueDate 必填" });
    }

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, outsourceOrderId)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });

    const existing = await db.select({ id: v2SettlementPlansTable.id })
      .from(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.outsourceOrderId, outsourceOrderId));
    const autoItemNo = itemNo ?? (existing.length + 1);

    const [created] = await db.insert(v2SettlementPlansTable).values({
      outsourceOrderId,
      contractId,
      opcId: order.opcId,
      itemNo: autoItemNo,
      description,
      amount,
      dueDate: new Date(dueDate),
      isLastItem: !!isLastItem,
      createdBy: userId,
    }).returning();

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/settlement-plans failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/settlement-plans/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "结算计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已结算的计划不可修改" });

    const { itemNo, description, amount, dueDate, isLastItem } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (itemNo !== undefined) updates.itemNo = itemNo;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
    if (isLastItem !== undefined) updates.isLastItem = !!isLastItem;

    const [updated] = await db.update(v2SettlementPlansTable).set(updates)
      .where(eq(v2SettlementPlansTable.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/settlement-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/settlement-plans/:id/mark-paid", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [plan] = await db.select().from(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "结算计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已结算" });

    if (plan.isLastItem) {
      const blockingTickets = await db
        .select({ id: v2TicketsBTable.id })
        .from(v2TicketsBTable)
        .where(and(
          eq(v2TicketsBTable.outsourceOrderId, plan.outsourceOrderId),
          eq(v2TicketsBTable.status, "open"),
          eq(v2TicketsBTable.isBlockingPayment, true)
        ));
      if (blockingTickets.length > 0) {
        return res.status(400).json({ error: `存在 ${blockingTickets.length} 个阻断工单未关闭，尾款无法打款` });
      }
    }

    const { paymentVoucherUrl, paymentNote } = req.body as { paymentVoucherUrl?: string; paymentNote?: string };

    const [updated] = await db.update(v2SettlementPlansTable)
      .set({
        status: "paid",
        paidBy: userId,
        paidAt: new Date(),
        paymentVoucherUrl,
        paymentNote,
        updatedAt: new Date(),
      })
      .where(eq(v2SettlementPlansTable.id, id))
      .returning();

    const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId, orderNo: v2OutsourceOrdersTable.orderNo })
      .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, plan.outsourceOrderId)).limit(1);
    if (order) {
      await notify(order.opcId, "v2_settlement_paid", "结算款已打款",
        `外包订单 ${order.orderNo} 第 ${plan.itemNo} 期结算款 ¥${plan.amount.toLocaleString()} 已完成打款，请确认到账。`, plan.outsourceOrderId, "v2_outsource_order");

      if (plan.isLastItem) {
        await db.update(v2OutsourceOrdersTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(v2OutsourceOrdersTable.id, plan.outsourceOrderId));
        await notify(order.opcId, "v2_settlement_paid", "外包订单已完成结算",
          `外包订单 ${order.orderNo} 全部款项已结清，订单已关闭，感谢您的服务！`, plan.outsourceOrderId, "v2_outsource_order");
      }
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/settlement-plans/:id/mark-paid failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.delete("/settlement-plans/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "结算计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已结算的计划不可删除" });
    await db.delete(v2SettlementPlansTable).where(eq(v2SettlementPlansTable.id, id));
    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, "DELETE /v2/settlement-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
