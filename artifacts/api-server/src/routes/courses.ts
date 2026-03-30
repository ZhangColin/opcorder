import { Router, type IRouter } from "express";
import { db, coursesTable, enrollmentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  ListCoursesQueryParams,
  EnrollCourseBody,
  ListMyEnrollmentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
    certIssued: e.certIssued,
    certIssuedAt: e.certIssuedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    ...(course ? { course: formatCourse(course) } : {}),
  };
}

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

router.get("/courses/my-enrollments", async (req, res) => {
  try {
    const params = ListMyEnrollmentsQueryParams.parse(req.query);

    const rows = await db
      .select({ enrollment: enrollmentsTable, course: coursesTable })
      .from(enrollmentsTable)
      .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .where(eq(enrollmentsTable.userId, params.userId));

    res.json(rows.map(({ enrollment, course }) => formatEnrollment(enrollment, course)));
  } catch {
    res.status(500).json({ error: "Failed to get enrollments" });
  }
});

router.post("/courses/:courseId/enroll", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const body = EnrollCourseBody.parse(req.body);

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
    if (!course) return res.status(404).json({ error: "课程不存在" });

    const existing = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, body.userId)));

    if (existing.length > 0) {
      return res.json(formatEnrollment(existing[0], course));
    }

    const paymentStatus = course.price > 0 ? "pending" : "free";

    const [enrollment] = await db.insert(enrollmentsTable).values({
      courseId,
      userId: body.userId,
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

router.post("/courses/:courseId/pay", async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const { userId } = req.body as { userId: number };

    const [enrollment] = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, userId)));

    if (!enrollment) return res.status(404).json({ error: "未找到报名记录" });

    await db.update(enrollmentsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(enrollmentsTable.id, enrollment.id));

    res.json({ ok: true, message: "支付成功（演示模式）" });
  } catch {
    res.status(500).json({ error: "支付失败" });
  }
});

export default router;
