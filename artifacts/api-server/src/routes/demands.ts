import { Router, type IRouter } from "express";
import { db, demandsTable, usersTable, bidsTable, notificationsTable, publisherProfilesTable, ordersTable } from "@workspace/db";
import { eq, and, gte, lte, like, desc, asc, sql, count, ilike, inArray } from "drizzle-orm";
import {
  ListDemandsQueryParams,
  ListDemandsResponse,
  CreateDemandBody,
  GetDemandByIdResponse,
  UpdateDemandBody,
  UpdateDemandStatusBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education: "AI教育课程开发",
  gov_training: "政企AI培训",
  ai_research: "AI研学项目",
  party_building: "党建AI应用",
  livestream_media: "直播与新媒体",
  ai_tool_dev: "AI工具开发定制",
  other: "其他",
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
    const conditions = [];

    if (params.status) conditions.push(eq(demandsTable.status, params.status as any));
    if (params.type) conditions.push(eq(demandsTable.type, params.type as any));
    if (params.opcLevel && params.opcLevel !== "any") conditions.push(eq(demandsTable.opcLevel, params.opcLevel));
    if (params.minBudget) conditions.push(gte(demandsTable.budgetMax, params.minBudget));
    if (params.maxBudget) conditions.push(lte(demandsTable.budgetMin, params.maxBudget));
    if (params.eligibleLevel) {
      conditions.push(
        sql`(${demandsTable.opcLevel} = ${params.eligibleLevel} OR ${demandsTable.opcLevel} = 'any')`
      );
    }
    if (params.search) conditions.push(ilike(demandsTable.title, `%${params.search}%`));
    if (params.publisherId) conditions.push(eq(demandsTable.publisherId, params.publisherId));
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
      case "budget_high": orderByClause = desc(demandsTable.budgetMax); break;
      case "budget_low": orderByClause = asc(demandsTable.budgetMin); break;
      default: orderByClause = desc(demandsTable.createdAt);
    }

    const demands = await db
      .select({
        id: demandsTable.id,
        demandNo: demandsTable.demandNo,
        title: demandsTable.title,
        type: demandsTable.type,
        description: demandsTable.description,
        skillTags: demandsTable.skillTags,
        opcLevel: demandsTable.opcLevel,
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
      typeLabel: DEMAND_TYPE_LABELS[d.type] || d.type,
      bidCount: bidCountMap[d.id] ?? 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      bidDeadline: d.bidDeadline?.toISOString(),
    }));

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to list demands");
    res.status(500).json({ error: "Failed to list demands" });
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

    const [demand] = await db.insert(demandsTable).values({
      demandNo,
      title: body.title,
      type: body.type as any,
      description: body.description,
      skillTags: body.skillTags,
      opcLevel: body.opcLevel,
      budgetMin: body.budgetMin,
      budgetMax: body.budgetMax,
      deadline: body.deadline,
      milestones,
      attachments: rawAttachments,
      mode: body.mode as any,
      isUrgent: body.isUrgent ?? false,
      bidDeadline: body.bidDeadline ? new Date(body.bidDeadline) : null,
      publisherId,
      directedOpcIds: body.directedOpcIds || [],
      status: "draft",
    }).returning();

    res.status(201).json({
      ...demand,
      typeLabel: DEMAND_TYPE_LABELS[demand.type] || demand.type,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to create demand");
    res.status(500).json({ error: "Failed to create demand" });
  }
});

router.get("/demands/:demandId", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const [demand] = await db
      .select({
        id: demandsTable.id,
        demandNo: demandsTable.demandNo,
        title: demandsTable.title,
        type: demandsTable.type,
        description: demandsTable.description,
        skillTags: demandsTable.skillTags,
        opcLevel: demandsTable.opcLevel,
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
        publisherTitle: usersTable.title,
        publisherAvatar: usersTable.avatar,
        createdAt: demandsTable.createdAt,
        updatedAt: demandsTable.updatedAt,
      })
      .from(demandsTable)
      .leftJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
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

    res.json({
      ...demand,
      typeLabel: DEMAND_TYPE_LABELS[demand.type] || demand.type,
      bidCount: 0,
      publisherLogo:    pubProfile?.companyLogo ?? null,
      publisherProfile: pubProfile ?? null,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
      bidDeadline: demand.bidDeadline?.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch demand" });
  }
});

router.put("/demands/:demandId", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const body = UpdateDemandBody.parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.skillTags !== undefined) updateData.skillTags = body.skillTags;
    if (body.opcLevel !== undefined) updateData.opcLevel = body.opcLevel;
    if (body.budgetMin !== undefined) updateData.budgetMin = body.budgetMin;
    if (body.budgetMax !== undefined) updateData.budgetMax = body.budgetMax;
    if (body.deadline !== undefined) updateData.deadline = body.deadline;
    if (body.milestones !== undefined) updateData.milestones = body.milestones;
    if (body.bidDeadline !== undefined) updateData.bidDeadline = new Date(body.bidDeadline);
    if (body.isUrgent !== undefined) updateData.isUrgent = body.isUrgent;

    const [updated] = await db.update(demandsTable).set(updateData).where(eq(demandsTable.id, demandId)).returning();

    res.json({
      ...updated,
      typeLabel: DEMAND_TYPE_LABELS[updated.type] || updated.type,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update demand" });
  }
});

router.patch("/demands/:demandId/status", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const body = UpdateDemandStatusBody.parse(req.body);

    const [updated] = await db.update(demandsTable).set({
      status: body.status as any,
      ...(body.status === "pending_review" ? { rejectionReason: null } : {}),
      updatedAt: new Date(),
    }).where(eq(demandsTable.id, demandId)).returning();

    res.json({
      ...updated,
      typeLabel: DEMAND_TYPE_LABELS[updated.type] || updated.type,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update demand status" });
  }
});

router.post("/demands/:demandId/invite", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send invite" });
  }
});

router.post("/demands/:demandId/invite/respond", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const { opcId, action, notificationId } = req.body as {
      opcId: number;
      action: "accept" | "reject";
      notificationId?: number;
    };

    if (!opcId || !action) {
      return res.status(400).json({ error: "opcId and action required" });
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
          .set({ isRead: true })
          .where(eq(notificationsTable.id, notificationId));
      }
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
    const amount = demand.budgetMax;

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
        status: "in_progress",
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

    await db.insert(notificationsTable).values({
      userId: demand.publisherId,
      type: "order_created",
      title: "OPC 已接受邀约",
      content: `OPC「${opc?.nickname ?? "未知"}」已接受您的定向邀约并承接「${demand.title}」，订单已自动生成。`,
      relatedId: order.id,
      relatedType: "order",
    });

    if (notificationId) {
      await db
        .update(notificationsTable)
        .set({ isRead: true })
        .where(eq(notificationsTable.id, notificationId));
    }

    res.json({ success: true, action: "accepted", orderId: order.id });
  } catch (error) {
    console.error("invite respond error:", error);
    res.status(500).json({ error: "操作失败，请重试" });
  }
});

export default router;
