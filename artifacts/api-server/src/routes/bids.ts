import { Router, type IRouter } from "express";
import { db, bidsTable, usersTable, opcProfilesTable, demandsTable, ordersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateBidBody,
  UpdateBidStatusBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

const LEVEL_RANK: Record<string, number> = { C: 1, B: 2, A: 3 };
const LEVEL_BUDGET_CAP: Record<string, number> = { C: 3_000, B: 20_000, A: 200_000 };
const LEVEL_LABEL: Record<string, string> = { C: "C级（新手）", B: "B级（进阶）", A: "A级（专家）" };

/* GET /bids/my — returns all bids for the current OPC user with demand info */
router.get("/bids/my", requireAuth, async (req, res) => {
  try {
    const opcId = req.user!.id;
    const bids = await db
      .select({
        id: bidsTable.id,
        demandId: bidsTable.demandId,
        demandTitle: demandsTable.title,
        demandStatus: demandsTable.status,
        demandBudget: demandsTable.budget,
        demandDeadline: demandsTable.deadline,
        proposal: bidsTable.proposal,
        estimatedDays: bidsTable.estimatedDays,
        portfolioLinks: bidsTable.portfolioLinks,
        status: bidsTable.status,
        createdAt: bidsTable.createdAt,
      })
      .from(bidsTable)
      .leftJoin(demandsTable, eq(bidsTable.demandId, demandsTable.id))
      .where(eq(bidsTable.opcId, opcId))
      .orderBy(desc(bidsTable.createdAt));

    res.json(bids.map(b => ({
      ...b,
      demandDeadline: b.demandDeadline?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch my bids" });
  }
});

/* PATCH /bids/:bidId/withdraw — OPC withdraws their own pending bid */
router.patch("/bids/:bidId/withdraw", requireAuth, async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId);
    const opcId = req.user!.id;

    const [bid] = await db
      .select({ id: bidsTable.id, opcId: bidsTable.opcId, status: bidsTable.status })
      .from(bidsTable)
      .where(eq(bidsTable.id, bidId))
      .limit(1);

    if (!bid) return res.status(404).json({ error: "申请记录不存在" });
    if (bid.opcId !== opcId) return res.status(403).json({ error: "无权撤消他人的申请" });
    if (bid.status !== "pending") {
      return res.status(400).json({ error: `当前申请状态「${bid.status}」无法撤消，仅「申请中」状态可撤消` });
    }

    const [updated] = await db
      .update(bidsTable)
      .set({ status: "withdrawn" as any })
      .where(eq(bidsTable.id, bidId))
      .returning();

    res.json({ id: updated.id, status: updated.status });
  } catch (error) {
    res.status(500).json({ error: "撤消申请失败" });
  }
});

router.get("/demands/:demandId/bids", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const bids = await db
      .select({
        id: bidsTable.id,
        demandId: bidsTable.demandId,
        opcId: bidsTable.opcId,
        opcNickname: usersTable.nickname,
        opcAvatar: usersTable.avatar,
        opcLevel: opcProfilesTable.level,
        opcCreditScore: opcProfilesTable.creditScore,
        opcAvgRating: opcProfilesTable.avgRating,
        proposal: bidsTable.proposal,
        estimatedDays: bidsTable.estimatedDays,
        portfolioLinks: bidsTable.portfolioLinks,
        status: bidsTable.status,
        createdAt: bidsTable.createdAt,
      })
      .from(bidsTable)
      .leftJoin(usersTable, eq(bidsTable.opcId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(bidsTable.opcId, opcProfilesTable.userId))
      .where(eq(bidsTable.demandId, demandId));

    res.json(bids.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to list bids" });
  }
});

router.post("/demands/:demandId/bids", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const body = CreateBidBody.parse(req.body);
    const opcId = req.user!.id;

    const [demand] = await db
      .select({
        publisherId:  demandsTable.publisherId,
        title:        demandsTable.title,
        opcLevel:     demandsTable.opcLevel,
        budget:       demandsTable.budget,
        status:       demandsTable.status,
      })
      .from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (!["published", "matched"].includes(demand.status)) {
      return res.status(400).json({ error: "该需求当前状态不接受抢单" });
    }

    const [opcProfile] = await db
      .select({ level: opcProfilesTable.level })
      .from(opcProfilesTable).where(eq(opcProfilesTable.userId, opcId)).limit(1);

    const opcActualLevel = opcProfile?.level ?? "C";
    const opcRank = LEVEL_RANK[opcActualLevel] ?? 1;

    if (demand.opcLevel && demand.opcLevel !== "any") {
      const requiredRank = LEVEL_RANK[demand.opcLevel] ?? 1;
      if (opcRank < requiredRank) {
        return res.status(403).json({
          error: `此需求要求 ${LEVEL_LABEL[demand.opcLevel] ?? demand.opcLevel} 及以上，您当前为 ${LEVEL_LABEL[opcActualLevel] ?? opcActualLevel}，暂无资格抢单`,
        });
      }
    }

    const budgetCap = LEVEL_BUDGET_CAP[opcActualLevel];
    if (budgetCap !== undefined && demand.budget > budgetCap) {
      return res.status(403).json({
        error: `该需求预算 ¥${demand.budget.toLocaleString()}，超出您 ${LEVEL_LABEL[opcActualLevel]} 的接单上限（¥${budgetCap.toLocaleString()}），请提升等级后再抢单`,
      });
    }

    const [bid] = await db.insert(bidsTable).values({
      demandId,
      opcId,
      proposal: body.proposal,
      estimatedDays: body.estimatedDays,
      portfolioLinks: body.portfolioLinks || [],
      status: "pending",
    }).returning();

    if (demand?.publisherId) {
      const [opc] = await db.select({ nickname: usersTable.nickname })
        .from(usersTable).where(eq(usersTable.id, opcId)).limit(1);
      await db.insert(notificationsTable).values({
        userId: demand.publisherId,
        type: "bid_received",
        title: "有新的抢单申请",
        content: `OPC「${opc?.nickname ?? "未知"}」已对您的需求「${demand.title}」发起抢单申请，请及时查看并处理。`,
        relatedId: demandId,
        relatedType: "demand",
      });
    }

    res.status(201).json({
      ...bid,
      createdAt: bid.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create bid" });
  }
});

router.patch("/bids/:bidId/status", requireAuth, async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId);
    const body = UpdateBidStatusBody.parse(req.body);

    const [updated] = await db.update(bidsTable).set({
      status: body.status as any,
    }).where(eq(bidsTable.id, bidId)).returning();

    if (body.status === "accepted") {
      const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, updated.demandId));
      if (demand) {
        const amount = demand.budget;
        const opcShare = amount * 0.9;
        const publisherShare = 0;
        const platformFee = amount * 0.1;

        const now = new Date();
        const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const seq = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
        const orderNo = `ORD-${ym}-${seq}`;

        await db.insert(ordersTable).values({
          orderNo,
          demandId: demand.id,
          opcId: updated.opcId,
          publisherId: demand.publisherId,
          amount,
          opcShare,
          publisherShare,
          platformFee,
          status: "in_progress",
          milestones: demand.milestones || [],
          deadline: demand.deadline,
        });

        await db.update(demandsTable).set({
          status: "matched",
          updatedAt: new Date(),
        }).where(eq(demandsTable.id, demand.id));

        await db.update(bidsTable).set({ status: "rejected" }).where(
          and(eq(bidsTable.demandId, demand.id), eq(bidsTable.status, "pending"))
        );
      }
    }

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update bid status" });
  }
});

export default router;
