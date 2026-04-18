import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, ordersTable, demandsTable, usersTable, deliverablesTable, opcProfilesTable, notificationsTable, publisherProfilesTable } from "@workspace/db";
import { eq, desc, count, sql, and } from "drizzle-orm";

type OrderStatus = "in_progress" | "pending_acceptance" | "completed" | "closed" | "disputed";

import {
  ListOrdersQueryParams,
  SubmitDeliverableBody,
  AcceptOrderBody,
  RejectDeliveryBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

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

    const deliverables = await db.select().from(deliverablesTable).where(eq(deliverablesTable.orderId, orderId));
    const [opcUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.opcId));
    const [pubUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.publisherId));
    const [pubProfile] = await db.select({
      companyLogo: publisherProfilesTable.companyLogo,
      companyDesc: publisherProfilesTable.companyDesc,
      industry: publisherProfilesTable.industry,
      location: publisherProfilesTable.location,
      teamSize: publisherProfilesTable.teamSize,
      foundedYear: publisherProfilesTable.foundedYear,
      website: publisherProfilesTable.website,
      contactEmail: publisherProfilesTable.contactEmail,
    }).from(publisherProfilesTable).where(eq(publisherProfilesTable.userId, order.publisherId));

    return res.json({
      ...order,
      opcNickname: opcUser?.nickname,
      publisherName: pubUser?.nickname,
      publisherLogo: pubProfile?.companyLogo ?? null,
      publisherProfile: pubProfile ?? null,
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

    const [deliverable] = await db.insert(deliverablesTable).values({
      orderId,
      milestoneId: body.milestoneId,
      title: body.title,
      description: body.description,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      status: "submitted",
    }).returning();

    // Load the order to check whether it has milestones (not derived from the request body,
    // which is an untrusted signal for this invariant).
    const [ord] = await db
      .select({ milestones: ordersTable.milestones })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));

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
      return res.status(400).json({ error: "该里程碑没有待审核的交付物" });
    }

    // Mark the deliverable as approved
    await db.update(deliverablesTable).set({
      status: "approved",
    }).where(eq(deliverablesTable.id, submittedDeliv.id));

    // Update the milestone JSONB status to 'approved' (and optionally rating/comment)
    await db.execute(
      sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},status}'`)}, '"approved"'::jsonb), updated_at = NOW() WHERE id = ${orderId}`
    );
    if (body.rating) {
      await db.execute(
        sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},rating}'`)}, to_jsonb(${body.rating})) WHERE id = ${orderId}`
      );
    }
    if (body.comment) {
      await db.execute(
        sql`UPDATE orders SET milestones = jsonb_set(milestones::jsonb, ${sql.raw(`'{${milestoneIdx},comment}'`)}, to_jsonb(${body.comment})) WHERE id = ${orderId}`
      );
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
