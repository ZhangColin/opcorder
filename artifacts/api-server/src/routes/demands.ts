import { logger } from "../lib/logger";
import { callLLM } from "../lib/llm";
import { Router, type IRouter } from "express";
import { db, demandsTable, demandPaymentsTable, usersTable, bidsTable, notificationsTable, publisherProfilesTable, ordersTable, quoteDimensionsTable, quoteTiersTable, catCategoriesTable } from "@workspace/db";
import { eq, and, gte, lte, like, desc, asc, sql, count, ilike, inArray } from "drizzle-orm";
import {
  ListDemandsQueryParams,
  ListDemandsResponse,
  CreateDemandBody,
  GetDemandByIdResponse,
  UpdateDemandBody,
  UpdateDemandStatusBody,
  SubmitDemandPaymentBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { createPaymentOrder, queryPaymentStatus, queryRefundStatus, isRefundSuccess, PAYMENT_STATUS, TERMINAL_STATUSES } from "../lib/payment";

const NOTIFY_URL = "https://www.opcorder.com/api/payment/callback";

const router: IRouter = Router();

const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训",
  software: "软件开发",
  marketing: "营销",
  content: "内容设计",
  other: "其他",
};

const CAT_CODE_TO_LEGACY_TYPE: Record<string, string> = {
  CG: "content", SA: "software", TK: "education", BO: "marketing", OTHER: "other",
};

async function generateDemandNo(): Promise<string> {
  const now = new Date();
  const ymd =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `JDB-${ymd}-`;

  const result = await db.execute(
    sql`SELECT demand_no FROM demands WHERE demand_no LIKE ${prefix + "%"} ORDER BY demand_no DESC LIMIT 1`
  );

  let seq = 1;
  const rows = result.rows as { demand_no: string }[];
  if (rows.length > 0) {
    const last = rows[0].demand_no;
    const parts = last.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

router.get("/demands", requireAuth, async (req, res) => {
  try {
    const result = ListDemandsQueryParams.safeParse(req.query);
    const params = result.success
      ? result.data
      : ListDemandsQueryParams.parse({ ...req.query, status: undefined });
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const conditions = [];

    if (params.status) conditions.push(eq(demandsTable.status, params.status as any));
    if (params.catCategoryId) conditions.push(eq(demandsTable.catCategoryId, params.catCategoryId));
    else if (params.type) conditions.push(eq(demandsTable.type, params.type as any));
    if (params.opcLevel && params.opcLevel !== "any") conditions.push(eq(demandsTable.opcLevel, params.opcLevel));
    if (params.minBudget) conditions.push(gte(demandsTable.budgetMin, params.minBudget));
    if (params.maxBudget) conditions.push(lte(demandsTable.budgetMax, params.maxBudget));
    if (params.eligibleLevel) {
      conditions.push(
        sql`(${demandsTable.opcLevel} = ${params.eligibleLevel} OR ${demandsTable.opcLevel} = 'any')`
      );
    }
    if (params.search) conditions.push(ilike(demandsTable.title, `%${params.search}%`));
    if (userRole === "publisher") {
      conditions.push(eq(demandsTable.publisherId, userId));
    } else if (userRole === "admin") {
      if (params.publisherId) conditions.push(eq(demandsTable.publisherId, params.publisherId));
    }
    if (params.deadlineFilter) {
      const now = new Date();
      let cutoff: Date;
      if (params.deadlineFilter === "24h") {
        cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (params.deadlineFilter === "week") {
        cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      conditions.push(gte(demandsTable.bidDeadline, now));
      conditions.push(lte(demandsTable.bidDeadline, cutoff));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(demandsTable).where(whereClause);
    const total = Number(totalResult.count);

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let orderByClause;
    switch (params.sortBy) {
      case "deadline": orderByClause = asc(demandsTable.deadline); break;
      case "budget_high": orderByClause = desc(demandsTable.budget); break;
      case "budget_low": orderByClause = asc(demandsTable.budget); break;
      default: orderByClause = desc(demandsTable.createdAt);
    }

    const demands = await db
      .select({
        id: demandsTable.id,
        demandNo: demandsTable.demandNo,
        title: demandsTable.title,
        type: demandsTable.type,
        catCategoryId: demandsTable.catCategoryId,
        categoryName: catCategoriesTable.name,
        requiredTrackLevel: demandsTable.requiredTrackLevel,
        description: demandsTable.description,
        skillTags: demandsTable.skillTags,
        opcLevel: demandsTable.opcLevel,
        budget: demandsTable.budget,
        budgetMin: demandsTable.budgetMin,
        budgetMax: demandsTable.budgetMax,
        deadline: demandsTable.deadline,
        milestones: demandsTable.milestones,
        attachments: demandsTable.attachments,
        mode: demandsTable.mode,
        status: demandsTable.status,
        isUrgent: demandsTable.isUrgent,
        bidDeadline: demandsTable.bidDeadline,
        publisherId: demandsTable.publisherId,
        publisherName: usersTable.nickname,
        createdAt: demandsTable.createdAt,
        updatedAt: demandsTable.updatedAt,
      })
      .from(demandsTable)
      .leftJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
      .leftJoin(catCategoriesTable, eq(demandsTable.catCategoryId, catCategoriesTable.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const demandIds = demands.map(d => d.id);
    let bidCountMap: Record<number, number> = {};
    if (demandIds.length > 0) {
      const bidCounts = await db
        .select({ demandId: bidsTable.demandId, cnt: count() })
        .from(bidsTable)
        .where(inArray(bidsTable.demandId, demandIds))
        .groupBy(bidsTable.demandId);
      bidCounts.forEach(r => { bidCountMap[r.demandId] = Number(r.cnt); });
    }

    const items = demands.map(d => ({
      ...d,
      typeLabel: d.categoryName ?? DEMAND_TYPE_LABELS[d.type] ?? d.type,
      bidCount: bidCountMap[d.id] ?? 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      bidDeadline: d.bidDeadline?.toISOString(),
    }));

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to list demands");
    return res.status(500).json({ error: "Failed to list demands" });
  }
});

router.post("/demands", requireAuth, async (req, res) => {
  try {
    const body = CreateDemandBody.parse(req.body);
    const demandNo = await generateDemandNo();

    const rawAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

    const milestones = (body.milestones || []).map(m => ({
      ...m,
      deadline: m.deadline
        ? (m.deadline instanceof Date
            ? m.deadline.toISOString().split("T")[0]
            : String(m.deadline).split("T")[0])
        : "",
    }));

    const publisherId = req.user!.id;

    // Support both legacy budget and new budgetMin/budgetMax
    const budgetMin = body.budgetMin ?? body.budget ?? 0;
    const budgetMax = body.budgetMax ?? body.budget ?? 0;
    const budgetLegacy = body.budget ?? budgetMin;

    // Resolve catCategoryId and backwards-compat type field
    // catCategoryId is the source of truth; legacy type is derived from it with "other" as safe fallback
    let resolvedCatCategoryId: number | null = (req.body.catCategoryId ? Number(req.body.catCategoryId) : null);
    let resolvedType = (body.type as string) || "other";

    if (resolvedCatCategoryId) {
      // catCategoryId is primary — derive legacy type; fall back to "other" for new/unknown codes
      const [cat] = await db.select({ code: catCategoriesTable.code })
        .from(catCategoriesTable).where(eq(catCategoriesTable.id, resolvedCatCategoryId)).limit(1);
      if (cat) {
        resolvedType = CAT_CODE_TO_LEGACY_TYPE[cat.code] ?? "other";
      }
    } else if (resolvedType && resolvedType !== "other") {
      // Legacy type provided (no catCategoryId) — look up matching category for back-compat
      const codeForType = Object.entries(CAT_CODE_TO_LEGACY_TYPE).find(([, v]) => v === resolvedType)?.[0];
      if (codeForType) {
        const [cat] = await db.select({ id: catCategoriesTable.id })
          .from(catCategoriesTable).where(eq(catCategoriesTable.code, codeForType)).limit(1);
        if (cat) resolvedCatCategoryId = cat.id;
      }
    }
    // Ensure resolvedType is always a valid legacy enum value
    const VALID_LEGACY_TYPES = ["education", "software", "marketing", "content", "other"];
    if (!VALID_LEGACY_TYPES.includes(resolvedType)) resolvedType = "other";

    const [demand] = await db.insert(demandsTable).values({
      demandNo,
      title: body.title,
      type: (resolvedType || "other") as any,
      description: body.description,
      skillTags: body.skillTags,
      opcLevel: body.opcLevel,
      budget: budgetLegacy,
      budgetMin,
      budgetMax,
      deadline: body.deadline instanceof Date ? body.deadline.toISOString().split("T")[0] : String(body.deadline),
      milestones,
      attachments: rawAttachments,
      mode: body.mode as any,
      isUrgent: body.isUrgent ?? false,
      bidDeadline: body.bidDeadline ? new Date(body.bidDeadline) : null,
      publisherId,
      directedOpcIds: body.directedOpcIds || [],
      status: "draft",
      catCategoryId: resolvedCatCategoryId,
      requiredTrackLevel: (req.body.requiredTrackLevel as string) || "any",
    }).returning();

    return res.status(201).json({
      ...demand,
      typeLabel: DEMAND_TYPE_LABELS[demand.type] || demand.type,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to create demand");
    return res.status(500).json({ error: "Failed to create demand" });
  }
});

router.get("/demands/:demandId", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);

    const [demand] = await db
      .select({
        id: demandsTable.id,
        demandNo: demandsTable.demandNo,
        title: demandsTable.title,
        type: demandsTable.type,
        catCategoryId: demandsTable.catCategoryId,
        categoryName: catCategoriesTable.name,
        requiredTrackLevel: demandsTable.requiredTrackLevel,
        description: demandsTable.description,
        skillTags: demandsTable.skillTags,
        opcLevel: demandsTable.opcLevel,
        budget: demandsTable.budget,
        budgetMin: demandsTable.budgetMin,
        budgetMax: demandsTable.budgetMax,
        deadline: demandsTable.deadline,
        milestones: demandsTable.milestones,
        attachments: demandsTable.attachments,
        mode: demandsTable.mode,
        status: demandsTable.status,
        isUrgent: demandsTable.isUrgent,
        bidDeadline: demandsTable.bidDeadline,
        summary: demandsTable.summary,
        publisherId: demandsTable.publisherId,
        publisherName: usersTable.nickname,
        publisherTitle: usersTable.title,
        publisherAvatar: usersTable.avatar,
        createdAt: demandsTable.createdAt,
        updatedAt: demandsTable.updatedAt,
      })
      .from(demandsTable)
      .leftJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
      .leftJoin(catCategoriesTable, eq(demandsTable.catCategoryId, catCategoriesTable.id))
      .where(eq(demandsTable.id, demandId));

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    const [pubProfile] = await db.select({
      companyLogo:  publisherProfilesTable.companyLogo,
      companyDesc:  publisherProfilesTable.companyDesc,
      industry:     publisherProfilesTable.industry,
      location:     publisherProfilesTable.location,
      teamSize:     publisherProfilesTable.teamSize,
      foundedYear:  publisherProfilesTable.foundedYear,
      website:      publisherProfilesTable.website,
      contactEmail: publisherProfilesTable.contactEmail,
    }).from(publisherProfilesTable).where(eq(publisherProfilesTable.userId, demand.publisherId));

    const isAdmin = req.user!.role === "admin";
    const isPublisher = req.user!.id === demand.publisherId;
    const safeProfile = pubProfile ? {
      ...pubProfile,
      contactEmail: (isAdmin || isPublisher) ? pubProfile.contactEmail : null,
    } : null;

    return res.json({
      ...demand,
      typeLabel: demand.categoryName ?? DEMAND_TYPE_LABELS[demand.type] ?? demand.type,
      bidCount: 0,
      publisherLogo:    pubProfile?.companyLogo ?? null,
      publisherProfile: safeProfile,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
      bidDeadline: demand.bidDeadline?.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch demand" });
  }
});

router.put("/demands/:demandId", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const body = UpdateDemandBody.parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.skillTags !== undefined) updateData.skillTags = body.skillTags;
    if (body.opcLevel !== undefined) updateData.opcLevel = body.opcLevel;
    if (body.budget !== undefined) updateData.budget = body.budget;
    if (body.budgetMin !== undefined) updateData.budgetMin = body.budgetMin;
    if (body.budgetMax !== undefined) {
      updateData.budgetMax = body.budgetMax;
      // Keep legacy `budget` in sync with the high end of the range so any
      // legacy code paths (settlement, settlement preview, etc.) stay correct.
      if (body.budget === undefined) updateData.budget = body.budgetMax;
    }
    if (body.deadline !== undefined) updateData.deadline = body.deadline;
    if (body.milestones !== undefined) updateData.milestones = body.milestones;
    if (body.bidDeadline !== undefined) updateData.bidDeadline = new Date(body.bidDeadline);
    if (body.isUrgent !== undefined) updateData.isUrgent = body.isUrgent;

    // Handle requiredTrackLevel update
    const incomingTrackLevel = req.body.requiredTrackLevel as string | undefined;
    if (incomingTrackLevel !== undefined) {
      updateData.requiredTrackLevel = incomingTrackLevel || "any";
    }

    // Handle catCategoryId update with legacy type back-compat
    const incomingCatId = req.body.catCategoryId as number | undefined;
    if (incomingCatId !== undefined && incomingCatId !== null) {
      updateData.catCategoryId = incomingCatId;
      const [cat] = await db.select({ code: catCategoriesTable.code })
        .from(catCategoriesTable).where(eq(catCategoriesTable.id, incomingCatId)).limit(1);
      if (cat) {
        const legacy = CAT_CODE_TO_LEGACY_TYPE[cat.code];
        if (legacy) updateData.type = legacy;
      }
    }

    const [updated] = await db.update(demandsTable).set(updateData).where(eq(demandsTable.id, demandId)).returning();

    return res.json({
      ...updated,
      typeLabel: DEMAND_TYPE_LABELS[updated.type] || updated.type,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update demand" });
  }
});

// Publisher-allowed status transitions (admin transitions handled separately in admin routes)
const PUBLISHER_TRANSITIONS: Record<string, string[]> = {
  draft:          ["pending_review", "closed"],
  pending_review: ["draft"],  // withdraw from review
};

router.patch("/demands/:demandId/status", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const body = UpdateDemandStatusBody.parse(req.body);

    // Look up the demand for ownership and transition validation
    const [existing] = await db
      .select({ publisherId: demandsTable.publisherId, status: demandsTable.status, title: demandsTable.title, description: demandsTable.description, milestones: demandsTable.milestones })
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "需求不存在" });

    const isAdmin = req.user!.role === "admin";

    // Non-admins: ownership check + allowed transitions only
    if (!isAdmin) {
      if (existing.publisherId !== req.user!.id) {
        return res.status(403).json({ error: "无权操作" });
      }
      const allowed = PUBLISHER_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.status)) {
        return res.status(400).json({
          error: `状态 "${existing.status}" 不允许直接变更为 "${body.status}"`,
        });
      }
    }

    // Submitting for review requires at least one milestone
    if (body.status === "pending_review") {
      const ms = Array.isArray(existing.milestones) ? existing.milestones : [];
      if (ms.length === 0) {
        return res.status(400).json({ error: "提交审核前请至少添加一个里程碑节点" });
      }
    }

    // Generate AI summary when submitting for review
    let summary: string | undefined;
    if (body.status === "pending_review" && existing.description) {
      try {
        const result = await callLLM([
          { role: "system", content: "你是一个专业的需求摘要助手。请用1-2句话（不超过80字）简洁概括需求的核心内容，语言专业，适合在列表页展示。直接输出摘要文字，不要加任何前缀、标点符号或解释。" },
          { role: "user", content: `需求标题：${existing.title}\n\n需求详情：${existing.description.slice(0, 2000)}` },
        ], []);
        if (result.content) summary = result.content.trim().slice(0, 150);
      } catch (e) {
        logger.warn({ e }, "Failed to generate demand summary, skipping");
      }
    }

    const [updated] = await db.update(demandsTable).set({
      status: body.status as any,
      ...(body.status === "pending_review" ? { rejectionReason: null } : {}),
      ...(summary ? { summary } : {}),
      updatedAt: new Date(),
    }).where(eq(demandsTable.id, demandId)).returning();

    return res.json({
      ...updated,
      typeLabel: DEMAND_TYPE_LABELS[updated.type] || updated.type,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update demand status" });
  }
});

/* PATCH /demands/:demandId/adjust — Publisher adjusts opcLevel and/or bidDeadline and/or budget for active demands */
router.patch("/demands/:demandId/adjust", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const { opcLevel, bidDeadline, budget } = req.body as { opcLevel?: string; bidDeadline?: string; budget?: number };

    const [existing] = await db
      .select({
        publisherId: demandsTable.publisherId,
        status: demandsTable.status,
        bidDeadline: demandsTable.bidDeadline,
        budget: demandsTable.budget,
      })
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "需求不存在" });
    if (existing.publisherId !== req.user!.id) return res.status(403).json({ error: "无权操作" });

    const adjustableStatuses = ["published", "matched"];
    if (!adjustableStatuses.includes(existing.status)) {
      return res.status(400).json({ error: "只有「招募中」或「已匹配」状态的需求才能调整参数" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (opcLevel !== undefined) {
      const validLevels = ["any", "C", "B", "A"];
      if (!validLevels.includes(opcLevel)) {
        return res.status(400).json({ error: "无效的 OPC 等级要求" });
      }
      updateData.opcLevel = opcLevel as any;
    }

    if (bidDeadline !== undefined) {
      const newDate = new Date(bidDeadline);
      if (isNaN(newDate.getTime())) return res.status(400).json({ error: "无效的日期格式" });

      // Can only extend (not shorten) the bid deadline
      if (existing.bidDeadline && newDate <= existing.bidDeadline) {
        return res.status(400).json({ error: "抢单截止时间只能往后调整，不能提前" });
      }
      updateData.bidDeadline = newDate;
    }

    if (budget !== undefined) {
      // Budget can only be adjusted before an OPC has accepted (status must be "published")
      if (existing.status !== "published") {
        return res.status(400).json({ error: "OPC 已接单，预算不可修改" });
      }
      if (typeof budget !== "number" || !Number.isInteger(budget) || budget <= 0) {
        return res.status(400).json({ error: "预算金额无效" });
      }
      const currentBudget = Number(existing.budget ?? 0);
      if (budget <= currentBudget) {
        return res.status(400).json({ error: "预算只能往上调，不可降低" });
      }
      updateData.budget = budget;
    }

    const [updated] = await db.update(demandsTable).set(updateData).where(eq(demandsTable.id, demandId)).returning();

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "调整需求参数失败" });
  }
});

/**
 * @deprecated Demand-level deposit payment has been superseded by order-level payment.
 * Deposits are now collected via POST /orders/:orderId/payment after a bid is accepted.
 * This endpoint is retained for backward compatibility with existing demands in
 * pending_payment status but MUST NOT be used for new demand flows.
 */
router.post("/demands/:demandId/payment", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);

    const parsed = SubmitDemandPaymentBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "请求参数无效", details: parsed.error.flatten().fieldErrors });
    }
    const { method, receiptUrl, paymentNote } = parsed.data;

    const [demand] = await db
      .select({ status: demandsTable.status, publisherId: demandsTable.publisherId, budget: demandsTable.budget })
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.status !== "pending_payment") {
      return res.status(400).json({ error: "该需求当前状态无需缴纳保证金" });
    }
    if (demand.publisherId !== req.user!.id) {
      return res.status(403).json({ error: "无权操作" });
    }

    // For online payments: cancel any existing pending payment first (offline or stale online)
    // For offline payments: block if there's already a pending one
    const [existing] = await db
      .select({ id: demandPaymentsTable.id, method: demandPaymentsTable.method })
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "pending")))
      .orderBy(desc(demandPaymentsTable.createdAt))
      .limit(1);
    if (existing) {
      // Allow switching between payment methods: cancel the existing pending payment
      await db.delete(demandPaymentsTable).where(eq(demandPaymentsTable.id, existing.id));
    }

    // Amount is derived server-side from demand budget (in yuan, API expects fen)
    const amount = demand.budget ?? 0;

    if (method === "online") {
      // Create a real payment order via the payment API
      const businessOrderNo = `DEPOSIT-${demandId}-${Date.now()}`;
      const amountFen = Math.round(amount * 100);

      const [demandRow] = await db
        .select({ title: demandsTable.title })
        .from(demandsTable)
        .where(eq(demandsTable.id, demandId))
        .limit(1);

      const order = await createPaymentOrder({
        businessOrderNo,
        amount: amountFen,
        subject: `需求保证金-${demandRow?.title ?? demandId}`,
        body: `需求保证金`,
        businessName: "需求保证金",
        notifyUrl: NOTIFY_URL,
      });

      const [payment] = await db.insert(demandPaymentsTable).values({
        demandId,
        amount,
        method: "online",
        status: "pending",
        paymentOrderNo: order.paymentOrderNo,
        paymentNote: paymentNote?.trim() || null,
      }).returning();

      return res.status(201).json({
        ...payment,
        qrCodeUrl: order.qrCodeUrl,
        paymentOrderNo: order.paymentOrderNo,
        confirmedAt: payment.confirmedAt?.toISOString() ?? null,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      });
    }

    // Offline: manual receipt upload flow
    const [payment] = await db.insert(demandPaymentsTable).values({
      demandId,
      amount,
      method: "offline",
      status: "pending",
      receiptUrl: receiptUrl?.trim() || null,
      paymentNote: paymentNote?.trim() || null,
    }).returning();

    return res.status(201).json({
      ...payment,
      confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Route handler error");
    return res.status(500).json({ error: "缴费提交失败" });
  }
});

/* Poll online payment status for a demand deposit */
router.post("/demands/:demandId/payment-status", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);

    const [demand] = await db
      .select({ publisherId: demandsTable.publisherId, title: demandsTable.title })
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.publisherId !== req.user!.id) return res.status(403).json({ error: "无权操作" });

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.method, "online")))
      .orderBy(desc(demandPaymentsTable.createdAt))
      .limit(1);

    if (!payment) return res.status(404).json({ error: "尚未创建在线支付订单" });
    if (!payment.paymentOrderNo) return res.status(400).json({ error: "支付订单号缺失" });

    // Already confirmed — no need to poll
    if (payment.status === "confirmed") {
      return res.json({ status: PAYMENT_STATUS.PAID, paid: true, terminal: true, confirmed: true });
    }

    const order = await queryPaymentStatus(payment.paymentOrderNo);

    console.log(`[demand-payment-status] demandId=${demandId} paymentId=${payment.id} status=${order.status}(${order.statusName}) paidAt=${order.paidAt}`);

    if (order.status === PAYMENT_STATUS.PAID) {
      // Auto-confirm: publish demand when payment is confirmed
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.update(demandPaymentsTable).set({
          status: "confirmed",
          confirmedAt: now,
        }).where(eq(demandPaymentsTable.id, payment.id));

        await tx.update(demandsTable).set({
          status: "published",
          updatedAt: now,
        }).where(eq(demandsTable.id, demandId));

        await tx.insert(notificationsTable).values({
          userId: demand.publisherId,
          type: "system",
          title: "保证金已到账，需求已发布",
          content: `您的需求「${demand.title}」的保证金已到账确认，需求现已在需求大厅公开发布，OPC可以查看并投标。`,
          relatedId: demandId,
          relatedType: "demand",
        });
      });
    }

    return res.json({
      status: order.status,
      statusName: order.statusName,
      paid: order.status === PAYMENT_STATUS.PAID,
      terminal: TERMINAL_STATUSES.includes(order.status as 2 | 3 | 4 | 5),
      confirmed: order.status === PAYMENT_STATUS.PAID,
      paidAt: order.paidAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "查询失败";
    return res.status(500).json({ error: msg });
  }
});

router.get("/demands/:demandId/payment", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);

    // Ownership check: only the demand publisher or an admin may view payment records
    const [demand] = await db
      .select({ publisherId: demandsTable.publisherId })
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (req.user!.role !== "admin" && demand.publisherId !== req.user!.id) {
      return res.status(403).json({ error: "无权查看" });
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.demandId, demandId))
      .orderBy(desc(demandPaymentsTable.createdAt))
      .limit(1);

    if (!payment) {
      return res.json(null);
    }

    return res.json({
      ...payment,
      confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "获取缴费记录失败" });
  }
});

router.post("/demands/:demandId/invite", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const { opcId, publisherId } = req.body as { opcId: number; publisherId: number };
    if (!opcId || !publisherId) return res.status(400).json({ error: "opcId and publisherId required" });

    const [demand] = await db.select({ title: demandsTable.title })
      .from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "需求不存在" });

    const [publisher] = await db.select({ nickname: usersTable.nickname })
      .from(usersTable).where(eq(usersTable.id, publisherId)).limit(1);

    await db.insert(notificationsTable).values({
      userId: opcId,
      type: "directed_invite",
      title: "收到定向邀约",
      content: `「${publisher?.nickname ?? "发单方"}」邀请您接单：${demand.title}，请查看需求详情并决定是否参与。`,
      relatedId: demandId,
      relatedType: "demand",
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to send invite" });
  }
});

router.post("/demands/:demandId/invite/respond", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const { opcId, action, notificationId } = req.body as {
      opcId: number;
      action: "accept" | "reject";
      notificationId?: number;
    };

    if (!opcId || !action) {
      return res.status(400).json({ error: "opcId and action required" });
    }

    if (req.user!.id !== opcId) {
      return res.status(403).json({ error: "无权操作" });
    }

    if (notificationId) {
      const [notif] = await db
        .select({ userId: notificationsTable.userId, respondedAction: notificationsTable.respondedAction })
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notificationId))
        .limit(1);
      if (!notif || notif.userId !== req.user!.id) {
        return res.status(403).json({ error: "无权操作此通知" });
      }
      if (notif.respondedAction) {
        return res.status(409).json({ error: "该邀约已处理过，请勿重复操作" });
      }
    }

    const [demand] = await db
      .select()
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });

    if (action === "reject") {
      if (notificationId) {
        await db
          .update(notificationsTable)
          .set({ isRead: true, respondedAction: "rejected" })
          .where(eq(notificationsTable.id, notificationId));
      }

      const [opc] = await db
        .select({ nickname: usersTable.nickname })
        .from(usersTable)
        .where(eq(usersTable.id, opcId))
        .limit(1);

      await db.insert(notificationsTable).values({
        userId: demand.publisherId,
        type: "system",
        title: "OPC 婉拒了您的邀约",
        content: `OPC「${opc?.nickname ?? "未知"}」婉拒了您对「${demand.title}」的定向邀约。您可将需求改为公开抢单，或重新邀约其他 OPC。`,
        relatedId: demand.id,
        relatedType: "demand",
      });

      return res.json({ success: true, action: "rejected" });
    }

    const [existingBid] = await db
      .select({ id: bidsTable.id, status: bidsTable.status })
      .from(bidsTable)
      .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.opcId, opcId)))
      .limit(1);

    let bidId: number;
    if (existingBid) {
      bidId = existingBid.id;
    } else {
      const [newBid] = await db
        .insert(bidsTable)
        .values({
          demandId,
          opcId,
          proposal: "接受定向邀约",
          estimatedDays: 30,
          portfolioLinks: [],
          status: "pending",
        })
        .returning({ id: bidsTable.id });
      bidId = newBid.id;
    }

    await db
      .update(bidsTable)
      .set({ status: "accepted" })
      .where(eq(bidsTable.id, bidId));

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const seq = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
    const orderNo = `ORD-${ym}-${seq}`;
    const amount = demand.budget;

    const [order] = await db
      .insert(ordersTable)
      .values({
        orderNo,
        demandId: demand.id,
        opcId,
        publisherId: demand.publisherId,
        amount,
        opcShare: amount * 0.9,
        publisherShare: 0,
        platformFee: amount * 0.1,
        status: "pending_payment",
        milestones: demand.milestones || [],
        deadline: demand.deadline,
      })
      .returning({ id: ordersTable.id });

    await db
      .update(demandsTable)
      .set({ status: "matched", updatedAt: new Date() })
      .where(eq(demandsTable.id, demandId));

    await db
      .update(bidsTable)
      .set({ status: "rejected" })
      .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.status, "pending")));

    const [opc] = await db
      .select({ nickname: usersTable.nickname })
      .from(usersTable)
      .where(eq(usersTable.id, opcId))
      .limit(1);

    // Notify publisher: OPC accepted, but payment is still required to start
    await db.insert(notificationsTable).values({
      userId: demand.publisherId,
      type: "order_created",
      title: "OPC 已接受邀约，请完成付款",
      content: `OPC「${opc?.nickname ?? "未知"}」已接受您对「${demand.title}」的定向邀约，订单已生成（编号：${orderNo}）。请前往「我的订单」完成保证金付款，付款确认后订单正式开始。`,
      relatedId: order.id,
      relatedType: "order",
    });

    if (notificationId) {
      await db
        .update(notificationsTable)
        .set({ isRead: true, respondedAction: "accepted" })
        .where(eq(notificationsTable.id, notificationId));
    }

    return res.json({ success: true, action: "accepted", orderId: order.id });
  } catch (error) {
    logger.error({ err: error }, "invite respond error:");
    return res.status(500).json({ error: "操作失败，请重试" });
  }
});

/* ─── PUBLISHER REQUEST REFUND ──────────────────────────── */

router.post("/demands/:demandId/request-refund", requireAuth, async (req, res) => {
  try {
    const demandId = Number(req.params.demandId as string);
    const userId = (req as any).user?.id;
    const { reason } = req.body as { reason?: string };

    const [demand] = await db
      .select()
      .from(demandsTable)
      .where(and(eq(demandsTable.id, demandId), eq(demandsTable.publisherId, userId)))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在或无权操作" });
    if (demand.status !== "published") {
      return res.status(409).json({ error: "只有已发布且未确定 OPC 的需求才能申请退款" });
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "confirmed")))
      .limit(1);

    if (!payment) return res.status(400).json({ error: "未找到已确认的保证金记录，无法申请退款" });

    const acceptedBid = await db
      .select({ id: bidsTable.id })
      .from(bidsTable)
      .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.status, "accepted")))
      .limit(1);

    if (acceptedBid.length > 0) {
      return res.status(409).json({ error: "已有 OPC 被确定承接，无法申请退款" });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(demandPaymentsTable).set({
        status: "refund_pending",
        refundReason: reason?.trim() || null,
        refundRequestedAt: now,
      }).where(eq(demandPaymentsTable.id, payment.id));

      await tx.update(demandsTable).set({
        status: "refund_pending",
        updatedAt: now,
      }).where(eq(demandsTable.id, demandId));

      const pendingBids = await tx
        .select({ id: bidsTable.id, opcId: bidsTable.opcId })
        .from(bidsTable)
        .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.status, "pending")));

      if (pendingBids.length > 0) {
        await tx.update(bidsTable).set({ status: "rejected" })
          .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.status, "pending")));

        await tx.insert(notificationsTable).values(
          pendingBids.map(b => ({
            userId: b.opcId,
            type: "system" as const,
            title: "投标已退回",
            content: `您对需求「${demand.title}」的投标已因发单方申请退款而自动退回，感谢您的理解。`,
            relatedId: demandId,
            relatedType: "demand",
          }))
        );
      }
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err: err }, "[request-refund] error:");
    return res.status(500).json({ error: "申请退款失败，请重试" });
  }
});

/* Sync online refund status for a specific demand (triggered by frontend on page load) */
router.post("/demands/:demandId/sync-refund-status", requireAuth, async (req, res) => {
  try {
    const demandId = Number(req.params.demandId as string);
    const userId = (req as any).user?.id;

    const [demand] = await db
      .select({ id: demandsTable.id, status: demandsTable.status, publisherId: demandsTable.publisherId, title: demandsTable.title })
      .from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.publisherId !== userId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ error: "无权限" });
    }
    if (demand.status !== "refunding") {
      return res.json({ status: demand.status, synced: false });
    }

    const [payment] = await db
      .select({ id: demandPaymentsTable.id, refundOrderNo: demandPaymentsTable.refundOrderNo, method: demandPaymentsTable.method })
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "refunding")))
      .limit(1);

    if (!payment || !payment.refundOrderNo || payment.method !== "online") {
      return res.json({ status: demand.status, synced: false });
    }

    const result = await queryRefundStatus(payment.refundOrderNo);

    if (isRefundSuccess(result)) {
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.update(demandPaymentsTable).set({ status: "refunded", refundedAt: now })
          .where(eq(demandPaymentsTable.id, payment.id));
        await tx.update(demandsTable).set({ status: "refunded", updatedAt: now })
          .where(eq(demandsTable.id, demandId));
        await tx.insert(notificationsTable).values({
          userId: demand.publisherId, type: "system",
          title: "保证金已退款成功",
          content: `您的需求「${demand.title}」的保证金已成功退还，请确认到账情况。`,
          relatedId: demandId, relatedType: "demand",
        });
      });
      return res.json({ status: "refunded", synced: true });
    }

    return res.json({ status: demand.status, refundStatus: result.status, refundStatusName: result.statusName, synced: false });
  } catch (err) {
    logger.error({ err: err }, "[sync-refund-status] error:");
    return res.status(500).json({ error: "查询退款状态失败" });
  }
});

/* ─── Public: GET /quote-card/config?category=X — OPC reads pricing config ── */
router.get("/quote-card/config", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    if (!category) return res.status(400).json({ error: "category 参数必填" });

    const dims = await db.select().from(quoteDimensionsTable)
      .where(and(eq(quoteDimensionsTable.category, category), eq(quoteDimensionsTable.isActive, true)))
      .orderBy(asc(quoteDimensionsTable.layer), asc(quoteDimensionsTable.sortOrder));

    if (dims.length === 0) return res.json({ category, base: [], adjustment: [], optional: [] });

    const dimIds = dims.map(d => d.id);
    const tiers = await db.select().from(quoteTiersTable)
      .where(inArray(quoteTiersTable.dimensionId, dimIds))
      .orderBy(asc(quoteTiersTable.sortOrder));

    const tiersByDim = new Map<number, typeof tiers>();
    for (const t of tiers) {
      if (!tiersByDim.has(t.dimensionId)) tiersByDim.set(t.dimensionId, []);
      tiersByDim.get(t.dimensionId)!.push(t);
    }

    const mapDim = (d: typeof dims[0]) => ({
      id: d.id, code: d.code, label: d.label, description: d.description, sortOrder: d.sortOrder,
      tiers: (tiersByDim.get(d.id) ?? []).map(t => ({
        id: t.id, tier: t.tier, tierLabel: t.tierLabel,
        basePrice: t.basePrice, coefficient: t.coefficient,
        description: t.description, sortOrder: t.sortOrder,
      })),
    });

    return res.json({
      category,
      base: dims.filter(d => d.layer === "base").map(mapDim),
      adjustment: dims.filter(d => d.layer === "adjustment").map(mapDim),
      optional: dims.filter(d => d.layer === "optional").map(mapDim),
    });
  } catch (err) {
    logger.error({ err }, "GET /quote-card/config error");
    return res.status(500).json({ error: "获取报价卡配置失败" });
  }
});

export default router;
