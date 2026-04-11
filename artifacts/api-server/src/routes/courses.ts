import { Router, type IRouter } from "express";
import { db, coursesTable, enrollmentsTable, learningResourcesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { ListCoursesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { createPaymentOrder, queryPaymentStatus, PAYMENT_STATUS, TERMINAL_STATUSES } from "../lib/payment";

const router: IRouter = Router();

const NOTIFY_URL = "https://www.opcorder.com/api/payment/callback";

function formatCourse(c: typeof coursesTable.$inferSelect) {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    requiredLevel: c.requiredLevel,
    durationMinutes: c.durationMinutes,
    description: c.description,
    badge: c.badge,
    rating: c.rating,
    learnersCount: c.learnersCount,
    isRequired: c.isRequired,
    status: c.status,
    price: c.price,
    syllabusUrl: c.syllabusUrl,
    instructor: c.instructor,
    maxEnrollments: c.maxEnrollments,
    createdAt: c.createdAt.toISOString(),
  };
}

function formatEnrollment(e: typeof enrollmentsTable.$inferSelect, course?: typeof coursesTable.$inferSelect | null) {
  return {
    id: e.id,
    courseId: e.courseId,
    userId: e.userId,
    progressPct: e.progressPct,
    completedAt: e.completedAt?.toISOString() ?? null,
    paymentStatus: e.paymentStatus,
    paymentOrderNo: e.paymentOrderNo ?? null,
    certIssued: e.certIssued,
    certIssuedAt: e.certIssuedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    ...(course ? { course: formatCourse(course) } : {}),
  };
}

/* Public — course catalog visible without login */
router.get("/courses", async (req, res) => {
  try {
    const params = ListCoursesQueryParams.parse(req.query);
    const conditions = [];

    if (params.category) conditions.push(eq(coursesTable.category, params.category as "tech" | "strategy" | "compliance" | "operations"));
    if (params.requiredLevel) conditions.push(eq(coursesTable.requiredLevel, params.requiredLevel as "C" | "B" | "A"));

    const onlyPublished = eq(coursesTable.status, "published");
    const allConditions = conditions.length > 0
      ? and(onlyPublished, ...conditions)
      : onlyPublished;

    const courses = await db.select().from(coursesTable).where(allConditions);
    res.json(courses.map(formatCourse));
  } catch {
    res.status(500).json({ error: "Failed to list courses" });
  }
});

router.get("/courses/my-enrollments", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({ enrollment: enrollmentsTable, course: coursesTable })
      .from(enrollmentsTable)
      .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .where(eq(enrollmentsTable.userId, userId));

    // Fallback: for any pending enrollment with a paymentOrderNo, query the
    // payment service in the background and update DB if already paid.
    // This covers cases where the callback never arrived or the user closed
    // the payment modal before confirmation came through.
    const pendingRows = rows.filter(
      ({ enrollment }) =>
        enrollment.paymentStatus === "pending" && enrollment.paymentOrderNo,
    );
    if (pendingRows.length > 0) {
      await Promise.allSettled(
        pendingRows.map(async ({ enrollment }) => {
          try {
            const order = await queryPaymentStatus(enrollment.paymentOrderNo!);
            if (order.status === PAYMENT_STATUS.PAID) {
              await db
                .update(enrollmentsTable)
                .set({ paymentStatus: "paid" })
                .where(eq(enrollmentsTable.id, enrollment.id));
              // Reflect in-memory so this request's response shows the updated status
              enrollment.paymentStatus = "paid";
            }
          } catch {
            // Non-fatal: silent — will be retried on next page load
          }
        }),
      );
    }

    res.json(rows.map(({ enrollment, course }) => formatEnrollment(enrollment, course)));
  } catch {
    res.status(500).json({ error: "Failed to get enrollments" });
  }
});

router.post("/courses/:courseId/enroll", requireAuth, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const userId = req.user!.id;

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
    if (!course) return res.status(404).json({ error: "课程不存在" });

    const existing = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)));

    if (existing.length > 0) {
      return res.json(formatEnrollment(existing[0], course));
    }

    const paymentStatus = course.price > 0 ? "pending" : "free";

    const [enrollment] = await db.insert(enrollmentsTable).values({
      courseId,
      userId,
      progressPct: 0,
      paymentStatus: paymentStatus as "free" | "pending" | "paid",
    }).returning();

    await db.update(coursesTable)
      .set({ learnersCount: sql`${coursesTable.learnersCount} + 1` })
      .where(eq(coursesTable.id, courseId));

    res.status(201).json(formatEnrollment(enrollment, course));
  } catch {
    res.status(500).json({ error: "Failed to enroll" });
  }
});

/* Create real payment order */
router.post("/courses/:courseId/pay", requireAuth, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const userId = req.user!.id;

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
    if (!course) return res.status(404).json({ error: "课程不存在" });

    const [enrollment] = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)));

    if (!enrollment) return res.status(404).json({ error: "未找到报名记录" });
    if (enrollment.paymentStatus === "paid") {
      return res.status(409).json({ error: "该课程已完成支付，无需重复支付" });
    }

    const businessOrderNo = `JDB-${enrollment.id}-${Date.now()}`;
    const amountFen = Math.round((course.price ?? 0) * 100);

    const order = await createPaymentOrder({
      businessOrderNo,
      amount: amountFen,
      subject: `课程购买-${course.title}`,
      body: course.description ?? course.title,
      businessName: "课程培训",
      notifyUrl: NOTIFY_URL,
    });

    await db.update(enrollmentsTable)
      .set({ paymentOrderNo: order.paymentOrderNo })
      .where(eq(enrollmentsTable.id, enrollment.id));

    res.json({
      qrCodeUrl: order.qrCodeUrl,
      paymentOrderNo: order.paymentOrderNo,
      amount: course.price ?? 0,
      subject: `课程购买-${course.title}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "支付创建失败";
    res.status(500).json({ error: msg });
  }
});

/* Poll payment status */
router.post("/courses/:courseId/payment-status", requireAuth, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const userId = req.user!.id;

    const [enrollment] = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)));

    if (!enrollment) return res.status(404).json({ error: "未找到报名记录" });
    if (!enrollment.paymentOrderNo) return res.status(400).json({ error: "尚未创建支付订单" });

    const order = await queryPaymentStatus(enrollment.paymentOrderNo);

    console.log(`[payment-status route] enrollmentId=${enrollment.id} status=${order.status}(${order.statusName}) paidAt=${order.paidAt}`);

    if (order.status === PAYMENT_STATUS.PAID) {
      await db.update(enrollmentsTable)
        .set({ paymentStatus: "paid" })
        .where(eq(enrollmentsTable.id, enrollment.id));
    }

    res.json({
      status: order.status,
      statusName: order.statusName,
      paid: order.status === PAYMENT_STATUS.PAID,
      terminal: TERMINAL_STATUSES.includes(order.status),
      paidAt: order.paidAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "查询失败";
    res.status(500).json({ error: msg });
  }
});

/* Public — learning resources list */
router.get("/learning-resources", async (_req, res) => {
  try {
    const rows = await db.select().from(learningResourcesTable)
      .orderBy(learningResourcesTable.sortOrder, learningResourcesTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "获取学习资源失败" });
  }
});

export default router;
