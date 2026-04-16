import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, bidsTable, usersTable, opcProfilesTable, demandsTable, ordersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateBidBody,
  UpdateBidStatusBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildWinnerEmail(nickname: string, demandTitle: string, orderNo: string): string {
  const n = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f9fc;">
      <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
          <div style="background:#0047ab;width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;">
            <span style="color:white;font-weight:900;font-size:18px;line-height:1;">接</span>
          </div>
          <span style="display:inline-block;vertical-align:middle;font-weight:900;font-size:20px;color:#0047ab;margin-left:10px;">接单吧</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#1a1c1e;margin:0 0 20px;">恭喜您中标！🎉</h2>
        <div style="border-left:3px solid #0047ab;padding-left:16px;margin-bottom:24px;">
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">您好，${n(nickname)}！</p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">您的申请已被发单方选中，需求「<strong>${n(demandTitle)}</strong>」已正式进入执行阶段。</p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">订单编号：<span style="font-family:monospace;background:#f3f4f6;padding:2px 8px;border-radius:6px;">${n(orderNo)}</span></p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">请登录接单吧，在「我的订单」中查看订单详情并开始执行。请务必在约定期限内按时完成各里程碑交付。</p>
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:16px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
          此邮件由系统自动发送，请勿直接回复。
        </p>
      </div>
      <p style="text-align:center;color:#c4c4c4;font-size:12px;margin:16px 0 0;">© 2026 接单吧 · OPC撮合交易平台</p>
    </div>
  `;
}

const router: IRouter = Router();

const LEVEL_RANK: Record<string, number> = { C: 1, B: 2, A: 3 };
const LEVEL_BUDGET_CAP: Record<string, number> = { C: 3_000, B: 20_000, A: 200_000 };
const LEVEL_LABEL: Record<string, string> = { C: "C级（新手）", B: "B级（进阶）", A: "A级（专家）" };

/* GET /bids/my — returns all bids submitted by the current user (any role) */
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
      demandDeadline: b.demandDeadline ?? null,   // date column returns string, not Date
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch my bids" });
  }
});

/* PATCH /bids/:bidId/withdraw — OPC withdraws their own pending bid */
router.patch("/bids/:bidId/withdraw", requireAuth, async (req, res) => {
  if (req.user!.role !== "opc") return res.status(403).json({ error: "仅OPC可撤消申请" });
  try {
    const bidId = parseInt(req.params.bidId, 10);
    if (isNaN(bidId) || bidId <= 0) return res.status(400).json({ error: "无效的申请ID" });
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

    // Atomic update: only succeeds if status is still 'pending' at write time (prevents race condition)
    const rows = await db
      .update(bidsTable)
      .set({ status: "withdrawn" })
      .where(and(eq(bidsTable.id, bidId), eq(bidsTable.opcId, opcId), eq(bidsTable.status, "pending")))
      .returning();

    if (rows.length === 0) {
      return res.status(409).json({ error: "申请状态已发生变化（可能已被审核），撤消失败" });
    }

    res.json({ id: rows[0].id, status: rows[0].status });
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

    // Upsert: if a bid already exists for this OPC+demand, update it instead of inserting
    const [existingBid] = await db
      .select({ id: bidsTable.id, status: bidsTable.status })
      .from(bidsTable)
      .where(and(eq(bidsTable.demandId, demandId), eq(bidsTable.opcId, opcId)))
      .orderBy(desc(bidsTable.createdAt))
      .limit(1);

    let bid;
    let isNew = false;

    if (existingBid) {
      if (existingBid.status === "accepted") {
        return res.status(400).json({ error: "您已中标该需求，无法再次修改申请" });
      }
      // Update existing bid (reset to pending so publisher sees latest version)
      const [updated] = await db
        .update(bidsTable)
        .set({
          proposal: body.proposal,
          estimatedDays: body.estimatedDays,
          portfolioLinks: body.portfolioLinks || [],
          status: "pending",
        })
        .where(eq(bidsTable.id, existingBid.id))
        .returning();
      bid = updated;
    } else {
      const [inserted] = await db.insert(bidsTable).values({
        demandId,
        opcId,
        proposal: body.proposal,
        estimatedDays: body.estimatedDays,
        portfolioLinks: body.portfolioLinks || [],
        status: "pending",
      }).returning();
      bid = inserted;
      isNew = true;
    }

    // Only notify publisher on a brand-new bid (not on updates)
    if (isNew && demand?.publisherId) {
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

    res.status(isNew ? 201 : 200).json({
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

        // Send winner notification to OPC
        const [opcUser] = await db.select({ nickname: usersTable.nickname, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, updated.opcId)).limit(1);

        await db.insert(notificationsTable).values({
          userId: updated.opcId,
          type: "system",
          title: "恭喜您中标！",
          content: `您对需求「${demand.title}」的申请已被发单方选中。订单编号：${orderNo}。请登录接单吧查看订单详情并开始执行，请务必在约定期限内完成交付。`,
          relatedId: demand.id,
          relatedType: "demand",
        });

        if (opcUser?.email) {
          resend.emails.send({
            from: "接单吧 <noreply@aieducenter.com>",
            to: opcUser.email,
            subject: `恭喜中标！需求「${demand.title}」 - 接单吧`,
            html: buildWinnerEmail(opcUser.nickname ?? opcUser.email, demand.title, orderNo),
          }).catch(() => {});
        }
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
