import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2OutsourceDemandsTable, v2OutsourceDemandVersionsTable,
  v2TendersTable, v2OutsourceOrdersTable, v2ClientDemandsTable, usersTable,
} from "@workspace/db";
import { eq, and, or, desc, count, ilike, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genOutsourceDemandNo } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/outsource-demands", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, mode, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;

    const conditions: any[] = [];
    if (status) conditions.push(eq(v2OutsourceDemandsTable.status, status as any));
    if (mode) conditions.push(eq(v2OutsourceDemandsTable.mode, mode as any));
    if (search) conditions.push(ilike(v2OutsourceDemandsTable.title, `%${search}%`));

    if (role === "opc") {
      const myTenders = await db
        .select({ outsourceDemandId: v2TendersTable.outsourceDemandId })
        .from(v2TendersTable)
        .where(eq(v2TendersTable.opcId, userId));
      const myDemandIds = myTenders.map(t => t.outsourceDemandId);

      const publicCondition = eq(v2OutsourceDemandsTable.mode, "public");
      if (myDemandIds.length > 0) {
        conditions.push(
          or(publicCondition, inArray(v2OutsourceDemandsTable.id, myDemandIds))!
        );
      } else {
        conditions.push(publicCondition);
      }
    } else if (role === "publisher") {
      return res.status(403).json({ error: "发单方无权查看外包需求" });
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalRow] = await db.select({ count: count() }).from(v2OutsourceDemandsTable).where(whereClause);
    const rows = await db
      .select({
        id: v2OutsourceDemandsTable.id,
        demandNo: v2OutsourceDemandsTable.demandNo,
        clientDemandId: v2OutsourceDemandsTable.clientDemandId,
        clientDemandTitle: v2ClientDemandsTable.title,
        clientDemandNo: v2ClientDemandsTable.demandNo,
        title: v2OutsourceDemandsTable.title,
        demandType: v2OutsourceDemandsTable.demandType,
        isUrgent: v2OutsourceDemandsTable.isUrgent,
        mode: v2OutsourceDemandsTable.mode,
        expectedPriceMin: v2OutsourceDemandsTable.expectedPriceMin,
        expectedPriceMax: v2OutsourceDemandsTable.expectedPriceMax,
        status: v2OutsourceDemandsTable.status,
        tenderCount: sql<number>`(SELECT COUNT(*)::int FROM v2_tenders WHERE v2_tenders.outsource_demand_id = ${v2OutsourceDemandsTable.id})`,
        createdAt: v2OutsourceDemandsTable.createdAt,
        updatedAt: v2OutsourceDemandsTable.updatedAt,
      })
      .from(v2OutsourceDemandsTable)
      .leftJoin(v2ClientDemandsTable, eq(v2OutsourceDemandsTable.clientDemandId, v2ClientDemandsTable.id))
      .where(whereClause)
      .orderBy(desc(v2OutsourceDemandsTable.createdAt))
      .limit(lim)
      .offset(offset);

    return res.json({ total: Number(totalRow.count), page: pg, limit: lim, items: rows });
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-demands failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-demands", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { clientDemandId, title, demandType, isUrgent, mode, expectedPriceMin, expectedPriceMax, milestones, invitedOpcIds, detail, attachments, status } = req.body as {
      clientDemandId?: number; title: string; demandType?: string; isUrgent?: boolean;
      mode?: "public" | "invited"; expectedPriceMin?: number; expectedPriceMax?: number;
      milestones?: any[]; invitedOpcIds?: number[];
      detail?: string; attachments?: Array<{ name: string; url: string; size?: number }>;
      status?: "draft" | "negotiating";
    };
    if (!title?.trim()) return res.status(400).json({ error: "标题不能为空" });

    const demandNo = await genOutsourceDemandNo();
    const [created] = await db.insert(v2OutsourceDemandsTable).values({
      demandNo,
      clientDemandId,
      createdBy: userId,
      title: title.trim(),
      demandType,
      isUrgent: !!isUrgent,
      mode: mode ?? "public",
      expectedPriceMin,
      expectedPriceMax,
      milestones: milestones ?? [],
      status: status === "draft" ? "draft" : "negotiating",
    }).returning();

    await db.insert(v2OutsourceDemandVersionsTable).values({
      outsourceDemandId: created.id,
      versionNo: 1,
      detail: detail ?? "",
      attachments: attachments ?? [],
      editedBy: userId,
    });

    if (mode === "invited" && Array.isArray(invitedOpcIds) && invitedOpcIds.length > 0) {
      for (const opcId of invitedOpcIds) {
        await db.insert(v2TendersTable).values({
          outsourceDemandId: created.id,
          opcId,
          status: "negotiating",
        });
        await notify(opcId, "v2_demand_invited", "您收到外包需求邀请",
          `平台邀请您参与外包需求「${title.trim()}」的报价，请登录查看详情。`, created.id, "v2_outsource_demand");
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-demands failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/outsource-demands/opc-search", requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    const rows = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email })
      .from(usersTable)
      .where(q
        ? and(eq(usersTable.role, "opc"), ilike(usersTable.nickname, `%${q}%`))
        : eq(usersTable.role, "opc"))
      .limit(20);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-demands/opc-search failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/outsource-demands/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    if (role === "opc" && demand.mode === "invited") {
      const [myTender] = await db
        .select({ id: v2TendersTable.id })
        .from(v2TendersTable)
        .where(and(eq(v2TendersTable.outsourceDemandId, id), eq(v2TendersTable.opcId, userId)))
        .limit(1);
      if (!myTender) return res.status(403).json({ error: "无权查看此外包需求" });
    }

    const [latestVersion] = await db
      .select()
      .from(v2OutsourceDemandVersionsTable)
      .where(eq(v2OutsourceDemandVersionsTable.outsourceDemandId, id))
      .orderBy(desc(v2OutsourceDemandVersionsTable.versionNo))
      .limit(1);

    const tenderConditions: any[] = [eq(v2TendersTable.outsourceDemandId, id)];
    if (role === "opc") tenderConditions.push(eq(v2TendersTable.opcId, userId));

    const tenders = await db
      .select({
        id: v2TendersTable.id,
        opcId: v2TendersTable.opcId,
        opcNickname: usersTable.nickname,
        status: v2TendersTable.status,
        totalPrice: v2TendersTable.totalPrice,
        priceBreakdown: v2TendersTable.priceBreakdown,
        quotedAt: v2TendersTable.quotedAt,
        createdAt: v2TendersTable.createdAt,
      })
      .from(v2TendersTable)
      .leftJoin(usersTable, eq(v2TendersTable.opcId, usersTable.id))
      .where(and(...tenderConditions));

    return res.json({ ...demand, detail: latestVersion?.detail ?? null, latestVersion: latestVersion ?? null, tenders });
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-demands/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/outsource-demands/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    const { title, demandType, isUrgent, mode, expectedPriceMin, expectedPriceMax, milestones, status } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (demandType !== undefined) updates.demandType = demandType;
    if (isUrgent !== undefined) updates.isUrgent = !!isUrgent;
    if (mode !== undefined) updates.mode = mode;
    if (expectedPriceMin !== undefined) updates.expectedPriceMin = expectedPriceMin;
    if (expectedPriceMax !== undefined) updates.expectedPriceMax = expectedPriceMax;
    if (milestones !== undefined) updates.milestones = milestones;
    if (status !== undefined) updates.status = status;

    const [updated] = await db.update(v2OutsourceDemandsTable).set(updates)
      .where(eq(v2OutsourceDemandsTable.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/outsource-demands/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-demands/:id/update-detail", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    const { detail, attachments, editComment } = req.body as { detail: string; attachments?: any[]; editComment?: string };
    if (!detail?.trim()) return res.status(400).json({ error: "详情内容不能为空" });

    const [lastVer] = await db
      .select({ versionNo: v2OutsourceDemandVersionsTable.versionNo })
      .from(v2OutsourceDemandVersionsTable)
      .where(eq(v2OutsourceDemandVersionsTable.outsourceDemandId, id))
      .orderBy(desc(v2OutsourceDemandVersionsTable.versionNo))
      .limit(1);

    const [newVer] = await db.insert(v2OutsourceDemandVersionsTable).values({
      outsourceDemandId: id,
      versionNo: (lastVer?.versionNo ?? 0) + 1,
      detail: detail.trim(),
      attachments: attachments ?? [],
      editedBy: userId,
      editComment: editComment ?? "更新外包需求详情",
    }).returning();

    await db.update(v2OutsourceDemandsTable).set({ updatedAt: new Date() }).where(eq(v2OutsourceDemandsTable.id, id));

    const activeTenders = await db
      .select({ opcId: v2TendersTable.opcId })
      .from(v2TendersTable)
      .where(and(
        eq(v2TendersTable.outsourceDemandId, id),
        eq(v2TendersTable.status, "negotiating"),
      ));

    for (const t of activeTenders) {
      await notify(t.opcId, "v2_outsource_detail_updated", "外包需求详情已更新",
        `您正在跟进的外包需求「${demand.title}」的详情已更新（版本 v${newVer.versionNo}），请查阅最新内容。`, id, "v2_outsource_demand");
    }

    return res.status(201).json(newVer);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-demands/:id/update-detail failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-demands/:id/add-invited-opc", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { opcId } = req.body as { opcId: number };
    if (!opcId) return res.status(400).json({ error: "缺少 opcId" });

    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });
    if (demand.mode !== "invited") return res.status(400).json({ error: "仅指定邀请模式可追加邀请人" });
    if (demand.status !== "negotiating") return res.status(400).json({ error: "已选定中标或已签合同，无法再追加邀请人" });

    const [existing] = await db
      .select({ id: v2TendersTable.id })
      .from(v2TendersTable)
      .where(and(eq(v2TendersTable.outsourceDemandId, id), eq(v2TendersTable.opcId, opcId)))
      .limit(1);
    if (existing) return res.status(409).json({ error: "该 OPC 已在邀请列表中" });

    const [opc] = await db.select({ id: usersTable.id, nickname: usersTable.nickname, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, opcId)).limit(1);
    if (!opc || opc.role !== "opc") return res.status(404).json({ error: "OPC 用户不存在" });

    const [tender] = await db.insert(v2TendersTable).values({
      outsourceDemandId: id,
      opcId,
      status: "negotiating",
    }).returning();

    await notify(opcId, "v2_demand_invited", "您收到外包需求邀请",
      `平台邀请您参与外包需求「${demand.title}」的报价，请登录查看详情。`, id, "v2_outsource_demand");

    return res.status(201).json(tender);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-demands/:id/add-invited-opc failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/outsource-demands/:id/close", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [demand] = await db.select().from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "外包需求不存在" });

    if (demand.status !== "negotiating") {
      return res.status(400).json({ error: "仅未签约阶段（竞价中）的外包需求可关闭" });
    }

    const activeOrder = await db
      .select({ id: v2OutsourceOrdersTable.id })
      .from(v2OutsourceOrdersTable)
      .where(and(
        eq(v2OutsourceOrdersTable.outsourceDemandId, id),
        inArray(v2OutsourceOrdersTable.status, ["pending_contract", "executing", "warranty"]),
      ))
      .limit(1);
    if (activeOrder.length > 0) {
      return res.status(400).json({ error: "存在进行中的外包订单，无法关闭需求" });
    }

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2OutsourceDemandsTable)
      .set({ status: "closed", closedReason: reason, closedBy: userId, updatedAt: new Date() })
      .where(eq(v2OutsourceDemandsTable.id, id))
      .returning();

    const activeTenders = await db
      .select({ opcId: v2TendersTable.opcId })
      .from(v2TendersTable)
      .where(eq(v2TendersTable.outsourceDemandId, id));
    for (const t of activeTenders) {
      await notify(t.opcId, "v2_tender_cancelled", "外包需求已关闭",
        `外包需求「${demand.title}」已被运营方关闭${reason ? `，原因：${reason}` : ""}。`, id, "v2_outsource_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/outsource-demands/:id/close failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/outsource-demands/:id/versions", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role === "publisher") return res.status(403).json({ error: "无权访问" });

    if (role === "opc") {
      const [demand] = await db.select({ mode: v2OutsourceDemandsTable.mode })
        .from(v2OutsourceDemandsTable).where(eq(v2OutsourceDemandsTable.id, id)).limit(1);
      if (!demand) return res.status(404).json({ error: "外包需求不存在" });
      if (demand.mode === "invited") {
        const [myTender] = await db
          .select({ id: v2TendersTable.id })
          .from(v2TendersTable)
          .where(and(eq(v2TendersTable.outsourceDemandId, id), eq(v2TendersTable.opcId, userId)))
          .limit(1);
        if (!myTender) return res.status(403).json({ error: "无权查看此外包需求的版本历史" });
      }
    }

    const versions = await db
      .select({
        id: v2OutsourceDemandVersionsTable.id,
        versionNo: v2OutsourceDemandVersionsTable.versionNo,
        detail: v2OutsourceDemandVersionsTable.detail,
        attachments: v2OutsourceDemandVersionsTable.attachments,
        editedByNickname: usersTable.nickname,
        editedByRole: usersTable.role,
        editComment: v2OutsourceDemandVersionsTable.editComment,
        createdAt: v2OutsourceDemandVersionsTable.createdAt,
      })
      .from(v2OutsourceDemandVersionsTable)
      .leftJoin(usersTable, eq(v2OutsourceDemandVersionsTable.editedBy, usersTable.id))
      .where(eq(v2OutsourceDemandVersionsTable.outsourceDemandId, id))
      .orderBy(desc(v2OutsourceDemandVersionsTable.versionNo));

    return res.json(versions);
  } catch (err) {
    logger.error({ err }, "GET /v2/outsource-demands/:id/versions failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
