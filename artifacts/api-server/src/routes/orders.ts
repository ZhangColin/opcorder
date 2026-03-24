import { Router, type IRouter } from "express";
import { db, ordersTable, demandsTable, usersTable, deliverablesTable, opcProfilesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import {
  ListOrdersQueryParams,
  SubmitDeliverableBody,
  AcceptOrderBody,
  RejectDeliveryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/orders", async (req, res) => {
  try {
    const params = ListOrdersQueryParams.parse(req.query);
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (params.status) conditions.push(eq(ordersTable.status, params.status as any));

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

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

router.get("/orders/:orderId", async (req, res) => {
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

    const deliverables = await db.select().from(deliverablesTable).where(eq(deliverablesTable.orderId, orderId));
    const [opcUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.opcId));
    const [pubUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, order.publisherId));

    res.json({
      ...order,
      opcNickname: opcUser?.nickname,
      publisherName: pubUser?.nickname,
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

router.post("/orders/:orderId/deliverables", async (req, res) => {
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

router.post("/orders/:orderId/accept", async (req, res) => {
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

router.post("/orders/:orderId/reject", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const body = RejectDeliveryBody.parse(req.body);

    const [updated] = await db.update(ordersTable).set({
      status: "in_progress",
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, orderId)).returning();

    await db.update(deliverablesTable).set({
      status: "rejected",
      feedback: body.reason,
    }).where(eq(deliverablesTable.orderId, orderId));

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject delivery" });
  }
});

export default router;
