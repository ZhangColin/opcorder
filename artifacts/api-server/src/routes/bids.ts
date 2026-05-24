import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, bidsTable, usersTable, opcProfilesTable, demandsTable, ordersTable, notificationsTable, settlementAccountsTable, opcTrackCertsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
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
        <h2 style="font-size:22px;font-weight:800;color:#1a1c1e;margin:0 0 20px;">您的报价已被选中！🎉</h2>
        <div style="border-left:3px solid #0047ab;padding-left:16px;margin-bottom:24px;">
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">您好，${n(nickname)}！</p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">您对需求「<strong>${n(demandTitle)}</strong>」的报价已被发单方选中！</p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">订单编号：<span style="font-family:monospace;background:#f3f4f6;padding:2px 8px;border-radius:6px;">${n(orderNo)}</span></p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">订单目前处于「待付款」状态，发单方正在完成付款。付款到账后订单将正式进入执行阶段，届时系统将再次通知您。</p>
          <p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">请登录接单吧，在「我的订单」中查看订单详情，提前做好执行准备。</p>
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
        demandBudgetMin: demandsTable.budgetMin,
        demandBudgetMax: demandsTable.budgetMax,
        demandDeadline: demandsTable.deadline,
        proposal: bidsTable.proposal,
        estimatedDays: bidsTable.estimatedDays,
        portfolioLinks: bidsTable.portfolioLinks,
        quoteCardData: bidsTable.quoteCardData,
        quotedPrice: bidsTable.quotedPrice,
        status: bidsTable.status,
        createdAt: bidsTable.createdAt,
      })
      .from(bidsTable)
      .leftJoin(demandsTable, eq(bidsTable.demandId, demandsTable.id))
      .where(eq(bidsTable.opcId, opcId))
      .orderBy(desc(bidsTable.createdAt));

    return res.json(bids.map(b => ({
      ...b,
      demandDeadline: b.demandDeadline ?? null,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch my bids" });
  }
});

/* PATCH /bids/:bidId/withdraw — OPC withdraws their own pending bid */
router.patch("/bids/:bidId/withdraw", requireAuth, async (req, res) => {
  if (req.user!.role !== "opc") return res.status(403).json({ error: "仅OPC可撤消申请" });
  try {
    const bidId = parseInt(req.params.bidId as string, 10);
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

    const rows = await db
      .update(bidsTable)
      .set({ status: "withdrawn" })
      .where(and(eq(bidsTable.id, bidId), eq(bidsTable.opcId, opcId), eq(bidsTable.status, "pending")))
      .returning();

    if (rows.length === 0) {
      return res.status(409).json({ error: "申请状态已发生变化（可能已被审核），撤消失败" });
    }

    return res.json({ id: rows[0].id, status: rows[0].status });
  } catch (error) {
    return res.status(500).json({ error: "撤消申请失败" });
  }
});

router.get("/demands/:demandId/bids", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const { sql } = await import("drizzle-orm");
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
        opcCompletedOrders: sql<number>`COALESCE((SELECT COUNT(*) FROM ${ordersTable} WHERE ${ordersTable.opcId} = ${bidsTable.opcId} AND ${ordersTable.status} = 'completed'), 0)`,
        proposal: bidsTable.proposal,
        estimatedDays: bidsTable.estimatedDays,
        portfolioLinks: bidsTable.portfolioLinks,
        quoteCardData: bidsTable.quoteCardData,
        quoteCardSnapshot: bidsTable.quoteCardSnapshot,
        quotedPrice: bidsTable.quotedPrice,
        status: bidsTable.status,
        createdAt: bidsTable.createdAt,
      })
      .from(bidsTable)
      .leftJoin(usersTable, eq(bidsTable.opcId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(bidsTable.opcId, opcProfilesTable.userId))
      .where(eq(bidsTable.demandId, demandId));

    return res.json(bids.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to list bids" });
  }
});

router.post("/demands/:demandId/bids", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.demandId as string);
    const body = CreateBidBody.parse(req.body);
    const opcId = req.user!.id;

    const [demand] = await db
      .select({
        publisherId:        demandsTable.publisherId,
        title:              demandsTable.title,
        opcLevel:           demandsTable.opcLevel,
        budget:             demandsTable.budget,
        budgetMin:          demandsTable.budgetMin,
        status:             demandsTable.status,
        catCategoryId:      demandsTable.catCategoryId,
        requiredTrackLevel: demandsTable.requiredTrackLevel,
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

    // Track cert eligibility: if demand has a category with a required track level
    if (demand.catCategoryId && demand.requiredTrackLevel && demand.requiredTrackLevel !== "any") {
      const certRows = (await db.execute(sql`
        SELECT level FROM opc_track_certs
        WHERE user_id = ${opcId}
          AND cat_category_id = ${demand.catCategoryId}
          AND status = 'active'
        LIMIT 1
      `)).rows as Array<{ level: string }>;
      if (!certRows.length) {
        return res.status(403).json({
          error: "此需求要求指定赛道认证资质，您尚无该赛道认证记录，请提交作品申请赛道认证后再抢单",
          code: "TRACK_CERT_MISSING",
        });
      }
      const certLevel = certRows[0].level;
      if ((LEVEL_RANK[certLevel] ?? 0) < (LEVEL_RANK[demand.requiredTrackLevel] ?? 0)) {
        return res.status(403).json({
          error: `此需求要求该赛道 ${LEVEL_LABEL[demand.requiredTrackLevel] ?? demand.requiredTrackLevel} 级认证，您当前认证等级（${LEVEL_LABEL[certLevel] ?? certLevel}）不足`,
          code: "TRACK_CERT_LEVEL_INSUFFICIENT",
        });
      }
    }

    // Budget cap check uses budgetMin (new) with fallback to legacy budget
    const effectiveBudgetMin = (demand.budgetMin && demand.budgetMin > 0) ? demand.budgetMin : (demand.budget ?? 0);
    const budgetCap = LEVEL_BUDGET_CAP[opcActualLevel];
    if (budgetCap !== undefined && effectiveBudgetMin > budgetCap) {
      return res.status(403).json({
        error: `该需求预算下限 ¥${effectiveBudgetMin.toLocaleString()}，超出您 ${LEVEL_LABEL[opcActualLevel]} 的接单上限（¥${budgetCap.toLocaleString()}），请提升等级后再抢单`,
      });
    }

    // Check settlement account: OPC must have a verified settlement account before bidding
    const [settlement] = await db
      .select({ status: settlementAccountsTable.status })
      .from(settlementAccountsTable)
      .where(eq(settlementAccountsTable.userId, opcId))
      .limit(1);

    if (!settlement) {
      return res.status(403).json({
        error: "您尚未提交结算账户信息，请前往「结算账户」完善信息并通过审核后再抢单",
        code: "SETTLEMENT_ACCOUNT_MISSING",
      });
    }
    if (settlement.status !== "verified") {
      const statusMsg = settlement.status === "pending"
        ? "结算账户审核中，请耐心等待审核通过后再抢单"
        : "结算账户审核未通过，请修改信息后重新提交审核";
      return res.status(403).json({
        error: statusMsg,
        code: "SETTLEMENT_ACCOUNT_NOT_VERIFIED",
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

    const proposalText = body.proposal?.trim() || "";
    const quoteCardData = body.quoteCardData || {};
    const quotedPrice = body.quotedPrice ?? null;
    const quoteCardSnapshot = (body as any).quoteCardSnapshot ?? null;

    // Validate: at least one of quoteCardData or a non-empty proposal must be provided
    const hasQuoteCard = Object.keys(quoteCardData).length > 0;
    const hasProposal = proposalText.length > 0;
    if (!hasQuoteCard && !hasProposal) {
      return res.status(400).json({ error: "请填写报价方案：提交报价卡选项或文字方案（二选一）" });
    }

    // Validate: if quoteCardData is provided, quotedPrice must be a positive number
    if (hasQuoteCard && (!quotedPrice || quotedPrice <= 0)) {
      return res.status(400).json({ error: "选择报价卡后必须填写有效的报价金额（须大于0）" });
    }

    if (existingBid) {
      if (existingBid.status === "accepted") {
        return res.status(400).json({ error: "您已中标该需求，无法再次修改申请" });
      }
      const [updated] = await db
        .update(bidsTable)
        .set({
          proposal: proposalText,
          estimatedDays: body.estimatedDays,
          portfolioLinks: body.portfolioLinks || [],
          quoteCardData,
          quoteCardSnapshot,
          quotedPrice,
          status: "pending",
        })
        .where(eq(bidsTable.id, existingBid.id))
        .returning();
      bid = updated;
    } else {
      const [inserted] = await db.insert(bidsTable).values({
        demandId,
        opcId,
        proposal: proposalText,
        estimatedDays: body.estimatedDays,
        portfolioLinks: body.portfolioLinks || [],
        quoteCardData,
        quoteCardSnapshot,
        quotedPrice,
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
        title: "有新的报价申请",
        content: `OPC「${opc?.nickname ?? "未知"}」已对您的需求「${demand.title}」提交报价${quotedPrice ? `（报价：¥${quotedPrice.toLocaleString()}）` : ""}，请及时查看并对比报价。`,
        relatedId: demandId,
        relatedType: "demand",
      });
    }

    return res.status(isNew ? 201 : 200).json({
      ...bid,
      createdAt: bid.createdAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create bid" });
  }
});

router.patch("/bids/:bidId/status", requireAuth, async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId as string);
    if (isNaN(bidId) || bidId <= 0) return res.status(400).json({ error: "无效的申请ID" });

    const body = UpdateBidStatusBody.parse(req.body);
    const caller = req.user!;

    // Fetch bid + associated demand for authorization
    const [bid] = await db
      .select({
        id: bidsTable.id,
        demandId: bidsTable.demandId,
        opcId: bidsTable.opcId,
        status: bidsTable.status,
        quotedPrice: bidsTable.quotedPrice,
        estimatedDays: bidsTable.estimatedDays,
      })
      .from(bidsTable)
      .where(eq(bidsTable.id, bidId))
      .limit(1);

    if (!bid) return res.status(404).json({ error: "报价申请不存在" });

    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, bid.demandId)).limit(1);
    if (!demand) return res.status(404).json({ error: "关联需求不存在" });

    // Only the demand publisher or an admin may accept/reject bids
    const isAdmin = caller.role === "admin";
    const isPublisher = demand.publisherId === caller.id;

    if (["accepted", "rejected"].includes(body.status)) {
      if (!isPublisher && !isAdmin) {
        return res.status(403).json({ error: "只有发单方或管理员可以选中/拒绝报价" });
      }
    }

    // Prevent re-accepting an already-accepted bid
    if (body.status === "accepted" && bid.status === "accepted") {
      return res.status(400).json({ error: "该报价已处于选中状态" });
    }

    // Prevent accepting a bid when another bid is already accepted for this demand
    if (body.status === "accepted") {
      const [alreadyAccepted] = await db
        .select({ id: bidsTable.id })
        .from(bidsTable)
        .where(and(eq(bidsTable.demandId, bid.demandId), eq(bidsTable.status, "accepted")))
        .limit(1);
      if (alreadyAccepted) {
        return res.status(400).json({ error: "该需求已有选中的报价，请先关闭相关订单后再重新选择" });
      }
    }

    const [updated] = await db.update(bidsTable).set({
      status: body.status as "pending" | "accepted" | "rejected" | "withdrawn",
    }).where(eq(bidsTable.id, bidId)).returning();

    let createdOrder: { id: number } | undefined;

    if (body.status === "accepted") {
      if (demand) {
        // Require quotedPrice from the structured quote card; refuse silent fallback to legacy budget
        if (!updated.quotedPrice || updated.quotedPrice <= 0) {
          // Roll back the accept
          await db.update(bidsTable).set({ status: "pending" }).where(eq(bidsTable.id, bidId));
          return res.status(400).json({ error: "该报价缺少有效的报价金额，请要求OPC补充后重新提交" });
        }
        const amount = updated.quotedPrice;
        const opcShare = amount * 0.9;
        const publisherShare = 0;
        const platformFee = amount * 0.1;

        const now = new Date();
        const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const seq = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
        const orderNo = `ORD-${ym}-${seq}`;

        // Create order with pending_payment status — publisher must pay before work begins
        [createdOrder] = await db.insert(ordersTable).values({
          orderNo,
          demandId: demand.id,
          opcId: updated.opcId,
          publisherId: demand.publisherId,
          amount,
          opcShare,
          publisherShare,
          platformFee,
          status: "pending_payment",
          milestones: demand.milestones || [],
          deadline: demand.deadline,
        }).returning({ id: ordersTable.id });

        await db.update(demandsTable).set({
          status: "matched",
          updatedAt: new Date(),
        }).where(eq(demandsTable.id, demand.id));

        // Reject all other pending bids
        await db.update(bidsTable).set({ status: "rejected" }).where(
          and(eq(bidsTable.demandId, demand.id), eq(bidsTable.status, "pending"))
        );

        // Notify winning OPC that their bid was selected but payment is pending
        const [opcUser] = await db.select({ nickname: usersTable.nickname, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, updated.opcId)).limit(1);

        await db.insert(notificationsTable).values({
          userId: updated.opcId,
          type: "system",
          title: "您的报价已被选中！（等待发单方付款）",
          content: `您对需求「${demand.title}」的报价已被发单方选中。订单编号：${orderNo}。目前订单处于「待付款」状态，发单方完成付款后订单将正式启动。`,
          relatedId: demand.id,
          relatedType: "demand",
        });

        // Notify losing OPCs
        const losingBids = await db
          .select({ opcId: bidsTable.opcId })
          .from(bidsTable)
          .where(and(eq(bidsTable.demandId, demand.id), eq(bidsTable.status, "rejected")));

        const uniqueLosingOpcIds = [...new Set(losingBids.map(b => b.opcId).filter(id => id !== updated.opcId))];
        if (uniqueLosingOpcIds.length > 0) {
          await db.insert(notificationsTable).values(
            uniqueLosingOpcIds.map(opcId => ({
              userId: opcId,
              type: "system" as const,
              title: "该需求已选定其他OPC",
              content: `您对需求「${demand.title}」的报价未被选中，感谢您的参与。`,
              relatedId: demand.id,
              relatedType: "demand",
            }))
          );
        }

        if (opcUser?.email) {
          resend.emails.send({
            from: "接单吧 <jiedanba@opcorder.com>",
            to: opcUser.email,
            subject: `您的报价已被选中！需求「${demand.title}」- 接单吧`,
            html: buildWinnerEmail(opcUser.nickname ?? opcUser.email, demand.title, orderNo),
          }).catch(() => {});
        }
      }
    }

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      ...(createdOrder ? { orderId: createdOrder.id } : {}),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update bid status" });
  }
});

export default router;
