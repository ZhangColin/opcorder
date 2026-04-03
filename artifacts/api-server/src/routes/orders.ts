import { Router, type IRouter } from "express";
import { db, ordersTable, demandsTable, usersTable, deliverablesTable, opcProfilesTable, notificationsTable, publisherProfilesTable } from "@workspace/db";
import { eq, desc, count, sql, and } from "drizzle-orm";
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

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to list orders");
    res.status(500).json({ error: "Failed to list orders" });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
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

    res.json({
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
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.post("/orders/:orderId/deliverables", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
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

    await db.update(ordersTable).set({
      status: "pending_acceptance",
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId));

    res.status(201).json({
      ...deliverable,
      submittedAt: deliverable.submittedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit deliverable" });
  }
});

router.post("/orders/:orderId/accept", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const body = AcceptOrderBody.parse(req.body);

    const updateData: Record<string, unknown> = {
      status: "completed",
      updatedAt: new Date(),
    };
    if (body.rating) updateData.rating = body.rating;
    if (body.comment) updateData.reviewComment = body.comment;

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
    }

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept order" });
  }
});

router.post("/orders/:orderId/reject", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const body = RejectDeliveryBody.parse(req.body);

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
    const newStatus = Number(rejectionCount) >= MAX_REVISIONS ? "disputed" : "in_progress";

    const [updated] = await db.update(ordersTable).set({
      status: newStatus as any,
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

    res.json({
      ...updated,
      rejectionCount: Number(rejectionCount),
      autoDisputed: newStatus === "disputed",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject delivery" });
  }
});

router.post("/orders/:orderId/opc-review", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
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

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit OPC review" });
  }
});

export default router;
