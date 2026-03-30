import { Router, type IRouter } from "express";
import { db, demandsTable, usersTable, bidsTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, lte, like, desc, asc, sql, count, ilike, inArray } from "drizzle-orm";
import {
  ListDemandsQueryParams,
  ListDemandsResponse,
  CreateDemandBody,
  GetDemandByIdResponse,
  UpdateDemandBody,
  UpdateDemandStatusBody,
} from "@workspace/api-zod";

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

router.get("/demands", async (req, res) => {
  try {
    // Use safeParse so unknown enum values (e.g. status="open") fall back to undefined instead of 500
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
    if (params.search) conditions.push(ilike(demandsTable.title, `%${params.search}%`));
    if (params.publisherId) conditions.push(eq(demandsTable.publisherId, params.publisherId));

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

    /* ── Get real bid counts for all returned demands ── */
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

router.post("/demands", async (req, res) => {
  try {
    const body = CreateDemandBody.parse(req.body);
    const demandNo = await generateDemandNo();

    /* ── attachments: Zod schema strips unknown fields, read directly from req.body ── */
    const rawAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

    /* ── milestones: store deadline as YYYY-MM-DD string, not ISO timestamp ── */
    const milestones = (body.milestones || []).map(m => ({
      ...m,
      deadline: m.deadline
        ? (m.deadline instanceof Date
            ? m.deadline.toISOString().split("T")[0]
            : String(m.deadline).split("T")[0])
        : "",
    }));

    const authHeader = req.headers.authorization;
    const uid = authHeader?.startsWith("Bearer ") ? parseInt(authHeader.slice(7)) : NaN;
    const publisherId = isNaN(uid) ? 1 : uid;

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

router.get("/demands/:demandId", async (req, res) => {
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
        createdAt: demandsTable.createdAt,
        updatedAt: demandsTable.updatedAt,
      })
      .from(demandsTable)
      .leftJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
      .where(eq(demandsTable.id, demandId));

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    res.json({
      ...demand,
      typeLabel: DEMAND_TYPE_LABELS[demand.type] || demand.type,
      bidCount: 0,
      createdAt: demand.createdAt.toISOString(),
      updatedAt: demand.updatedAt.toISOString(),
      bidDeadline: demand.bidDeadline?.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch demand" });
  }
});

router.put("/demands/:demandId", async (req, res) => {
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

router.patch("/demands/:demandId/status", async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const body = UpdateDemandStatusBody.parse(req.body);

    const [updated] = await db.update(demandsTable).set({
      status: body.status as any,
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

/* ── Invite OPC to a demand ──────────────────────────── */
router.post("/demands/:demandId/invite", async (req, res) => {
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

export default router;
