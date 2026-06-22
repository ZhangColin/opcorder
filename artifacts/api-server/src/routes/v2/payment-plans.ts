import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2PaymentPlansTable, v2ClientDemandsTable, usersTable } from "@workspace/db";
import { eq, and, desc, lt, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";
import { createPaymentOrder, queryPaymentStatus, PAYMENT_STATUS } from "../../lib/payment";

const NOTIFY_URL = "https://www.opcorder.com/api/payment/callback";

const router: IRouter = Router();

router.get("/payment-plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { clientDemandId, contractId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];

    if (clientDemandId) conditions.push(eq(v2PaymentPlansTable.clientDemandId, parseInt(clientDemandId)));
    if (contractId) conditions.push(eq(v2PaymentPlansTable.contractId, parseInt(contractId)));
    if (status) conditions.push(eq(v2PaymentPlansTable.status, status as any));

    if (role === "publisher") {
      const myDemands = await db
        .select({ id: v2ClientDemandsTable.id })
        .from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.publisherId, userId));
      const ids = myDemands.map(d => d.id);
      if (ids.length === 0) return res.json([]);
      conditions.push(inArray(v2PaymentPlansTable.clientDemandId, ids));
    } else if (role === "opc") {
      return res.status(403).json({ error: "OPC 无权查看收款计划" });
    }

    const rows = await db
      .select({
        id: v2PaymentPlansTable.id,
        clientDemandId: v2PaymentPlansTable.clientDemandId,
        contractId: v2PaymentPlansTable.contractId,
        itemNo: v2PaymentPlansTable.itemNo,
        description: v2PaymentPlansTable.description,
        amount: v2PaymentPlansTable.amount,
        dueDate: v2PaymentPlansTable.dueDate,
        status: v2PaymentPlansTable.status,
        voucherUrl: v2PaymentPlansTable.voucherUrl,
        paidAt: v2PaymentPlansTable.paidAt,
        isLastItem: v2PaymentPlansTable.isLastItem,
        createdAt: v2PaymentPlansTable.createdAt,
        updatedAt: v2PaymentPlansTable.updatedAt,
        demandTitle: v2ClientDemandsTable.title,
      })
      .from(v2PaymentPlansTable)
      .leftJoin(v2ClientDemandsTable, eq(v2PaymentPlansTable.clientDemandId, v2ClientDemandsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(v2PaymentPlansTable.dueDate);

    const now = new Date();
    const enriched = rows.map(r => ({
      ...r,
      isOverdue: r.status === "pending" && r.dueDate < now,
    }));

    return res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /v2/payment-plans failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/payment-plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "付款计划不存在" });

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title, demandNo: v2ClientDemandsTable.demandNo })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);

    if (role === "publisher") {
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权查看" });
    } else if (role === "opc") {
      return res.status(403).json({ error: "OPC 无权查看此付款计划" });
    }

    const now = new Date();
    return res.json({
      ...plan,
      demandTitle: demand?.title ?? null,
      demandNo: demand?.demandNo ?? null,
      isOverdue: plan.status === "pending" && plan.dueDate < now,
    });
  } catch (err) {
    logger.error({ err }, "GET /v2/payment-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/payment-plans", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { clientDemandId, contractId, itemNo, description, amount, dueDate, isLastItem } = req.body as {
      clientDemandId: number; contractId?: number; itemNo?: number;
      description?: string; amount: number; dueDate: string; isLastItem?: boolean;
    };
    if (!clientDemandId || typeof amount !== "number" || !dueDate) {
      return res.status(400).json({ error: "clientDemandId、amount、dueDate 必填" });
    }

    const [created] = await db.insert(v2PaymentPlansTable).values({
      clientDemandId,
      contractId,
      itemNo: itemNo ?? 1,
      description,
      amount,
      dueDate: new Date(dueDate),
      isLastItem: !!isLastItem,
      createdBy: userId,
    }).returning();

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/payment-plans/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "收款计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已付款的计划不可修改" });

    const { itemNo, description, amount, dueDate, isLastItem } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (itemNo !== undefined) updates.itemNo = itemNo;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
    if (isLastItem !== undefined) updates.isLastItem = !!isLastItem;

    const [updated] = await db.update(v2PaymentPlansTable).set(updates)
      .where(eq(v2PaymentPlansTable.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/payment-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/payment-plans/:id/upload-voucher", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "收款计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已付款" });

    if (role === "publisher") {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    } else if (role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    const { voucherUrl, voucherNote } = req.body as { voucherUrl: string; voucherNote?: string };
    if (!voucherUrl) return res.status(400).json({ error: "voucherUrl 必填" });

    const [updated] = await db.update(v2PaymentPlansTable)
      .set({ status: "awaiting_review", voucherUrl, voucherNote, updatedAt: new Date() })
      .where(eq(v2PaymentPlansTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_payment_voucher_uploaded", "发单方已上传付款凭证",
        `收款计划项 #${plan.itemNo} 的付款凭证已提交，请审核确认。`, plan.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans/:id/upload-voucher failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/payment-plans/:id/create-online-payment", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "付款计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "该期已付款" });

    let demandTitle = "合同付款";
    if (role === "publisher") {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
      demandTitle = demand?.title ?? demandTitle;
    } else if (role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    const businessOrderNo = `v2pp-${id}-${Date.now()}`;
    const order = await createPaymentOrder({
      businessOrderNo,
      amount: Math.round(plan.amount * 100),
      subject: `接单吧 · ${demandTitle} 第${plan.itemNo}期`,
      businessName: "接单吧",
      notifyUrl: NOTIFY_URL,
    });

    await db.update(v2PaymentPlansTable)
      .set({ paymentOrderNo: order.paymentOrderNo, updatedAt: new Date() })
      .where(eq(v2PaymentPlansTable.id, id));

    return res.json({
      qrCodeUrl: order.qrCodeUrl,
      paymentOrderNo: order.paymentOrderNo,
      amount: plan.amount,
      expiredAt: order.expiredAt,
    });
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans/:id/create-online-payment failed");
    return res.status(500).json({ error: "创建支付订单失败" });
  }
});

router.post("/payment-plans/:id/query-online-payment", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "付款计划不存在" });

    if (role === "publisher") {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权查看" });
    } else if (role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    if (plan.status === "paid") return res.json({ status: "paid" });
    if (!plan.paymentOrderNo) return res.json({ status: "no_order" });

    const order = await queryPaymentStatus(plan.paymentOrderNo);

    if (order.status === PAYMENT_STATUS.PAID) {
      const now = new Date();
      await db.update(v2PaymentPlansTable)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(eq(v2PaymentPlansTable.id, id));

      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      for (const admin of admins) {
        await notify(admin.id, "v2_payment_online_paid", "发单方在线支付成功",
          `收款计划项 #${plan.itemNo}（¥${plan.amount.toLocaleString()}）：发单方通过平台在线完成支付。`,
          plan.clientDemandId, "v2_client_demand");
      }

      return res.json({ status: "paid" });
    }

    if (order.status === PAYMENT_STATUS.FAILED ||
        order.status === PAYMENT_STATUS.CANCELLED ||
        order.status === PAYMENT_STATUS.EXPIRED) {
      return res.json({ status: "failed", statusName: order.statusName });
    }

    return res.json({ status: "pending" });
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans/:id/query-online-payment failed");
    return res.status(500).json({ error: "查询支付状态失败" });
  }
});

router.post("/payment-plans/:id/mark-online-paid", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "收款计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已付款" });

    if (role === "publisher") {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    } else if (role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    const [updated] = await db.update(v2PaymentPlansTable)
      .set({
        status: "paid",
        voucherNote: "线上支付（发单方自动确认）",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(v2PaymentPlansTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_payment_online_paid", "发单方声明线上已支付",
        `收款计划项 #${plan.itemNo}（¥${plan.amount.toLocaleString()}）：发单方通过平台确认已线上完成支付。`, plan.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans/:id/mark-online-paid failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/payment-plans/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "收款计划不存在" });
    if (plan.status !== "awaiting_review") return res.status(400).json({ error: "未在待审核状态" });

    const [updated] = await db.update(v2PaymentPlansTable)
      .set({ status: "paid", reviewedBy: userId, reviewedAt: new Date(), paidAt: new Date(), updatedAt: new Date() })
      .where(eq(v2PaymentPlansTable.id, id))
      .returning();

    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, plan.clientDemandId)).limit(1);
    if (demand) {
      await notify(demand.publisherId, "v2_payment_approved", "付款已确认",
        `您的收款计划项 #${plan.itemNo}（¥${plan.amount.toLocaleString()}）已确认到账。`, plan.clientDemandId, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/payment-plans/:id/approve failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.delete("/payment-plans/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id)).limit(1);
    if (!plan) return res.status(404).json({ error: "收款计划不存在" });
    if (plan.status === "paid") return res.status(400).json({ error: "已付款的计划不可删除" });
    await db.delete(v2PaymentPlansTable).where(eq(v2PaymentPlansTable.id, id));
    return res.status(204).end();
  } catch (err) {
    logger.error({ err }, "DELETE /v2/payment-plans/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
