import { Router, type IRouter } from "express";
import { db, bidsTable, usersTable, opcProfilesTable, demandsTable, ordersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateBidBody,
  UpdateBidStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/demands/:demandId/bids", async (req, res) => {
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

router.post("/demands/:demandId/bids", async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId);
    const body = CreateBidBody.parse(req.body);

    const authHeader = req.headers.authorization;
    const opcId = authHeader?.startsWith("Bearer ")
      ? parseInt(authHeader.slice(7), 10)
      : NaN;

    if (isNaN(opcId) || opcId <= 0) {
      return res.status(401).json({ error: "未授权，请先登录" });
    }

    const [bid] = await db.insert(bidsTable).values({
      demandId,
      opcId,
      proposal: body.proposal,
      estimatedDays: body.estimatedDays,
      portfolioLinks: body.portfolioLinks || [],
      status: "pending",
    }).returning();

    // 通知发布方有人抢单
    const [demand] = await db.select({ publisherId: demandsTable.publisherId, title: demandsTable.title })
      .from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (demand?.publisherId) {
      const [opc] = await db.select({ nickname: usersTable.nickname })
        .from(usersTable).where(eq(usersTable.id, opcId)).limit(1);
      await db.insert(notificationsTable).values({
        userId: demand.publisherId,
        type: "new_bid",
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

router.patch("/bids/:bidId/status", async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId);
    const body = UpdateBidStatusBody.parse(req.body);

    const [updated] = await db.update(bidsTable).set({
      status: body.status as any,
    }).where(eq(bidsTable.id, bidId)).returning();

    if (body.status === "accepted") {
      const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, updated.demandId));
      if (demand) {
        const amount = demand.budgetMax;
        const opcShare = amount * 0.6;
        const publisherShare = amount * 0.3;
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
