import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2OutsourceOrdersTable, v2OutsourceDemandsTable, v2TendersTable,
  v2ContractsTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/outsource-orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, outsourceDemandId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;

    const conditions: any[] = [];
    if (status) conditions.push(eq(v2OutsourceOrdersTable.status, status as any));
    if (outsourceDemandId) conditions.push(eq(v2OutsourceOrdersTable.outsourceDemandId, parseInt(outsourceDemandId)));
    if (role === "opc") conditions.push(eq(v2OutsourceOrdersTable.opcId, userId));
    else if (role === "publisher") return res.status(403).json({ error: "发单方无权查看外包订单" });

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalRow] = await db.select({ count: count() }).from(v2OutsourceOrdersTable).where(whereClause);

    const rows = await db
      .select({
        id: v2OutsourceOrdersTable.id,
        orderNo: v2OutsourceOrdersTable.orderNo,
        outsourceDemandId: v2OutsourceOrdersTable.outsourceDemandId,
        demandTitle: v2OutsourceDemandsTable.title,
        tenderId: v2OutsourceOrdersTable.tenderId,
        opcId: v2OutsourceOrdersTable.opcId,
        opcNickname: usersTable.nickname,
        status: v2OutsourceOrdersTable.status,
        warrantyEndDate: v2OutsourceOrdersTable.warrantyEndDate,
        createdAt: v2OutsourceOrdersTable.createdAt,
        updatedAt: v2OutsourceOrdersTable.updatedAt,
      })
      .from(v2OutsourceOrdersTable)
      .leftJoin(v2OutsourceDemandsTable, eq(v2OutsourceOrdersTable.outsourceDemandId, v2OutsourceDemandsTable.id))
      .leftJoin(usersTable, eq(v2OutsourceOrdersTable.opcId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(v2OutsourceOrdersTable.createdAt))
      .limit(lim)
      .offset(offset);

    // 批量附带合同 OPC 确认时间（仅 pending_contract 订单有意义）
    const pendingIds = rows.filter(r => r.status === "pending_contract").map(r => r.id);
    const contractOpcMap: Record<number, string | null> = {};
    if (pendingIds.length > 0) {
      const contracts = await db
        .select({ outsourceOrderId: v2ContractsTable.outsourceOrderId, opcConfirmedAt: v2ContractsTable.opcConfirmedAt })
        .from(v2ContractsTable)
        .where(inArray(v2ContractsTable.outsourceOrderId, pendingIds));
      for (const c of contracts) {
        if (c.outsourceOrderId != null && contractOpcMap[c.outsourceOrderId] === undefined) {
          contractOpcMap[c.outsourceOrderId] = c.opcConfirmedAt ? c.opcConfirmedAt.toISOString() : null;
        }
      }
    }
    const items = rows.map(r => ({
      ...r,
      contractOpcConfirmedAt: contractOpcMap[r.id] ?? null,
    }));

    return res.json({ total: Number(totalRow.count), page: pg, limit: lim, items });
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-orders failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/outsource-orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "发单方无权查看外包订单" });

    const [order] = await db
      .select({
        id: v2OutsourceOrdersTable.id,
        orderNo: v2OutsourceOrdersTable.orderNo,
        outsourceDemandId: v2OutsourceOrdersTable.outsourceDemandId,
        demandTitle: v2OutsourceDemandsTable.title,
        tenderId: v2OutsourceOrdersTable.tenderId,
        contractId: v2ContractsTable.id,
        opcId: v2OutsourceOrdersTable.opcId,
        opcNickname: usersTable.nickname,
        signedFileUrl: v2ContractsTable.signedFileUrl,
        status: v2OutsourceOrdersTable.status,
        warrantyEndDate: v2OutsourceOrdersTable.warrantyEndDate,
        cancelledReason: v2OutsourceOrdersTable.cancelledReason,
        createdAt: v2OutsourceOrdersTable.createdAt,
        updatedAt: v2OutsourceOrdersTable.updatedAt,
      })
      .from(v2OutsourceOrdersTable)
      .leftJoin(v2OutsourceDemandsTable, eq(v2OutsourceOrdersTable.outsourceDemandId, v2OutsourceDemandsTable.id))
      .leftJoin(usersTable, eq(v2OutsourceOrdersTable.opcId, usersTable.id))
      .leftJoin(v2ContractsTable, and(eq(v2ContractsTable.outsourceOrderId, v2OutsourceOrdersTable.id), eq(v2ContractsTable.channel, "b")))
      .where(eq(v2OutsourceOrdersTable.id, id))
      .limit(1);

    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (role === "opc" && order.opcId !== userId) return res.status(403).json({ error: "无权查看" });

    return res.json(order);
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-orders/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-orders/:id/upload-signed-contract", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    const [order] = await db.select().from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, id)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (order.status !== "pending_contract") return res.status(400).json({ error: "订单不在待签约状态" });

    const { signedFileUrl } = req.body as { signedFileUrl: string };
    if (!signedFileUrl) return res.status(400).json({ error: "signedFileUrl 必填" });

    const [linkedContract] = await db.select({ id: v2ContractsTable.id })
      .from(v2ContractsTable)
      .where(and(eq(v2ContractsTable.outsourceOrderId, id), eq(v2ContractsTable.channel, "b")))
      .limit(1);
    if (!linkedContract) return res.status(400).json({ error: "订单尚无关联合同" });

    const [contract] = await db.update(v2ContractsTable)
      .set({ signedFileUrl, signedBy: userId, signedAt: new Date(), status: "signed", updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, linkedContract.id))
      .returning();

    const [updatedOrder] = await db.update(v2OutsourceOrdersTable)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(v2OutsourceOrdersTable.id, id))
      .returning();

    const [demand] = await db.select({ title: v2OutsourceDemandsTable.title })
      .from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, order.outsourceDemandId)).limit(1);

    await notify(order.opcId, "v2_contract_officially_signed", "合同正式签约完成，项目进入执行阶段",
      `外包订单 ${order.orderNo}（「${demand?.title}」）已签约，运营方已上传合同文件，项目正式进入执行阶段。`, id, "v2_outsource_order");

    return res.json({ order: updatedOrder, contract });
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-orders/:id/upload-signed-contract failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-orders/:id/opc-confirm-contract", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== "opc") return res.status(403).json({ error: "仅OPC可确认合同" });

    const [order] = await db.select().from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, id)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (order.opcId !== userId) return res.status(403).json({ error: "无权操作" });
    if (order.status !== "pending_contract") return res.status(400).json({ error: "订单不在待签约状态" });

    const [linkedContract] = await db.select({ id: v2ContractsTable.id, signedFileUrl: v2ContractsTable.signedFileUrl })
      .from(v2ContractsTable)
      .where(and(eq(v2ContractsTable.outsourceOrderId, id), eq(v2ContractsTable.channel, "b")))
      .limit(1);
    if (!linkedContract) return res.status(400).json({ error: "订单尚无关联合同，请联系运营" });

    const { opcSignedFileUrl } = req.body as { opcSignedFileUrl?: string };

    const [contract] = await db.update(v2ContractsTable)
      .set({
        opcConfirmedAt: new Date(),
        ...(opcSignedFileUrl ? { opcSignedFileUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(v2ContractsTable.id, linkedContract.id))
      .returning();

    const [demand] = await db.select({ title: v2OutsourceDemandsTable.title })
      .from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, order.outsourceDemandId)).limit(1);

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_opc_confirmed_contract", "OPC 已确认合同内容",
        `OPC 已确认外包订单 ${order.orderNo}（「${demand?.title}」）合同内容，请安排线下 / 电子签约后上传已签合同文件。`, id, "v2_outsource_order");
    }

    return res.json({ order, contract });
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-orders/:id/opc-confirm-contract failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-orders/:id/admin-verify", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [order] = await db.select().from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, id)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (order.status !== "executing") return res.status(400).json({ error: "订单未在执行中，无法验收" });

    const { warrantyMonths = 3 } = req.body as { warrantyMonths?: number };
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);

    const [updated] = await db.update(v2OutsourceOrdersTable)
      .set({ status: "warranty", warrantyEndDate, updatedAt: new Date() })
      .where(eq(v2OutsourceOrdersTable.id, id))
      .returning();

    await notify(order.opcId, "v2_warranty_started", "外包订单已进入质保期",
      `外包订单 ${order.orderNo} 已通过验收，进入${warrantyMonths}个月质保期，截止至 ${warrantyEndDate.toLocaleDateString("zh-CN")}。`, id, "v2_outsource_order");

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-orders/:id/admin-verify failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-orders/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.select().from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, id)).limit(1);
    if (!order) return res.status(404).json({ error: "外包订单不存在" });
    if (["completed", "cancelled"].includes(order.status)) return res.status(400).json({ error: "订单已结束，不可取消" });

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2OutsourceOrdersTable)
      .set({ status: "cancelled", cancelledReason: reason, updatedAt: new Date() })
      .where(eq(v2OutsourceOrdersTable.id, id))
      .returning();

    await notify(order.opcId, "v2_tender_cancelled", "外包订单已被取消",
      `外包订单 ${order.orderNo} 已被运营方取消${reason ? `，原因：${reason}` : ""}。`, id, "v2_outsource_order");

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-orders/:id/cancel failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
