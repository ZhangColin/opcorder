import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ClientDemandsTable, v2ClientDemandVersionsTable, v2ContractsTable, v2PaymentPlansTable, v2DiscussionPostsTable, notificationsTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, count, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genClientDemandNo, genContractNo } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/client-demands", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;

    const conditions: any[] = [];
    if (status) conditions.push(eq(v2ClientDemandsTable.status, status as any));
    if (search) conditions.push(ilike(v2ClientDemandsTable.title, `%${search}%`));
    if (role === "publisher") conditions.push(eq(v2ClientDemandsTable.publisherId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalRow] = await db.select({ count: count() }).from(v2ClientDemandsTable).where(whereClause);
    const rows = await db
      .select({
        id: v2ClientDemandsTable.id,
        demandNo: v2ClientDemandsTable.demandNo,
        publisherId: v2ClientDemandsTable.publisherId,
        publisherNickname: usersTable.nickname,
        title: v2ClientDemandsTable.title,
        demandType: v2ClientDemandsTable.demandType,
        isUrgent: v2ClientDemandsTable.isUrgent,
        budgetMin: v2ClientDemandsTable.budgetMin,
        budgetMax: v2ClientDemandsTable.budgetMax,
        status: v2ClientDemandsTable.status,
        createdAt: v2ClientDemandsTable.createdAt,
        updatedAt: v2ClientDemandsTable.updatedAt,
      })
      .from(v2ClientDemandsTable)
      .leftJoin(usersTable, eq(v2ClientDemandsTable.publisherId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(v2ClientDemandsTable.createdAt))
      .limit(lim)
      .offset(offset);

    return res.json({ total: Number(totalRow.count), page: pg, limit: lim, items: rows });
  } catch (err) {
    logger.error({ err }, "GET /v2/client-demands failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== "publisher" && role !== "admin") {
      return res.status(403).json({ error: "仅发单方可创建需求" });
    }
    const { title, demandType, isUrgent, budgetMin, budgetMax, hopeDeliveryDate } = req.body as {
      title: string; demandType?: string; isUrgent?: boolean;
      budgetMin?: number; budgetMax?: number; hopeDeliveryDate?: string;
    };
    if (!title?.trim()) return res.status(400).json({ error: "标题不能为空" });

    const demandNo = await genClientDemandNo();
    const [created] = await db.insert(v2ClientDemandsTable).values({
      demandNo,
      publisherId: userId,
      title: title.trim(),
      demandType,
      isUrgent: !!isUrgent,
      budgetMin,
      budgetMax,
      hopeDeliveryDate: hopeDeliveryDate ? new Date(hopeDeliveryDate) : undefined,
      status: "draft",
    }).returning();

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/client-demands/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [demand] = await db
      .select({
        id: v2ClientDemandsTable.id,
        demandNo: v2ClientDemandsTable.demandNo,
        publisherId: v2ClientDemandsTable.publisherId,
        publisherNickname: usersTable.nickname,
        title: v2ClientDemandsTable.title,
        demandType: v2ClientDemandsTable.demandType,
        isUrgent: v2ClientDemandsTable.isUrgent,
        budgetMin: v2ClientDemandsTable.budgetMin,
        budgetMax: v2ClientDemandsTable.budgetMax,
        hopeDeliveryDate: v2ClientDemandsTable.hopeDeliveryDate,
        status: v2ClientDemandsTable.status,
        warrantyEndDate: v2ClientDemandsTable.warrantyEndDate,
        closedReason: v2ClientDemandsTable.closedReason,
        createdAt: v2ClientDemandsTable.createdAt,
        updatedAt: v2ClientDemandsTable.updatedAt,
      })
      .from(v2ClientDemandsTable)
      .leftJoin(usersTable, eq(v2ClientDemandsTable.publisherId, usersTable.id))
      .where(eq(v2ClientDemandsTable.id, id))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) {
      return res.status(403).json({ error: "无权访问" });
    }

    const versions = await db
      .select()
      .from(v2ClientDemandVersionsTable)
      .where(eq(v2ClientDemandVersionsTable.demandId, id))
      .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
      .limit(1);

    return res.json({ ...demand, latestVersion: versions[0] ?? null });
  } catch (err) {
    logger.error({ err }, "GET /v2/client-demands/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/client-demands/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const role = req.user!.role;
    const userId = req.user!.id;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });

    const { title, demandType, isUrgent, budgetMin, budgetMax, hopeDeliveryDate } = req.body as any;
    const updates: Partial<typeof demand> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (demandType !== undefined) updates.demandType = demandType;
    if (isUrgent !== undefined) updates.isUrgent = !!isUrgent;
    if (budgetMin !== undefined) updates.budgetMin = budgetMin;
    if (budgetMax !== undefined) updates.budgetMax = budgetMax;
    if (hopeDeliveryDate !== undefined) updates.hopeDeliveryDate = hopeDeliveryDate ? new Date(hopeDeliveryDate) : null;

    const [updated] = await db.update(v2ClientDemandsTable).set(updates).where(eq(v2ClientDemandsTable.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/client-demands/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/save-draft-detail", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    if (demand.status !== "draft") return res.status(400).json({ error: "仅草稿状态可保存草稿详情" });

    const { detail, attachments } = req.body as { detail?: string; attachments?: any[] };

    const [lastVer] = await db
      .select({ id: v2ClientDemandVersionsTable.id, versionNo: v2ClientDemandVersionsTable.versionNo })
      .from(v2ClientDemandVersionsTable)
      .where(eq(v2ClientDemandVersionsTable.demandId, id))
      .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
      .limit(1);

    if (lastVer) {
      await db.update(v2ClientDemandVersionsTable)
        .set({ detail: detail ?? "", attachments: attachments ?? [], editedBy: userId })
        .where(eq(v2ClientDemandVersionsTable.id, lastVer.id));
    } else {
      await db.insert(v2ClientDemandVersionsTable).values({
        demandId: id,
        versionNo: 1,
        detail: detail ?? "",
        attachments: attachments ?? [],
        editedBy: userId,
        editComment: "草稿保存",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/save-draft-detail failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    if (demand.status !== "draft") return res.status(400).json({ error: "仅草稿状态可提交" });

    const { detail, attachments } = req.body as { detail?: string; attachments?: any[] };

    if (detail) {
      const [lastVer] = await db
        .select({ versionNo: v2ClientDemandVersionsTable.versionNo })
        .from(v2ClientDemandVersionsTable)
        .where(eq(v2ClientDemandVersionsTable.demandId, id))
        .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
        .limit(1);
      await db.insert(v2ClientDemandVersionsTable).values({
        demandId: id,
        versionNo: (lastVer?.versionNo ?? 0) + 1,
        detail,
        attachments: attachments ?? [],
        editedBy: userId,
        editComment: "初次提交",
      });
    }

    const [updated] = await db.update(v2ClientDemandsTable)
      .set({ status: "negotiating", updatedAt: new Date() })
      .where(eq(v2ClientDemandsTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_demand_submitted", "新客户需求待处理",
        `发单方提交了新需求「${demand.title}」，请及时跟进。`, id, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/submit failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/update-detail", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    if (!["negotiating", "quoting"].includes(demand.status)) {
      return res.status(400).json({ error: "当前状态不允许修改需求详情" });
    }

    const { detail, attachments, editComment } = req.body as { detail: string; attachments?: any[]; editComment?: string };
    if (!detail?.trim()) return res.status(400).json({ error: "需求详情不能为空" });

    const [lastVer] = await db
      .select({ versionNo: v2ClientDemandVersionsTable.versionNo })
      .from(v2ClientDemandVersionsTable)
      .where(eq(v2ClientDemandVersionsTable.demandId, id))
      .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
      .limit(1);

    const [newVer] = await db.insert(v2ClientDemandVersionsTable).values({
      demandId: id,
      versionNo: (lastVer?.versionNo ?? 0) + 1,
      detail: detail.trim(),
      attachments: attachments ?? [],
      editedBy: userId,
      editComment: editComment ?? "更新需求详情",
    }).returning();

    await db.update(v2ClientDemandsTable).set({ updatedAt: new Date() }).where(eq(v2ClientDemandsTable.id, id));

    const notifyTarget = role === "publisher" ? "admin" : "publisher";
    if (notifyTarget === "admin") {
      const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
      for (const admin of admins) {
        await notify(admin.id, "v2_demand_detail_updated", "需求详情已更新",
          `需求「${demand.title}」的详情已更新（版本 v${newVer.versionNo}）。`, id, "v2_client_demand");
      }
    } else {
      await notify(demand.publisherId, "v2_demand_detail_updated", "需求详情已更新",
        `运营方更新了需求「${demand.title}」的详情（版本 v${newVer.versionNo}），请查阅最新内容。`, id, "v2_client_demand");
    }

    return res.status(201).json(newVer);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/update-detail failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/initiate-quote", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.status !== "negotiating") return res.status(400).json({ error: "仅沟通中状态可发起报价" });

    const [updated] = await db.update(v2ClientDemandsTable)
      .set({ status: "quoting", updatedAt: new Date() })
      .where(eq(v2ClientDemandsTable.id, id))
      .returning();

    await notify(demand.publisherId, "v2_quote_initiated", "运营方已发起报价",
      `运营方已对您的需求「${demand.title}」发起报价，请查阅报价卡并确认。`, id, "v2_client_demand");

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/initiate-quote failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/confirm-quote", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.publisherId !== userId) return res.status(403).json({ error: "仅发单方可确认报价" });
    if (demand.status !== "quoting") return res.status(400).json({ error: "仅报价中状态可确认" });

    const [updated] = await db.update(v2ClientDemandsTable)
      .set({ status: "pending_contract", updatedAt: new Date() })
      .where(eq(v2ClientDemandsTable.id, id))
      .returning();

    // 自动创建草稿合同，供运营方填写内容后定稿
    const contractNo = await genContractNo("a");
    await db.insert(v2ContractsTable).values({
      contractNo,
      channel: "a",
      clientDemandId: id,
      status: "draft",
    });

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_quote_confirmed", "发单方已确认报价",
        `发单方已确认需求「${demand.title}」的报价，草稿合同已自动创建，请填写合同内容并定稿。`, id, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/confirm-quote failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/comment-quote", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.publisherId !== userId) return res.status(403).json({ error: "仅发单方可提意见" });
    if (demand.status !== "quoting") return res.status(400).json({ error: "仅报价中状态可提意见" });

    const { comment } = req.body as { comment: string };
    if (!comment?.trim()) return res.status(400).json({ error: "意见内容不能为空" });

    // 写入讨论区，让运营后台直接可见
    await db.insert(v2DiscussionPostsTable).values({
      parentType: "client_demand",
      parentId: id,
      content: `【报价意见】${comment.trim()}`,
      attachments: [],
      isSystemMessage: 0,
      authorId: userId,
    });
    await db.update(v2ClientDemandsTable).set({ updatedAt: new Date() }).where(eq(v2ClientDemandsTable.id, id));

    // 同时发站内通知
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_quote_commented", "发单方对报价提出意见",
        `发单方对需求「${demand.title}」的报价提出意见：${comment}`, id, "v2_client_demand");
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/comment-quote failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });
    if (demand.status !== "executing") return res.status(400).json({ error: "仅执行中状态可验收" });

    const { warrantyMonths = 3 } = req.body as { warrantyMonths?: number };
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);

    const [updated] = await db.update(v2ClientDemandsTable)
      .set({ status: "warranty", warrantyEndDate, updatedAt: new Date() })
      .where(eq(v2ClientDemandsTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_demand_verified", "发单方已验收",
        `发单方已验收需求「${demand.title}」，进入${warrantyMonths}个月质保期。`, id, "v2_client_demand");
    }
    await notify(demand.publisherId, "v2_warranty_started", "需求已进入质保期",
      `您的需求「${demand.title}」已验收通过，质保截止至 ${warrantyEndDate.toLocaleDateString("zh-CN")}。`, id, "v2_client_demand");

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/verify failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/client-demands/:id/close", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select().from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权操作" });

    const closableStatuses = ["draft", "negotiating", "quoting", "pending_contract"];
    if (!closableStatuses.includes(demand.status)) {
      return res.status(400).json({ error: "合同已签署后不可关闭需求" });
    }

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2ClientDemandsTable)
      .set({ status: "closed", closedReason: reason, closedBy: userId, updatedAt: new Date() })
      .where(eq(v2ClientDemandsTable.id, id))
      .returning();

    // 级联取消：合同（未签约）和付款计划
    const unsignedStatuses = ["draft", "pending_publisher_confirm", "publisher_rejected", "pending_sign"];
    const contracts = await db.select({ id: v2ContractsTable.id })
      .from(v2ContractsTable)
      .where(and(eq(v2ContractsTable.clientDemandId, id), inArray(v2ContractsTable.status, unsignedStatuses)));
    if (contracts.length > 0) {
      await db.update(v2ContractsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(v2ContractsTable.clientDemandId, id), inArray(v2ContractsTable.status, unsignedStatuses)));
    }
    await db.update(v2PaymentPlansTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(v2PaymentPlansTable.clientDemandId, id));

    if (role === "admin") {
      await notify(demand.publisherId, "v2_demand_submitted", "需求已关闭",
        `运营方关闭了您的需求「${demand.title}」${reason ? `，原因：${reason}` : ""}。`, id, "v2_client_demand");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/client-demands/:id/close failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/client-demands/:id/versions", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
      .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, id)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (role === "publisher" && demand.publisherId !== userId) return res.status(403).json({ error: "无权访问" });

    const versions = await db
      .select({
        id: v2ClientDemandVersionsTable.id,
        versionNo: v2ClientDemandVersionsTable.versionNo,
        detail: v2ClientDemandVersionsTable.detail,
        attachments: v2ClientDemandVersionsTable.attachments,
        editedByNickname: usersTable.nickname,
        editedByRole: usersTable.role,
        editComment: v2ClientDemandVersionsTable.editComment,
        createdAt: v2ClientDemandVersionsTable.createdAt,
      })
      .from(v2ClientDemandVersionsTable)
      .leftJoin(usersTable, eq(v2ClientDemandVersionsTable.editedBy, usersTable.id))
      .where(eq(v2ClientDemandVersionsTable.demandId, id))
      .orderBy(desc(v2ClientDemandVersionsTable.versionNo));

    return res.json(versions);
  } catch (err) {
    logger.error({ err }, "GET /v2/client-demands/:id/versions failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
