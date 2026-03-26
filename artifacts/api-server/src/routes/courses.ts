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
    createdAt: e.createdAt.toISOString(),
    ...(course ? { course: formatCourse(course) } : {}),
  };
}

router.get("/courses", async (req, res) => {
  try {
    const params = ListCoursesQueryParams.parse(req.query);
    let query = db.select().from(coursesTable);
    const conditions = [];

    if (params.category) conditions.push(eq(coursesTable.category, params.category as "tech" | "strategy" | "compliance" | "operations"));
    if (params.requiredLevel) conditions.push(eq(coursesTable.requiredLevel, params.requiredLevel as "C" | "B" | "A"));

    const courses = conditions.length > 0
      ? await db.select().from(coursesTable).where(conditions.length === 1 ? conditions[0] : conditions[0])
      : await query;

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

    const existing = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.courseId, courseId), eq(enrollmentsTable.userId, body.userId)));

    if (existing.length > 0) {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
      return res.json(formatEnrollment(existing[0], course));
    }

    const [enrollment] = await db.insert(enrollmentsTable).values({
      courseId,
      userId: body.userId,
      progressPct: 0,
    }).returning();

    await db.update(coursesTable)
      .set({ learnersCount: sql`${coursesTable.learnersCount} + 1` })
      .where(eq(coursesTable.id, courseId));

    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId));
    res.status(201).json(formatEnrollment(enrollment, course));
  } catch {
    res.status(500).json({ error: "Failed to enroll" });
  }
});

export default router;
