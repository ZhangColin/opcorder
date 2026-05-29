import { logger } from "../lib/logger";
import { applyCredit } from "../lib/credit";
import { Router, type IRouter } from "express";
import { db, ordersTable, demandsTable, usersTable, deliverablesTable, opcProfilesTable, notificationsTable, publisherProfilesTable, bidsTable, subOrdersTable, siteSettingsTable } from "@workspace/db";
import { eq, desc, count, sql, and } from "drizzle-orm";

type OrderStatus = "pending_payment" | "in_progress" | "pending_acceptance" | "completed" | "closed" | "disputed";

import {
  ListOrdersQueryParams,
  SubmitDeliverableBody,
  AcceptOrderBody,
  RejectDeliveryBody,
  SubmitOrderPaymentBody,
  CloseOrderBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { createPaymentOrder, queryPaymentStatus, PAYMENT_STATUS, TERMINAL_STATUSES } from "../lib/payment";

const NOTIFY_URL = "https://www.opcorder.com/api/payment/callback";

const router: IRouter = Router();

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const params = ListOrdersQueryParams.parse(req.query);
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const userId = req.user!.id;
    const userRole = req.user!.role;
    const conditions = [];
    if (params.status) conditions.push(eq(ordersTable.status, params.status as any));
    if (userRole === "admin") {
      if (params.publisherId) conditions.push(eq(ordersTable.publisherId, params.publisherId));
      if (params.opcId) conditions.push(eq(ordersTable.opcId, params.opcId));
    } else if (userRole === "publisher") {
      conditions.push(eq(ordersTable.publisherId, userId));
    } else {
      conditions.push(eq(ordersTable.opcId, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(ordersTable).where(whereClause);
    const total = Number(totalResult.count);

    const orders = await db
      .select({
        id: ordersTable.id,
        orderNo: ordersTable.orderNo,
        demandId: ordersTable.demandId,
        demandTitle: demandsTable.title,
        demandType: demandsTable.type,
        opcId: ordersTable.opcId,
        publisherId: ordersTable.publisherId,
        amount: ordersTable.amount,
        opcShare: ordersTable.opcShare,
        publisherShare: ordersTable.publisherShare,
        platformFee: ordersTable.platformFee,
        status: ordersTable.status,
        milestones: ordersTable.milestones,
        rating: ordersTable.rating,
        reviewComment: ordersTable.reviewComment,
        opcRating: ordersTable.opcRating,
        opcReviewComment: ordersTable.opcReviewComment,
        deadline: ordersTable.deadline,
        paymentMethod: ordersTable.paymentMethod,
        paymentReceiptUrl: ordersTable.paymentReceiptUrl,
        paymentNote: ordersTable.paymentNote,
        paymentOrderNo: ordersTable.paymentOrderNo,
        paymentRejectReason: ordersTable.paymentRejectReason,
        paidAt: ordersTable.paidAt,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
      })
      .from(ordersTable)
      .leftJoin(demandsTable, eq(ordersTable.demandId, demandsTable.id))
      .where(whereClause)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const items = await Promise.all(orders.map(async (o) => {
      const deliverables = await db.select().from(deliverablesTable).where(eq(deliverablesTable.orderId, o.id));
      const [opcUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.opcId));
      const [pubUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.publisherId));

      return {
        ...o,
        opcNickname: opcUser?.nickname,
        publisherName: pubUser?.nickname,
        deliverables: deliverables.map(d => ({
          ...d,
          submittedAt: d.submittedAt.toISOString(),
        })),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      };
    }));

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to list orders");
    return res.status(500).json({ error: "Failed to list orders" });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const [order] = await db
      .select({
        id: ordersTable.id,
        orderNo: ordersTable.orderNo,
        demandId: ordersTable.demandId,
        demandTitle: demandsTable.title,
        demandType: demandsTable.type,
        demandDescription: demandsTable.description,
        demandBudgetMin: demandsTable.budgetMin,
        demandBudgetMax: demandsTable.budgetMax,
        demandSkillTags: demandsTable.skillTags,
        demandAttachments: demandsTable.attachments,
        opcId: ordersTable.opcId,
        publisherId: ordersTable.publisherId,
        amount: ordersTable.amount,
        opcShare: ordersTable.opcShare,
        publisherShare: ordersTable.publisherShare,
        platformFee: ordersTable.platformFee,
        status: ordersTable.status,
        milestones: ordersTable.milestones,
        rating: ordersTable.rating,
        reviewComment: ordersTable.reviewComment,
        opcRating: ordersTable.opcRating,
        opcReviewComment: ordersTable.opcReviewComment,
        deadline: ordersTable.deadline,
        paymentMethod: ordersTable.paymentMethod,
        paymentReceiptUrl: ordersTable.paymentReceiptUrl,
        paymentNote: ordersTable.paymentNote,
        paymentOrderNo: ordersTable.paymentOrderNo,
        paymentRejectReason: ordersTable.paymentRejectReason,
        paidAt: ordersTable.paidAt,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
      })
      .from(ordersTable)
      .leftJoin(demandsTable, eq(ordersTable.demandId, demandsTable.id))
      .where(eq(ordersTable.id, orderId));

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const userId = req.user!.id;
    const userRole = req.user!.role;
    if (userRole !== "admin" && order.opcId !== userId && order.publisherId !== userId) {
      return res.status(403).json({ error: "无权查看他人订单" });
    }

    const [deliverables, opcUser, pubUser, pubProfile, acceptedBid] = await Promise.all([
      db.select().from(deliverablesTable).where(eq(deliverablesTable.orderId, orderId)),
      db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.opcId)).then(r => r[0]),
      db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.publisherId)).then(r => r[0]),
      db.select({
        companyLogo: publisherProfilesTable.companyLogo,
        companyDesc: publisherProfilesTable.companyDesc,
        industry: publisherProfilesTable.industry,
        location: publisherProfilesTable.location,
        teamSize: publisherProfilesTable.teamSize,
        foundedYear: publisherProfilesTable.foundedYear,
        website: publisherProfilesTable.website,
        contactEmail: publisherProfilesTable.contactEmail,
      }).from(publisherProfilesTable).where(eq(publisherProfilesTable.userId, order.publisherId)).then(r => r[0]),
      db.select({
        proposal: bidsTable.proposal,
        quoteCardSnapshot: bidsTable.quoteCardSnapshot,
        quotedPrice: bidsTable.quotedPrice,
        estimatedDays: bidsTable.estimatedDays,
      }).from(bidsTable).where(
        and(eq(bidsTable.demandId, order.demandId), eq(bidsTable.opcId, order.opcId), eq(bidsTable.status, "accepted"))
      ).then(r => r[0]),
    ]);

    const isAdmin = userRole === "admin";
    const isPublisher = userId === order.publisherId;
    const safeProfile = pubProfile ? {
      ...pubProfile,
      contactEmail: (isAdmin || isPublisher) ? pubProfile.contactEmail : null,
    } : null;

    return res.json({
      ...order,
      opcNickname: opcUser?.nickname,
      publisherName: pubUser?.nickname,
      publisherLogo: pubProfile?.companyLogo ?? null,
      publisherProfile: safeProfile,
      opcProposal: acceptedBid?.proposal ?? null,
      opcQuoteCardSnapshot: acceptedBid?.quoteCardSnapshot ?? null,
      opcQuotedPrice: acceptedBid?.quotedPrice ?? null,
      opcEstimatedDays: acceptedBid?.estimatedDays ?? null,
      deliverables: deliverables.map(d => ({
        ...d,
        submittedAt: d.submittedAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.post("/orders/:orderId/deliverables", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const body = SubmitDeliverableBody.parse(req.body);

    // Load order first to enforce ownership and status gate
    const [ord] = await db
      .select({ opcId: ordersTable.opcId, status: ordersTable.status, milestones: ordersTable.milestones })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!ord) return res.status(404).json({ error: "订单不存在" });

    // Only the OPC assigned to this order may submit deliverables
    if (ord.opcId !== req.user!.id) {
      return res.status(403).json({ error: "无权操作：只有订单承接方（OPC）可以提交交付物" });
    }

    // Deliverables can only be submitted once the order is in_progress
    if (ord.status !== "in_progress") {
      const statusMsg: Record<string, string> = {
        pending_payment: "订单尚未开始，请等待发单方完成付款后再提交交付物",
        pending_acceptance: "订单已进入验收阶段，请等待发单方验收",
        completed: "订单已完成，无法再提交交付物",
        closed: "订单已关闭",
        disputed: "订单存在争议，请联系管理员",
      };
      return res.status(400).json({ error: statusMsg[ord.status] ?? `当前订单状态「${ord.status}」不允许提交交付物` });
    }

    const [deliverable] = await db.insert(deliverablesTable).values({
      orderId,
      milestoneId: body.milestoneId,
      title: body.title,
      description: body.description,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      status: "submitted",
    }).returning();

    // Milestone orders ALWAYS stay in_progress — per-milestone review drives completion.
    // Non-milestone orders transition to pending_acceptance on submission.
    const hasMilestones = Array.isArray(ord?.milestones) && ord.milestones.length > 0;
    const newStatus: OrderStatus = hasMilestones ? "in_progress" : "pending_acceptance";

    await db.update(ordersTable).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId));

    return res.status(201).json({
      ...deliverable,
      submittedAt: deliverable.submittedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to submit deliverable" });
  }
});

/* ─── OPC edit a submitted (not yet reviewed) deliverable ─── */
router.patch("/orders/:orderId/deliverables/:deliverableId", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const deliverableId = parseInt(req.params.deliverableId as string);

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.opcId !== req.user!.id) return res.status(403).json({ error: "无权操作" });

    const [deliv] = await db.select().from(deliverablesTable).where(
      and(eq(deliverablesTable.id, deliverableId), eq(deliverablesTable.orderId, orderId))
    );
    if (!deliv) return res.status(404).json({ error: "交付物不存在" });
    if (deliv.status === "approved") return res.status(400).json({ error: "审核通过的交付物不可修改" });

    const { title, description, fileUrl, fileName } = req.body;
    const [updated] = await db.update(deliverablesTable).set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(fileName !== undefined && { fileName }),
      status: "submitted",
      feedback: null,
      submittedAt: new Date(),
    }).where(eq(deliverablesTable.id, deliverableId)).returning();

    return res.json({ ...updated, submittedAt: updated.submittedAt.toISOString() });
  } catch (error) {
    logger.error(error, "Failed to update deliverable");
    return res.status(500).json({ error: "修改失败" });
  }
});

/* ─── Per-milestone accept ─────────────────────── */
router.post("/orders/:orderId/milestones/:milestoneId/accept", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const milestoneId = parseInt(req.params.milestoneId as string); // 1-based
    const milestoneIdx = milestoneId - 1; // 0-based for JSONB array

    // Validate body with shared AcceptOrderBody schema (same validation as global accept)
    const body = AcceptOrderBody.parse(req.body);

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.publisherId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    const milestones = (order.milestones ?? []) as Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>;
    if (milestoneIdx < 0 || milestoneIdx >= milestones.length) {
      return res.status(400).json({ error: "里程碑不存在" });
    }

    // Find the submitted deliverable for this milestone
    const [submittedDeliv] = await db
      .select()
      .from(deliverablesTable)
      .where(and(
        eq(deliverablesTable.orderId, orderId),
        eq(deliverablesTable.milestoneId, milestoneId),
        eq(deliverablesTable.status, "submitted"),
      ))
      .orderBy(desc(deliverablesTable.submittedAt))
      .limit(1);

    if (!submittedDeliv) {
      // Recovery path: check if milestone was already approved (e.g. due to a prior partial failure)
      const [alreadyApproved] = await db
        .select({ id: deliverablesTable.id })
        .from(deliverablesTable)
        .where(and(
          eq(deliverablesTable.orderId, orderId),
          eq(deliverablesTable.milestoneId, milestoneId),
          eq(deliverablesTable.status, "approved"),
        ))
        .limit(1);

      if (!alreadyApproved) {
        return res.status(400).json({ error: "该里程碑没有待审核的交付物" });
      }
      // Already approved — fall through to the "check if all done" section below
    } else {
      // Normal path: mark deliverable approved and update JSONB milestone status
      await db.update(deliverablesTable).set({
        status: "approved",
      }).where(eq(deliverablesTable.id, submittedDeliv.id));

      await db.execute(
        sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},status}'`)}, '"approved"'::jsonb), updated_at = NOW() WHERE id = ${orderId}`
      );
      // Optional: save rating / comment — non-critical, ignore failures
      try {
        if (body.rating) {
          await db.execute(
            sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},rating}'`)}, to_jsonb(${sql.raw(String(body.rating))})) WHERE id = ${orderId}`
          );
        }
        if (body.comment) {
          await db.execute(
            sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},comment}'`)}, to_jsonb(${body.comment}::text)) WHERE id = ${orderId}`
          );
        }
      } catch (ratingErr) {
        req.log.warn({ msg: "milestone rating/comment save failed (non-critical)", err: String(ratingErr) });
      }
    }

    // Re-fetch milestones to check if all are approved
    const [freshOrder] = await db.select({ milestones: ordersTable.milestones }).from(ordersTable).where(eq(ordersTable.id, orderId));
    const freshMilestones = (freshOrder?.milestones ?? []) as Array<{ status?: string }>;
    const allApproved = freshMilestones.length > 0 && freshMilestones.every(m => m.status === "approved");

    let finalOrder;
    if (allApproved) {
      // All milestones approved → complete the order
      const updateData: Record<string, unknown> = {
        status: "completed",
        updatedAt: new Date(),
      };
      if (body.rating) updateData.rating = body.rating;
      if (body.comment) updateData.reviewComment = body.comment;

      const [updated] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, orderId)).returning();
      finalOrder = updated;

      // Settle sub-orders on completion
      {
        const now = new Date();
        const hbRows = await db.select().from(siteSettingsTable)
          .where(eq(siteSettingsTable.key, "holdback_release_days")).limit(1);
        const holdbackDays = parseInt(hbRows[0]?.value ?? "90", 10) || 90;
        const releasableAt = new Date(now.getTime() + holdbackDays * 86400 * 1000);
        await db.execute(sql`UPDATE sub_orders SET settled_at = ${now.toISOString()} WHERE order_no = ${updated.orderNo} AND sub_role IN ('opc_primary', 'platform') AND settled_at IS NULL`);
        await db.execute(sql`UPDATE sub_orders SET releasable_at = ${releasableAt.toISOString()} WHERE order_no = ${updated.orderNo} AND sub_role = 'opc_holdback' AND releasable_at IS NULL`);
      }

      // Complete the demand
      await db.update(demandsTable).set({
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(demandsTable.id, updated.demandId));

      // Update OPC avg rating
      const opcOrders = await db.select({ rating: ordersTable.rating })
        .from(ordersTable)
        .where(eq(ordersTable.opcId, updated.opcId));
      const ratings = opcOrders.filter(o => o.rating).map(o => o.rating!);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      await db.update(opcProfilesTable).set({
        avgRating,
        totalOrders: opcOrders.length,
      }).where(eq(opcProfilesTable.userId, updated.opcId));

      // Notify OPC and publisher
      await db.insert(notificationsTable).values({
        userId: updated.opcId,
        type: "order_completed",
        title: "订单已完成，结算流程已触发",
        content: `订单「${updated.orderNo}」所有里程碑已通过验收，结算流程已触发，您的分成将在3个工作日内到账。`,
        relatedId: orderId,
        relatedType: "order",
      });
      await db.insert(notificationsTable).values({
        userId: updated.publisherId,
        type: "order_completed",
        title: "订单已完成，结算流程已触发",
        content: `订单「${updated.orderNo}」所有里程碑均已通过验收，结算流程已自动触发。`,
        relatedId: orderId,
        relatedType: "order",
      });

      // Credit engine: order completed + rating bonus/penalty (non-blocking)
      applyCredit(updated.opcId, "order_completed", { refId: orderId, note: `订单 ${updated.orderNo} 完成` }).catch(() => {});
      if (body.rating && body.rating === 5) {
        applyCredit(updated.opcId, "five_star_review", { refId: orderId, note: `订单 ${updated.orderNo} 获5星好评` }).catch(() => {});
      } else if (body.rating && body.rating <= 2) {
        applyCredit(updated.opcId, "bad_review", { refId: orderId, note: `订单 ${updated.orderNo} 获${body.rating}星差评` }).catch(() => {});
      }
    } else {
      const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      finalOrder = updated;
    }

    return res.json({
      ...finalOrder,
      allCompleted: allApproved,
      createdAt: finalOrder.createdAt.toISOString(),
      updatedAt: finalOrder.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return res.status(400).json({ error: "请求参数无效" });
    }
    req.log.error({ msg: "milestone accept error", err: String(error) });
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── Per-milestone reject ─────────────────────── */
router.post("/orders/:orderId/milestones/:milestoneId/reject", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const milestoneId = parseInt(req.params.milestoneId as string); // 1-based
    const milestoneIdx = milestoneId - 1; // 0-based for JSONB array

    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) return res.status(400).json({ error: "请填写打回原因" });

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.publisherId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "无权操作" });
    }

    const milestones = (order.milestones ?? []) as Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>;
    if (milestoneIdx < 0 || milestoneIdx >= milestones.length) {
      return res.status(400).json({ error: "里程碑不存在" });
    }

    // Find the submitted deliverable for this milestone
    const [submittedDeliv] = await db
      .select()
      .from(deliverablesTable)
      .where(and(
        eq(deliverablesTable.orderId, orderId),
        eq(deliverablesTable.milestoneId, milestoneId),
        eq(deliverablesTable.status, "submitted"),
      ))
      .orderBy(desc(deliverablesTable.submittedAt))
      .limit(1);

    if (!submittedDeliv) {
      return res.status(400).json({ error: "该里程碑没有待审核的交付物" });
    }

    // Mark the deliverable as rejected with feedback
    await db.update(deliverablesTable).set({
      status: "rejected",
      feedback: reason.trim(),
    }).where(eq(deliverablesTable.id, submittedDeliv.id));

    // Update the milestone JSONB status to 'rejected'
    await db.execute(
      sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},status}'`)}, '"rejected"'::jsonb), updated_at = NOW() WHERE id = ${orderId}`
    );

    // Count total rejected deliverables for THIS milestone
    const [{ rejCount }] = await db
      .select({ rejCount: count() })
      .from(deliverablesTable)
      .where(and(
        eq(deliverablesTable.orderId, orderId),
        eq(deliverablesTable.milestoneId, milestoneId),
        eq(deliverablesTable.status, "rejected"),
      ));

    const MAX_REVISIONS = 3;
    const milestoneRejections = Number(rejCount);
    const newOrderStatus: OrderStatus = milestoneRejections >= MAX_REVISIONS ? "disputed" : "in_progress";

    const [updated] = await db.update(ordersTable).set({
      status: newOrderStatus,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId)).returning();

    if (newOrderStatus === "disputed") {
      await db.insert(notificationsTable).values({
        userId: updated.opcId,
        type: "dispute_raised",
        title: "订单已进入争议流程",
        content: `您的订单里程碑「${milestones[milestoneIdx]?.name ?? ""}」返工次数达到上限（${MAX_REVISIONS}次），已自动转入争议处理流程，平台将在48小时内介入调解。`,
        relatedId: orderId,
        relatedType: "order",
      });
      await db.insert(notificationsTable).values({
        userId: updated.publisherId,
        type: "dispute_raised",
        title: "订单已进入争议流程",
        content: `里程碑「${milestones[milestoneIdx]?.name ?? ""}」返工次数已达上限（${MAX_REVISIONS}次），已自动转入争议处理流程，平台将在48小时内介入调解。`,
        relatedId: orderId,
        relatedType: "order",
      });
      // Credit: deduct for dispute (non-blocking)
      applyCredit(updated.opcId, "order_disputed", { refId: orderId, note: `订单 ${updated.orderNo} 里程碑争议` }).catch(() => {});
    }

    return res.json({
      ...updated,
      milestoneRejections,
      autoDisputed: newOrderStatus === "disputed",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return res.status(400).json({ error: "请求参数无效" });
    }
    req.log.error({ msg: "milestone reject error", err: String(error) });
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── Global accept (non-milestone orders only) ─── */
router.post("/orders/:orderId/accept", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const body = AcceptOrderBody.parse(req.body);

    // Block global accept on milestone orders — use per-milestone endpoints instead
    const [orderCheck] = await db
      .select({ milestones: ordersTable.milestones })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (Array.isArray(orderCheck?.milestones) && orderCheck.milestones.length > 0) {
      return res.status(400).json({ error: "里程碑订单请使用逐里程碑验收接口" });
    }

    const updateData: Record<string, unknown> = {
      status: "completed",
      updatedAt: new Date(),
    };
    if (body.rating) updateData.rating = body.rating;
    if (body.comment) updateData.reviewComment = body.comment;

    // Also mark all currently-submitted deliverables as approved
    await db.update(deliverablesTable).set({
      status: "approved",
    }).where(and(
      eq(deliverablesTable.orderId, orderId),
      eq(deliverablesTable.status, "submitted"),
    ));

    const [updated] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, orderId)).returning();

    if (updated) {
      await db.update(demandsTable).set({
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(demandsTable.id, updated.demandId));

      // Settle sub-orders on completion
      {
        const now = new Date();
        const hbRows = await db.select().from(siteSettingsTable)
          .where(eq(siteSettingsTable.key, "holdback_release_days")).limit(1);
        const holdbackDays = parseInt(hbRows[0]?.value ?? "90", 10) || 90;
        const releasableAt = new Date(now.getTime() + holdbackDays * 86400 * 1000);
        await db.execute(sql`UPDATE sub_orders SET settled_at = ${now.toISOString()} WHERE order_no = ${updated.orderNo} AND sub_role IN ('opc_primary', 'platform') AND settled_at IS NULL`);
        await db.execute(sql`UPDATE sub_orders SET releasable_at = ${releasableAt.toISOString()} WHERE order_no = ${updated.orderNo} AND sub_role = 'opc_holdback' AND releasable_at IS NULL`);
      }

      if (body.rating) {
        const opcOrders = await db.select({ rating: ordersTable.rating })
          .from(ordersTable)
          .where(eq(ordersTable.opcId, updated.opcId));
        const ratings = opcOrders.filter(o => o.rating).map(o => o.rating!);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

        await db.update(opcProfilesTable).set({
          avgRating,
          totalOrders: opcOrders.length,
        }).where(eq(opcProfilesTable.userId, updated.opcId));
      }

      // Notify OPC and publisher
      await db.insert(notificationsTable).values({
        userId: updated.opcId,
        type: "order_completed",
        title: "订单已完成，结算流程已触发",
        content: `订单「${updated.orderNo}」已通过验收，结算流程已触发，您的分成将在3个工作日内到账。`,
        relatedId: orderId,
        relatedType: "order",
      });
      await db.insert(notificationsTable).values({
        userId: updated.publisherId,
        type: "order_completed",
        title: "订单已完成，结算流程已触发",
        content: `订单「${updated.orderNo}」已通过验收，结算流程已自动触发。`,
        relatedId: orderId,
        relatedType: "order",
      });

      // Credit engine: order completed + rating bonus/penalty (non-blocking)
      applyCredit(updated.opcId, "order_completed", { refId: orderId, note: `订单 ${updated.orderNo} 完成` }).catch(() => {});
      if (body.rating && body.rating === 5) {
        applyCredit(updated.opcId, "five_star_review", { refId: orderId, note: `订单 ${updated.orderNo} 获5星好评` }).catch(() => {});
      } else if (body.rating && body.rating <= 2) {
        applyCredit(updated.opcId, "bad_review", { refId: orderId, note: `订单 ${updated.orderNo} 获${body.rating}星差评` }).catch(() => {});
      }
    }

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to accept order" });
  }
});

/* ─── Global reject (non-milestone orders only) ─── */
router.post("/orders/:orderId/reject", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const body = RejectDeliveryBody.parse(req.body);

    // Block global reject on milestone orders — use per-milestone endpoints instead
    const [orderCheck] = await db
      .select({ milestones: ordersTable.milestones })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (Array.isArray(orderCheck?.milestones) && orderCheck.milestones.length > 0) {
      return res.status(400).json({ error: "里程碑订单请使用逐里程碑打回接口" });
    }

    await db.update(deliverablesTable).set({
      status: "rejected",
      feedback: body.reason,
    }).where(and(
      eq(deliverablesTable.orderId, orderId),
      eq(deliverablesTable.status, "submitted"),
    ));

    const [{ rejectionCount }] = await db
      .select({ rejectionCount: count() })
      .from(deliverablesTable)
      .where(and(
        eq(deliverablesTable.orderId, orderId),
        eq(deliverablesTable.status, "rejected"),
      ));

    const MAX_REVISIONS = 3;
    const newStatus: OrderStatus = Number(rejectionCount) >= MAX_REVISIONS ? "disputed" : "in_progress";

    const [updated] = await db.update(ordersTable).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId)).returning();

    if (newStatus === "disputed") {
      await db.insert(notificationsTable).values({
        userId: updated.opcId,
        type: "dispute_raised",
        title: "订单已进入争议流程",
        content: `您的订单因返工次数达到上限（${MAX_REVISIONS}次），已自动转入争议处理流程，平台将在48小时内介入调解。`,
        relatedId: orderId,
        relatedType: "order",
      });
      await db.insert(notificationsTable).values({
        userId: updated.publisherId,
        type: "dispute_raised",
        title: "订单已进入争议流程",
        content: `订单返工次数已达上限（${MAX_REVISIONS}次），已自动转入争议处理流程，平台将在48小时内介入调解。`,
        relatedId: orderId,
        relatedType: "order",
      });
      // Credit: deduct for dispute (non-blocking)
      applyCredit(updated.opcId, "order_disputed", { refId: orderId, note: `订单 ${updated.orderNo} 争议` }).catch(() => {});
    }

    return res.json({
      ...updated,
      rejectionCount: Number(rejectionCount),
      autoDisputed: newStatus === "disputed",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reject delivery" });
  }
});

/* ─── Order payment (publisher submits deposit) ─── */
router.post("/orders/:orderId/payment", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const parsed = SubmitOrderPaymentBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "请求参数无效", details: parsed.error.flatten().fieldErrors });
    }
    const { method, receiptUrl, paymentNote } = parsed.data;

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        publisherId: ordersTable.publisherId,
        opcId: ordersTable.opcId,
        amount: ordersTable.amount,
        orderNo: ordersTable.orderNo,
        demandId: ordersTable.demandId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ error: "该订单当前状态无需缴纳保证金" });
    }
    if (order.publisherId !== req.user!.id) {
      return res.status(403).json({ error: "无权操作" });
    }

    const [demandRow] = await db
      .select({ title: demandsTable.title })
      .from(demandsTable)
      .where(eq(demandsTable.id, order.demandId))
      .limit(1);

    if (method === "online") {
      const businessOrderNo = `ORDER-DEP-${orderId}-${Date.now()}`;
      const amountFen = Math.round(order.amount * 100);

      const payOrder = await createPaymentOrder({
        businessOrderNo,
        amount: amountFen,
        subject: `订单保证金-${demandRow?.title ?? orderId}`,
        body: `订单保证金`,
        businessName: "订单保证金",
        notifyUrl: NOTIFY_URL,
      });

      await db.update(ordersTable).set({
        paymentMethod: "online",
        paymentOrderNo: payOrder.paymentOrderNo,
        paymentNote: paymentNote?.trim() || null,
        paymentRejectReason: null,
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, orderId));

      return res.status(201).json({
        orderId,
        method: "online",
        qrCodeUrl: payOrder.qrCodeUrl,
        paymentOrderNo: payOrder.paymentOrderNo,
      });
    }

    // Offline payment: store receipt and wait for admin confirmation
    await db.update(ordersTable).set({
      paymentMethod: "offline",
      paymentReceiptUrl: receiptUrl?.trim() || null,
      paymentNote: paymentNote?.trim() || null,
      paymentRejectReason: null,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId));

    return res.status(201).json({
      orderId,
      method: "offline",
      message: "线下付款信息已提交，请等待管理员确认",
    });
  } catch (error) {
    logger.error({ err: error }, "POST /orders/:orderId/payment error");
    return res.status(500).json({ error: "提交付款失败" });
  }
});

/* ─── Poll online payment status for an order ─── */
router.post("/orders/:orderId/payment-status", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);

    const [order] = await db
      .select({
        publisherId: ordersTable.publisherId,
        status: ordersTable.status,
        paymentOrderNo: ordersTable.paymentOrderNo,
        opcId: ordersTable.opcId,
        orderNo: ordersTable.orderNo,
        demandId: ordersTable.demandId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.publisherId !== req.user!.id) return res.status(403).json({ error: "无权操作" });

    if (order.status !== "pending_payment") {
      return res.json({ status: PAYMENT_STATUS.PAID, paid: true, terminal: true, confirmed: true });
    }

    if (!order.paymentOrderNo) return res.status(400).json({ error: "尚未创建在线支付订单" });

    const payStatus = await queryPaymentStatus(order.paymentOrderNo);

    if (payStatus.status === PAYMENT_STATUS.PAID) {
      const now = new Date();
      await db.update(ordersTable).set({
        status: "in_progress",
        paidAt: now,
        updatedAt: now,
      }).where(eq(ordersTable.id, orderId));

      await db.update(demandsTable).set({
        status: "in_progress",
        updatedAt: now,
      }).where(and(eq(demandsTable.id, order.demandId), eq(demandsTable.status, "matched")));

      await db.insert(notificationsTable).values([
        {
          userId: order.opcId,
          type: "system",
          title: "发单方已付款，订单正式开始",
          content: `订单「${order.orderNo}」的保证金已到账，订单现已正式进入执行阶段，请按时完成交付。`,
          relatedId: orderId,
          relatedType: "order",
        },
        {
          userId: order.publisherId,
          type: "system",
          title: "付款成功，订单正式开始",
          content: `订单「${order.orderNo}」付款已确认，OPC 已开始执行，请关注交付进度。`,
          relatedId: orderId,
          relatedType: "order",
        },
      ]);
    }

    return res.json({
      status: payStatus.status,
      statusName: payStatus.statusName,
      paid: payStatus.status === PAYMENT_STATUS.PAID,
      terminal: TERMINAL_STATUSES.includes(payStatus.status as 2 | 3 | 4 | 5),
      confirmed: payStatus.status === PAYMENT_STATUS.PAID,
      paidAt: payStatus.paidAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "查询失败";
    return res.status(500).json({ error: msg });
  }
});

/* ─── Publisher close a pending_payment order ─── */
router.post("/orders/:orderId/close", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const parsed = CloseOrderBody.safeParse(req.body);
    const reason = parsed.success ? (parsed.data.reason?.trim() || "发单方主动关闭") : "发单方主动关闭";

    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        publisherId: ordersTable.publisherId,
        opcId: ordersTable.opcId,
        orderNo: ordersTable.orderNo,
        demandId: ordersTable.demandId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });

    const isPublisher = order.publisherId === req.user!.id;
    const isAdmin = req.user!.role === "admin";

    if (!isPublisher && !isAdmin) {
      return res.status(403).json({ error: "无权操作" });
    }

    // Both publishers and admins may only close pending_payment orders via this endpoint
    if (order.status !== "pending_payment") {
      return res.status(400).json({ error: "只有「待付款」状态的订单才能关闭" });
    }

    const now = new Date();
    const [updated] = await db
      .update(ordersTable)
      .set({ status: "closed", updatedAt: now })
      .where(eq(ordersTable.id, orderId))
      .returning();

    // Re-open demand back to published if it was matched
    const [demand] = await db
      .select({ status: demandsTable.status })
      .from(demandsTable)
      .where(eq(demandsTable.id, order.demandId))
      .limit(1);

    if (demand?.status === "matched") {
      await db.update(demandsTable).set({ status: "published", updatedAt: now })
        .where(eq(demandsTable.id, order.demandId));
    }

    await db.insert(notificationsTable).values([
      {
        userId: order.opcId,
        type: "system",
        title: "订单已关闭",
        content: `订单「${order.orderNo}」已被关闭。原因：${reason}`,
        relatedId: orderId,
        relatedType: "order",
      },
      {
        userId: order.publisherId,
        type: "system",
        title: "订单已关闭",
        content: `订单「${order.orderNo}」已关闭。原因：${reason}`,
        relatedId: orderId,
        relatedType: "order",
      },
    ]);

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "POST /orders/:orderId/close error");
    return res.status(500).json({ error: "关闭订单失败" });
  }
});

/* ─── OPC credit transaction history ────────────── */
router.get("/credit-transactions/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const p = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize) || 20));
    const offset = (p - 1) * ps;

    const rows = (await db.execute(sql`
      SELECT id, delta, balance_after, action_type, ref_id, note, created_at
      FROM credit_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${ps} OFFSET ${offset}
    `)).rows;

    const [{ total }] = (await db.execute(sql`
      SELECT COUNT(*) AS total FROM credit_transactions WHERE user_id = ${userId}
    `)).rows as Array<{ total: string }>;

    return res.json({ data: rows, total: Number(total), page: p, pageSize: ps });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取积分流水失败" });
  }
});

router.post("/orders/:orderId/opc-review", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const { rating, comment } = req.body as { rating?: unknown; comment?: string };
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be 1-5" });
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "completed") return res.status(400).json({ error: "Order not completed" });
    if (order.opcRating) return res.status(400).json({ error: "OPC review already submitted" });

    const [updated] = await db.update(ordersTable).set({
      opcRating: rating as number,
      opcReviewComment: comment ?? null,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId)).returning();

    return res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to submit OPC review" });
  }
});

export default router;
