import { Router, type IRouter } from "express";
import { db, contestsTable, contestQuestionsTable, contestTracksTable, contestRegistrationsTable, notificationsTable, opcTrackCertsTable, catCategoriesTable, usersTable } from "@workspace/db";
import { eq, desc, and, count, sql, asc, inArray, ilike, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** 把前端 datetime-local 值（北京时间，无时区后缀）解析为正确的 UTC Date */
function parseBJT(s: string): Date {
  if (!s) return new Date(NaN);
  // 已有时区信息则直接解析；否则补 +08:00（北京时间）
  return new Date(s.includes('+') || s.includes('Z') ? s : s + ':00+08:00');
}

function paginate(query: Record<string, string | string[] | undefined>, defaultSize = 20) {
  const page = Math.max(1, parseInt(String(query.page ?? 1)) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? defaultSize)) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/* ─── Admin: Contest Questions (题库) ────────────────────────────── */

router.get("/admin/contests/questions", requireAdmin, async (req, res) => {
  try {
    const { catCategoryId, keyword } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (catCategoryId) conditions.push(eq(contestQuestionsTable.catCategoryId, Number(catCategoryId)));
    if (keyword?.trim()) conditions.push(ilike(contestQuestionsTable.title, `%${keyword.trim()}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(contestQuestionsTable).where(where);

    const rows = await db
      .select({
        id: contestQuestionsTable.id,
        catCategoryId: contestQuestionsTable.catCategoryId,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        title: contestQuestionsTable.title,
        content: contestQuestionsTable.content,
        attachments: contestQuestionsTable.attachments,
        createdAt: contestQuestionsTable.createdAt,
        updatedAt: contestQuestionsTable.updatedAt,
      })
      .from(contestQuestionsTable)
      .leftJoin(catCategoriesTable, eq(contestQuestionsTable.catCategoryId, catCategoriesTable.id))
      .where(where)
      .orderBy(desc(contestQuestionsTable.createdAt))
      .limit(pageSize).offset(offset);

    return res.json({ items: rows, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err }, "[admin/contests/questions GET]");
    return res.status(500).json({ error: "获取题库列表失败" });
  }
});

router.post("/admin/contests/questions", requireAdmin, async (req, res) => {
  try {
    const { catCategoryId, title, content, attachments } = req.body as {
      catCategoryId: number; title: string; content?: string; attachments?: unknown[];
    };
    if (!catCategoryId || !title?.trim()) {
      return res.status(400).json({ error: "赛道分类和题目标题为必填项" });
    }
    const [row] = await db.insert(contestQuestionsTable).values({
      catCategoryId: Number(catCategoryId),
      title: title.trim(),
      content: content ?? "",
      attachments: attachments ?? [],
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/questions POST]");
    return res.status(500).json({ error: "创建题目失败" });
  }
});

router.get("/admin/contests/questions/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select({
        id: contestQuestionsTable.id,
        catCategoryId: contestQuestionsTable.catCategoryId,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        title: contestQuestionsTable.title,
        content: contestQuestionsTable.content,
        attachments: contestQuestionsTable.attachments,
        createdAt: contestQuestionsTable.createdAt,
        updatedAt: contestQuestionsTable.updatedAt,
      })
      .from(contestQuestionsTable)
      .leftJoin(catCategoriesTable, eq(contestQuestionsTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestQuestionsTable.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "题目不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/questions/:id GET]");
    return res.status(500).json({ error: "获取题目失败" });
  }
});

router.put("/admin/contests/questions/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { catCategoryId, title, content, attachments } = req.body as {
      catCategoryId?: number; title?: string; content?: string; attachments?: unknown[];
    };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (catCategoryId !== undefined) updates.catCategoryId = Number(catCategoryId);
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content;
    if (attachments !== undefined) updates.attachments = attachments;
    const [row] = await db.update(contestQuestionsTable).set(updates as any).where(eq(contestQuestionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "题目不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/questions/:id PUT]");
    return res.status(500).json({ error: "更新题目失败" });
  }
});

router.delete("/admin/contests/questions/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.delete(contestQuestionsTable).where(eq(contestQuestionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "题目不存在" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[admin/contests/questions/:id DELETE]");
    return res.status(500).json({ error: "删除题目失败" });
  }
});

/* ─── Admin: Contests list + create (static routes first) ────────── */

router.get("/admin/contests", requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);
    const { status } = req.query as Record<string, string>;

    const conditions = [];
    if (status) conditions.push(eq(contestsTable.status, status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(contestsTable).where(where);

    const rows = await db
      .select({
        id: contestsTable.id,
        title: contestsTable.title,
        details: contestsTable.details,
        status: contestsTable.status,
        announcementAt: contestsTable.announcementAt,
        registrationAt: contestsTable.registrationAt,
        publicAt: contestsTable.publicAt,
        benefitAt: contestsTable.benefitAt,
        deadlineAt: contestsTable.deadlineAt,
        createdAt: contestsTable.createdAt,
        updatedAt: contestsTable.updatedAt,
        trackCount: sql<number>`(SELECT COUNT(*) FROM contest_tracks WHERE contest_tracks.contest_id = contests.id)::int`,
        registrationCount: sql<number>`(SELECT COUNT(*) FROM contest_registrations WHERE contest_registrations.contest_id = contests.id)::int`,
      })
      .from(contestsTable)
      .where(where)
      .orderBy(desc(contestsTable.createdAt))
      .limit(pageSize).offset(offset);

    return res.json({ items: rows, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err }, "[admin/contests GET]");
    return res.status(500).json({ error: "获取大赛列表失败" });
  }
});

router.post("/admin/contests", requireAdmin, async (req, res) => {
  try {
    const { title, details, announcementAt, registrationAt, publicAt, benefitAt, deadlineAt, status } = req.body as {
      title: string; details?: string;
      announcementAt: string; registrationAt: string; publicAt: string; benefitAt: string; deadlineAt: string;
      status?: "draft" | "published" | "ended";
    };
    if (!title?.trim() || !announcementAt || !registrationAt || !publicAt || !benefitAt || !deadlineAt) {
      return res.status(400).json({ error: "标题和所有时间节点为必填项" });
    }
    const [row] = await db.insert(contestsTable).values({
      title: title.trim(),
      details: details ?? "",
      announcementAt: parseBJT(announcementAt),
      registrationAt: parseBJT(registrationAt),
      publicAt: parseBJT(publicAt),
      benefitAt: parseBJT(benefitAt),
      deadlineAt: parseBJT(deadlineAt),
      status: status ?? "draft",
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests POST]");
    return res.status(500).json({ error: "创建大赛失败" });
  }
});

/* ─── Admin: Registrations & Grading — BEFORE /:id routes ───────── */

router.get("/admin/contests/registrations", requireAdmin, async (req, res) => {
  try {
    const { contestId, trackId, status, userId } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (contestId) conditions.push(eq(contestRegistrationsTable.contestId, Number(contestId)));
    if (trackId) conditions.push(eq(contestRegistrationsTable.trackId, Number(trackId)));
    if (status) conditions.push(eq(contestRegistrationsTable.status, status as any));
    if (userId) conditions.push(eq(contestRegistrationsTable.userId, Number(userId)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(contestRegistrationsTable).where(where);

    const rows = await db
      .select({
        id: contestRegistrationsTable.id,
        contestId: contestRegistrationsTable.contestId,
        trackId: contestRegistrationsTable.trackId,
        userId: contestRegistrationsTable.userId,
        status: contestRegistrationsTable.status,
        testSubmittedAt: contestRegistrationsTable.testSubmittedAt,
        testContent: contestRegistrationsTable.testContent,
        testAttachments: contestRegistrationsTable.testAttachments,
        testUrls: contestRegistrationsTable.testUrls,
        testGrade: contestRegistrationsTable.testGrade,
        assignmentSubmittedAt: contestRegistrationsTable.assignmentSubmittedAt,
        assignmentContent: contestRegistrationsTable.assignmentContent,
        assignmentAttachments: contestRegistrationsTable.assignmentAttachments,
        assignmentUrls: contestRegistrationsTable.assignmentUrls,
        assignmentGrade: contestRegistrationsTable.assignmentGrade,
        gradeNote: contestRegistrationsTable.gradeNote,
        createdAt: contestRegistrationsTable.createdAt,
        updatedAt: contestRegistrationsTable.updatedAt,
        userNickname: usersTable.nickname,
        userPhone: usersTable.phone,
        contestTitle: contestsTable.title,
        contestPublicAt: contestsTable.publicAt,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
      })
      .from(contestRegistrationsTable)
      .leftJoin(usersTable, eq(contestRegistrationsTable.userId, usersTable.id))
      .leftJoin(contestsTable, eq(contestRegistrationsTable.contestId, contestsTable.id))
      .leftJoin(contestTracksTable, eq(contestRegistrationsTable.trackId, contestTracksTable.id))
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(where)
      .orderBy(desc(contestRegistrationsTable.createdAt))
      .limit(pageSize).offset(offset);

    const now = new Date();
    const items = rows.map(r => {
      const publicAt = r.contestPublicAt ? new Date(r.contestPublicAt) : null;
      const daysToPublic = publicAt ? Math.ceil((publicAt.getTime() - now.getTime()) / 86400000) : null;
      return { ...r, daysToPublic };
    });

    return res.json({ items, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err }, "[admin/contests/registrations GET]");
    return res.status(500).json({ error: "获取报名列表失败" });
  }
});

router.get("/admin/contests/registrations/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [reg] = await db
      .select({
        id: contestRegistrationsTable.id,
        contestId: contestRegistrationsTable.contestId,
        trackId: contestRegistrationsTable.trackId,
        userId: contestRegistrationsTable.userId,
        status: contestRegistrationsTable.status,
        testSubmittedAt: contestRegistrationsTable.testSubmittedAt,
        testContent: contestRegistrationsTable.testContent,
        testAttachments: contestRegistrationsTable.testAttachments,
        testUrls: contestRegistrationsTable.testUrls,
        testGrade: contestRegistrationsTable.testGrade,
        assignmentSubmittedAt: contestRegistrationsTable.assignmentSubmittedAt,
        assignmentContent: contestRegistrationsTable.assignmentContent,
        assignmentAttachments: contestRegistrationsTable.assignmentAttachments,
        assignmentUrls: contestRegistrationsTable.assignmentUrls,
        assignmentGrade: contestRegistrationsTable.assignmentGrade,
        gradeNote: contestRegistrationsTable.gradeNote,
        createdAt: contestRegistrationsTable.createdAt,
        updatedAt: contestRegistrationsTable.updatedAt,
        userNickname: usersTable.nickname,
        userPhone: usersTable.phone,
        userEmail: usersTable.email,
      })
      .from(contestRegistrationsTable)
      .leftJoin(usersTable, eq(contestRegistrationsTable.userId, usersTable.id))
      .where(eq(contestRegistrationsTable.id, id))
      .limit(1);

    if (!reg) return res.status(404).json({ error: "报名记录不存在" });

    const [track] = await db
      .select({
        id: contestTracksTable.id,
        catCategoryId: contestTracksTable.catCategoryId,
        catName: catCategoriesTable.name,
        testQuestionId: contestTracksTable.testQuestionId,
        aQuestionId: contestTracksTable.aQuestionId,
        bQuestionId: contestTracksTable.bQuestionId,
        cQuestionId: contestTracksTable.cQuestionId,
        testDurationHours: contestTracksTable.testDurationHours,
        aDurationHours: contestTracksTable.aDurationHours,
        bDurationHours: contestTracksTable.bDurationHours,
        cDurationHours: contestTracksTable.cDurationHours,
      })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.id, reg.trackId))
      .limit(1);

    const questionIds = [
      track?.testQuestionId,
      track?.aQuestionId,
      track?.bQuestionId,
      track?.cQuestionId,
    ].filter((x): x is number => x != null);

    const questions = questionIds.length > 0
      ? await db.select().from(contestQuestionsTable).where(inArray(contestQuestionsTable.id, questionIds))
      : [];

    const questionMap = Object.fromEntries(questions.map(q => [q.id, q]));

    return res.json({
      ...reg,
      track: track ? {
        ...track,
        testQuestion: track.testQuestionId ? questionMap[track.testQuestionId] : null,
        aQuestion: track.aQuestionId ? questionMap[track.aQuestionId] : null,
        bQuestion: track.bQuestionId ? questionMap[track.bQuestionId] : null,
        cQuestion: track.cQuestionId ? questionMap[track.cQuestionId] : null,
      } : null,
    });
  } catch (err) {
    logger.error({ err }, "[admin/contests/registrations/:id GET]");
    return res.status(500).json({ error: "获取报名详情失败" });
  }
});

router.post("/admin/contests/registrations/:id/grade-test", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { grade, note } = req.body as { grade: "A" | "B" | "C" | "fail"; note?: string };
    if (!["A", "B", "C", "fail"].includes(grade)) {
      return res.status(400).json({ error: "评级必须为 A / B / C / fail" });
    }

    const [reg] = await db.select().from(contestRegistrationsTable).where(eq(contestRegistrationsTable.id, id)).limit(1);
    if (!reg) return res.status(404).json({ error: "报名记录不存在" });
    if (!reg.testSubmittedAt) return res.status(400).json({ error: "测试题尚未提交，不可评级" });

    const passed = grade !== "fail";
    const newStatus = passed ? "test_passed" : "test_failed";

    const [updated] = await db.update(contestRegistrationsTable)
      .set({
        testGrade: grade,
        status: newStatus as any,
        gradeNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contestRegistrationsTable.id, id))
      .returning();

    const [contest] = await db.select({ title: contestsTable.title }).from(contestsTable)
      .where(eq(contestsTable.id, reg.contestId)).limit(1);
    const [trackRow] = await db
      .select({ catName: catCategoriesTable.name })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.id, reg.trackId)).limit(1);

    const gradeLabel = grade === "fail" ? "未通过" : `${grade} 级`;
    const resultText = passed ? `恭喜您通过测试题考核，等级评定为 ${grade} 级！` : "很遗憾，您本次测试题考核未通过。";

    await db.insert(notificationsTable).values({
      userId: reg.userId,
      type: "contest_test_graded",
      title: `【${contest?.title ?? "OPC 大赛"}】测试题评级结果：${gradeLabel}`,
      content: `您在「${contest?.title ?? "OPC 大赛"}」${trackRow?.catName ?? ""}赛道的测试题已完成评审。\n${resultText}${note ? `\n运营备注：${note}` : ""}\n\n请前往个人中心「我的大赛」查看详情。`,
      relatedId: id,
      relatedType: "contest_registration",
    });

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "[admin/contests/registrations/:id/grade-test POST]");
    return res.status(500).json({ error: "评级操作失败" });
  }
});

router.post("/admin/contests/registrations/:id/grade-assignment", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { grade, note } = req.body as { grade: "A" | "B" | "C" | "fail"; note?: string };
    if (!["A", "B", "C", "fail"].includes(grade)) {
      return res.status(400).json({ error: "评级必须为 A / B / C / fail" });
    }

    const [reg] = await db.select().from(contestRegistrationsTable).where(eq(contestRegistrationsTable.id, id)).limit(1);
    if (!reg) return res.status(404).json({ error: "报名记录不存在" });
    if (!reg.assignmentSubmittedAt) return res.status(400).json({ error: "测试单尚未提交，不可评级" });

    const passed = grade !== "fail";
    const newStatus = passed ? "assignment_passed" : "assignment_failed";

    const [updated] = await db.update(contestRegistrationsTable)
      .set({
        assignmentGrade: grade,
        status: newStatus as any,
        gradeNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contestRegistrationsTable.id, id))
      .returning();

    if (passed) {
      const [track] = await db.select({ catCategoryId: contestTracksTable.catCategoryId })
        .from(contestTracksTable).where(eq(contestTracksTable.id, reg.trackId)).limit(1);
      if (track) {
        await db.execute(sql`
          INSERT INTO opc_track_certs (user_id, cat_category_id, level, status, certified_at, created_at)
          VALUES (${reg.userId}, ${track.catCategoryId}, ${grade}, 'active', now(), now())
          ON CONFLICT (user_id, cat_category_id)
          DO UPDATE SET level = ${grade}, certified_at = now()
        `);
      }
    }

    const [contest] = await db.select({ title: contestsTable.title }).from(contestsTable)
      .where(eq(contestsTable.id, reg.contestId)).limit(1);
    const [trackRow] = await db
      .select({ catName: catCategoriesTable.name })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.id, reg.trackId)).limit(1);

    const gradeLabel = grade === "fail" ? "未通过" : `${grade} 级`;
    const resultText = passed
      ? `恭喜您通过测试单考核，等级评定为 ${grade} 级！您在${trackRow?.catName ?? ""}赛道的认证等级已更新为 ${grade} 级。`
      : "很遗憾，您本次测试单考核未通过。";

    await db.insert(notificationsTable).values({
      userId: reg.userId,
      type: "contest_assignment_graded",
      title: `【${contest?.title ?? "OPC 大赛"}】测试单评级结果：${gradeLabel}`,
      content: `您在「${contest?.title ?? "OPC 大赛"}」${trackRow?.catName ?? ""}赛道的测试单已完成评审。\n${resultText}${note ? `\n运营备注：${note}` : ""}\n\n请前往个人中心「我的大赛」查看详情。`,
      relatedId: id,
      relatedType: "contest_registration",
    });

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "[admin/contests/registrations/:id/grade-assignment POST]");
    return res.status(500).json({ error: "评级操作失败" });
  }
});

/* ─── Admin: Contest detail/update/delete (parameterized) ────────── */

router.get("/admin/contests/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [contest] = await db.select().from(contestsTable).where(eq(contestsTable.id, id)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });

    const tracks = await db
      .select({
        id: contestTracksTable.id,
        contestId: contestTracksTable.contestId,
        catCategoryId: contestTracksTable.catCategoryId,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        testQuestionId: contestTracksTable.testQuestionId,
        aQuestionId: contestTracksTable.aQuestionId,
        bQuestionId: contestTracksTable.bQuestionId,
        cQuestionId: contestTracksTable.cQuestionId,
        testDurationHours: contestTracksTable.testDurationHours,
        aDurationHours: contestTracksTable.aDurationHours,
        bDurationHours: contestTracksTable.bDurationHours,
        cDurationHours: contestTracksTable.cDurationHours,
        quotaTotal: contestTracksTable.quotaTotal,
        quotaUsed: contestTracksTable.quotaUsed,
      })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.contestId, id))
      .orderBy(asc(contestTracksTable.id));

    return res.json({ ...contest, tracks });
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id GET]");
    return res.status(500).json({ error: "获取大赛详情失败" });
  }
});

router.put("/admin/contests/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, details, announcementAt, registrationAt, publicAt, benefitAt, deadlineAt, status } = req.body as {
      title?: string; details?: string;
      announcementAt?: string; registrationAt?: string; publicAt?: string; benefitAt?: string; deadlineAt?: string;
      status?: "draft" | "published" | "ended";
    };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (details !== undefined) updates.details = details;
    if (announcementAt !== undefined) updates.announcementAt = parseBJT(announcementAt);
    if (registrationAt !== undefined) updates.registrationAt = parseBJT(registrationAt);
    if (publicAt !== undefined) updates.publicAt = parseBJT(publicAt);
    if (benefitAt !== undefined) updates.benefitAt = parseBJT(benefitAt);
    if (deadlineAt !== undefined) updates.deadlineAt = parseBJT(deadlineAt);
    if (status !== undefined) updates.status = status;

    const [row] = await db.update(contestsTable).set(updates as any).where(eq(contestsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "大赛不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id PUT]");
    return res.status(500).json({ error: "更新大赛失败" });
  }
});

router.delete("/admin/contests/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [contest] = await db.select({ status: contestsTable.status }).from(contestsTable).where(eq(contestsTable.id, id)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });
    if (contest.status !== "draft") return res.status(400).json({ error: "仅草稿状态的大赛可以删除" });
    await db.delete(contestsTable).where(eq(contestsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id DELETE]");
    return res.status(500).json({ error: "删除大赛失败" });
  }
});

/* ─── Admin: Contest Tracks (赛道配置) ──────────────────────────── */

router.get("/admin/contests/:id/tracks", requireAdmin, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const tracks = await db
      .select({
        id: contestTracksTable.id,
        contestId: contestTracksTable.contestId,
        catCategoryId: contestTracksTable.catCategoryId,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        testQuestionId: contestTracksTable.testQuestionId,
        aQuestionId: contestTracksTable.aQuestionId,
        bQuestionId: contestTracksTable.bQuestionId,
        cQuestionId: contestTracksTable.cQuestionId,
        testDurationHours: contestTracksTable.testDurationHours,
        aDurationHours: contestTracksTable.aDurationHours,
        bDurationHours: contestTracksTable.bDurationHours,
        cDurationHours: contestTracksTable.cDurationHours,
        quotaTotal: contestTracksTable.quotaTotal,
        quotaUsed: contestTracksTable.quotaUsed,
      })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.contestId, contestId))
      .orderBy(asc(contestTracksTable.id));
    return res.json(tracks);
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id/tracks GET]");
    return res.status(500).json({ error: "获取赛道配置失败" });
  }
});

router.post("/admin/contests/:id/tracks", requireAdmin, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const [contest] = await db.select({ id: contestsTable.id }).from(contestsTable).where(eq(contestsTable.id, contestId)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });

    const {
      catCategoryId, testQuestionId, aQuestionId, bQuestionId, cQuestionId,
      testDurationHours, aDurationHours, bDurationHours, cDurationHours, quotaTotal,
    } = req.body as {
      catCategoryId: number;
      testQuestionId?: number; aQuestionId?: number; bQuestionId?: number; cQuestionId?: number;
      testDurationHours?: number; aDurationHours?: number; bDurationHours?: number; cDurationHours?: number;
      quotaTotal?: number;
    };
    if (!catCategoryId) return res.status(400).json({ error: "赛道分类为必填项" });

    const [row] = await db.insert(contestTracksTable).values({
      contestId,
      catCategoryId: Number(catCategoryId),
      testQuestionId: testQuestionId ?? null,
      aQuestionId: aQuestionId ?? null,
      bQuestionId: bQuestionId ?? null,
      cQuestionId: cQuestionId ?? null,
      testDurationHours: testDurationHours ?? 72,
      aDurationHours: aDurationHours ?? 72,
      bDurationHours: bDurationHours ?? 72,
      cDurationHours: cDurationHours ?? 72,
      quotaTotal: quotaTotal ?? 0,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id/tracks POST]");
    return res.status(500).json({ error: "创建赛道配置失败" });
  }
});

router.put("/admin/contests/:id/tracks/:trackId", requireAdmin, async (req, res) => {
  try {
    const trackId = Number(req.params.trackId);
    const {
      catCategoryId, testQuestionId, aQuestionId, bQuestionId, cQuestionId,
      testDurationHours, aDurationHours, bDurationHours, cDurationHours, quotaTotal,
    } = req.body as Record<string, number | undefined>;

    const updates: Record<string, unknown> = {};
    if (catCategoryId !== undefined) updates.catCategoryId = Number(catCategoryId);
    if (testQuestionId !== undefined) updates.testQuestionId = testQuestionId === 0 ? null : Number(testQuestionId);
    if (aQuestionId !== undefined) updates.aQuestionId = aQuestionId === 0 ? null : Number(aQuestionId);
    if (bQuestionId !== undefined) updates.bQuestionId = bQuestionId === 0 ? null : Number(bQuestionId);
    if (cQuestionId !== undefined) updates.cQuestionId = cQuestionId === 0 ? null : Number(cQuestionId);
    if (testDurationHours !== undefined) updates.testDurationHours = Number(testDurationHours);
    if (aDurationHours !== undefined) updates.aDurationHours = Number(aDurationHours);
    if (bDurationHours !== undefined) updates.bDurationHours = Number(bDurationHours);
    if (cDurationHours !== undefined) updates.cDurationHours = Number(cDurationHours);
    if (quotaTotal !== undefined) updates.quotaTotal = Number(quotaTotal);

    const [row] = await db.update(contestTracksTable).set(updates as any).where(eq(contestTracksTable.id, trackId)).returning();
    if (!row) return res.status(404).json({ error: "赛道配置不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id/tracks/:trackId PUT]");
    return res.status(500).json({ error: "更新赛道配置失败" });
  }
});

router.delete("/admin/contests/:id/tracks/:trackId", requireAdmin, async (req, res) => {
  try {
    const trackId = Number(req.params.trackId);
    const [existing] = await db.select({ quotaUsed: contestTracksTable.quotaUsed })
      .from(contestTracksTable).where(eq(contestTracksTable.id, trackId)).limit(1);
    if (!existing) return res.status(404).json({ error: "赛道配置不存在" });
    if (existing.quotaUsed > 0) return res.status(400).json({ error: "该赛道已有报名，不可删除" });
    await db.delete(contestTracksTable).where(eq(contestTracksTable.id, trackId));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[admin/contests/:id/tracks/:trackId DELETE]");
    return res.status(500).json({ error: "删除赛道配置失败" });
  }
});

/* ─── OPC: My Contests — BEFORE /contests/:id ───────────────────── */

router.get("/contests/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const [{ total }] = await db.select({ total: count() })
      .from(contestRegistrationsTable).where(eq(contestRegistrationsTable.userId, userId));

    const rows = await db
      .select({
        id: contestRegistrationsTable.id,
        contestId: contestRegistrationsTable.contestId,
        trackId: contestRegistrationsTable.trackId,
        status: contestRegistrationsTable.status,
        testGrade: contestRegistrationsTable.testGrade,
        assignmentGrade: contestRegistrationsTable.assignmentGrade,
        testSubmittedAt: contestRegistrationsTable.testSubmittedAt,
        assignmentSubmittedAt: contestRegistrationsTable.assignmentSubmittedAt,
        createdAt: contestRegistrationsTable.createdAt,
        contestTitle: contestsTable.title,
        contestBenefitAt: contestsTable.benefitAt,
        contestDeadlineAt: contestsTable.deadlineAt,
        contestRegistrationAt: contestsTable.registrationAt,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        testDurationHours: contestTracksTable.testDurationHours,
        aDurationHours: contestTracksTable.aDurationHours,
        bDurationHours: contestTracksTable.bDurationHours,
        cDurationHours: contestTracksTable.cDurationHours,
      })
      .from(contestRegistrationsTable)
      .leftJoin(contestsTable, eq(contestRegistrationsTable.contestId, contestsTable.id))
      .leftJoin(contestTracksTable, eq(contestRegistrationsTable.trackId, contestTracksTable.id))
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestRegistrationsTable.userId, userId))
      .orderBy(desc(contestRegistrationsTable.createdAt))
      .limit(pageSize).offset(offset);

    return res.json({ items: rows, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err }, "[contests/my GET]");
    return res.status(500).json({ error: "获取报名记录失败" });
  }
});

router.get("/contests/my/:registrationId", requireAuth, async (req, res) => {
  try {
    const registrationId = Number(req.params.registrationId);
    const userId = req.user!.id;

    const [reg] = await db
      .select({
        id: contestRegistrationsTable.id,
        contestId: contestRegistrationsTable.contestId,
        trackId: contestRegistrationsTable.trackId,
        userId: contestRegistrationsTable.userId,
        status: contestRegistrationsTable.status,
        testSubmittedAt: contestRegistrationsTable.testSubmittedAt,
        testContent: contestRegistrationsTable.testContent,
        testAttachments: contestRegistrationsTable.testAttachments,
        testUrls: contestRegistrationsTable.testUrls,
        testGrade: contestRegistrationsTable.testGrade,
        assignmentSubmittedAt: contestRegistrationsTable.assignmentSubmittedAt,
        assignmentContent: contestRegistrationsTable.assignmentContent,
        assignmentAttachments: contestRegistrationsTable.assignmentAttachments,
        assignmentUrls: contestRegistrationsTable.assignmentUrls,
        assignmentGrade: contestRegistrationsTable.assignmentGrade,
        createdAt: contestRegistrationsTable.createdAt,
        contestTitle: contestsTable.title,
        contestRegistrationAt: contestsTable.registrationAt,
        contestPublicAt: contestsTable.publicAt,
        contestBenefitAt: contestsTable.benefitAt,
        contestDeadlineAt: contestsTable.deadlineAt,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        trackTestQuestionId: contestTracksTable.testQuestionId,
        trackAQuestionId: contestTracksTable.aQuestionId,
        trackBQuestionId: contestTracksTable.bQuestionId,
        trackCQuestionId: contestTracksTable.cQuestionId,
        testDurationHours: contestTracksTable.testDurationHours,
        aDurationHours: contestTracksTable.aDurationHours,
        bDurationHours: contestTracksTable.bDurationHours,
        cDurationHours: contestTracksTable.cDurationHours,
      })
      .from(contestRegistrationsTable)
      .leftJoin(contestsTable, eq(contestRegistrationsTable.contestId, contestsTable.id))
      .leftJoin(contestTracksTable, eq(contestRegistrationsTable.trackId, contestTracksTable.id))
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestRegistrationsTable.id, registrationId))
      .limit(1);

    if (!reg) return res.status(404).json({ error: "报名记录不存在" });
    if (reg.userId !== userId) return res.status(403).json({ error: "无权查看" });

    const questionIds = [
      reg.trackTestQuestionId,
      reg.trackAQuestionId,
      reg.trackBQuestionId,
      reg.trackCQuestionId,
    ].filter((x): x is number => x != null);

    const questions = questionIds.length > 0
      ? await db.select().from(contestQuestionsTable).where(inArray(contestQuestionsTable.id, questionIds))
      : [];

    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

    return res.json({
      ...reg,
      testQuestion: reg.trackTestQuestionId ? qMap[reg.trackTestQuestionId] : null,
      assignmentQuestion: reg.testGrade && reg.testGrade !== "fail"
        ? (reg.testGrade === "A" ? (reg.trackAQuestionId ? qMap[reg.trackAQuestionId] : null)
          : reg.testGrade === "B" ? (reg.trackBQuestionId ? qMap[reg.trackBQuestionId] : null)
            : (reg.trackCQuestionId ? qMap[reg.trackCQuestionId] : null))
        : null,
    });
  } catch (err) {
    logger.error({ err }, "[contests/my/:registrationId GET]");
    return res.status(500).json({ error: "获取报名详情失败" });
  }
});

/* ─── OPC: Submit test/assignment — BEFORE /contests/:id ────────── */

router.put("/contests/registrations/:id/test", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const [reg] = await db.select().from(contestRegistrationsTable).where(eq(contestRegistrationsTable.id, id)).limit(1);
    if (!reg) return res.status(404).json({ error: "报名记录不存在" });
    if (reg.userId !== userId) return res.status(403).json({ error: "无权操作" });
    if (reg.testSubmittedAt) return res.status(400).json({ error: "测试题已提交，不可重复提交" });
    if (reg.status !== "registered") return res.status(400).json({ error: "当前状态不允许提交" });

    const [track] = await db.select({ testDurationHours: contestTracksTable.testDurationHours })
      .from(contestTracksTable).where(eq(contestTracksTable.id, reg.trackId)).limit(1);

    if (track) {
      const deadline = new Date(reg.createdAt.getTime() + track.testDurationHours * 3600 * 1000);
      if (new Date() > deadline) return res.status(400).json({ error: "测试题提交已超时" });
    }

    const { content, attachments, urls } = req.body as {
      content?: string; attachments?: unknown[]; urls?: string[];
    };

    const [updated] = await db.update(contestRegistrationsTable)
      .set({
        testContent: content ?? "",
        testAttachments: attachments ?? [],
        testUrls: urls ?? [],
        testSubmittedAt: new Date(),
        status: "test_submitted",
        updatedAt: new Date(),
      })
      .where(eq(contestRegistrationsTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "[contests/registrations/:id/test PUT]");
    return res.status(500).json({ error: "提交测试题失败" });
  }
});

router.put("/contests/registrations/:id/assignment", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const [reg] = await db.select().from(contestRegistrationsTable).where(eq(contestRegistrationsTable.id, id)).limit(1);
    if (!reg) return res.status(404).json({ error: "报名记录不存在" });
    if (reg.userId !== userId) return res.status(403).json({ error: "无权操作" });
    if (reg.assignmentSubmittedAt) return res.status(400).json({ error: "测试单已提交，不可重复提交" });
    if (reg.status !== "test_passed") return res.status(400).json({ error: "测试题未通过，不可提交测试单" });

    const [contest] = await db.select({ benefitAt: contestsTable.benefitAt })
      .from(contestsTable).where(eq(contestsTable.id, reg.contestId)).limit(1);
    const [track] = await db.select({
      aDurationHours: contestTracksTable.aDurationHours,
      bDurationHours: contestTracksTable.bDurationHours,
      cDurationHours: contestTracksTable.cDurationHours,
    }).from(contestTracksTable).where(eq(contestTracksTable.id, reg.trackId)).limit(1);

    if (!contest || !track) return res.status(404).json({ error: "大赛或赛道不存在" });

    const now = new Date();
    if (now < contest.benefitAt) return res.status(400).json({ error: "权益发放时间未到，暂不可提交测试单" });

    const durationHours = reg.testGrade === "A"
      ? track.aDurationHours
      : reg.testGrade === "B"
        ? track.bDurationHours
        : track.cDurationHours;
    const deadline = new Date(contest.benefitAt.getTime() + durationHours * 3600 * 1000);
    if (now > deadline) return res.status(400).json({ error: "测试单提交已超时" });

    const { content, attachments, urls } = req.body as {
      content?: string; attachments?: unknown[]; urls?: string[];
    };

    const [updated] = await db.update(contestRegistrationsTable)
      .set({
        assignmentContent: content ?? "",
        assignmentAttachments: attachments ?? [],
        assignmentUrls: urls ?? [],
        assignmentSubmittedAt: new Date(),
        status: "assignment_submitted",
        updatedAt: new Date(),
      })
      .where(eq(contestRegistrationsTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "[contests/registrations/:id/assignment PUT]");
    return res.status(500).json({ error: "提交测试单失败" });
  }
});

/* ─── Public: Contest Detail (无需登录) ─────────────────────────── */

/* ─── Public: Contest list (published + past announcement) ─── */
router.get("/contests", async (req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: contestsTable.id,
        title: contestsTable.title,
        status: contestsTable.status,
        announcementAt: contestsTable.announcementAt,
        registrationAt: contestsTable.registrationAt,
        publicAt: contestsTable.publicAt,
        benefitAt: contestsTable.benefitAt,
        deadlineAt: contestsTable.deadlineAt,
        trackCount: sql<number>`(SELECT COUNT(*) FROM ${contestTracksTable} WHERE ${contestTracksTable.contestId} = ${contestsTable.id})::int`,
      })
      .from(contestsTable)
      .where(
        and(
          inArray(contestsTable.status, ["published", "ended"]),
          lte(contestsTable.announcementAt, sql`NOW()`),
        )
      )
      .orderBy(desc(contestsTable.announcementAt));
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "[contests GET]");
    return res.status(500).json({ error: "获取大赛列表失败" });
  }
});

router.get("/contests/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [contest] = await db.select().from(contestsTable).where(eq(contestsTable.id, id)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });

    const now = new Date();
    if (now < contest.announcementAt) return res.status(404).json({ error: "大赛不存在" });

    const tracks = await db
      .select({
        id: contestTracksTable.id,
        catCategoryId: contestTracksTable.catCategoryId,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
        testDurationHours: contestTracksTable.testDurationHours,
        quotaTotal: contestTracksTable.quotaTotal,
        quotaUsed: contestTracksTable.quotaUsed,
        testQuestionId: contestTracksTable.testQuestionId,
        testQuestionTitle: contestQuestionsTable.title,
        testQuestionContent: contestQuestionsTable.content,
        testQuestionAttachments: contestQuestionsTable.attachments,
      })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .leftJoin(contestQuestionsTable, eq(contestTracksTable.testQuestionId, contestQuestionsTable.id))
      .where(eq(contestTracksTable.contestId, id))
      .orderBy(asc(contestTracksTable.id));

    let phase: "pre_announcement" | "pre_registration" | "registration" | "pre_public" | "public" | "benefit" | "ended";
    if (now < contest.announcementAt) phase = "pre_announcement";
    else if (now < contest.registrationAt) phase = "pre_registration";
    else if (now < new Date(contest.publicAt.getTime() - 2 * 24 * 60 * 60 * 1000)) phase = "registration";
    else if (now < contest.publicAt) phase = "pre_public";
    else if (now < contest.benefitAt) phase = "public";
    else if (now < contest.deadlineAt) phase = "benefit";
    else phase = "ended";

    return res.json({
      id: contest.id,
      title: contest.title,
      details: contest.details,
      announcementAt: contest.announcementAt,
      registrationAt: contest.registrationAt,
      publicAt: contest.publicAt,
      benefitAt: contest.benefitAt,
      deadlineAt: contest.deadlineAt,
      phase,
      tracks: tracks.map(t => ({
        id: t.id,
        catCategoryId: t.catCategoryId,
        catName: t.catName,
        catColorHex: t.catColorHex,
        testDurationHours: t.testDurationHours,
        quotaTotal: t.quotaTotal,
        quotaUsed: t.quotaUsed,
        quotaRemaining: Math.max(0, t.quotaTotal - t.quotaUsed),
        testQuestion: t.testQuestionId ? {
          id: t.testQuestionId,
          title: t.testQuestionTitle ?? "",
          content: t.testQuestionContent ?? null,
          attachments: t.testQuestionAttachments ?? [],
        } : null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[contests/:id GET]");
    return res.status(500).json({ error: "获取大赛详情失败" });
  }
});

router.get("/contests/:id/public-list", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [contest] = await db.select({ publicAt: contestsTable.publicAt }).from(contestsTable).where(eq(contestsTable.id, id)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });

    const now = new Date();
    if (now < contest.publicAt) return res.status(403).json({ error: "公示时间未到" });

    const tracks = await db
      .select({
        trackId: contestTracksTable.id,
        catName: catCategoriesTable.name,
        catColorHex: catCategoriesTable.colorHex,
      })
      .from(contestTracksTable)
      .leftJoin(catCategoriesTable, eq(contestTracksTable.catCategoryId, catCategoriesTable.id))
      .where(eq(contestTracksTable.contestId, id))
      .orderBy(asc(contestTracksTable.id));

    const result = await Promise.all(tracks.map(async (track) => {
      const passedUsers = await db
        .select({ nickname: usersTable.nickname, avatar: usersTable.avatar })
        .from(contestRegistrationsTable)
        .leftJoin(usersTable, eq(contestRegistrationsTable.userId, usersTable.id))
        .where(and(
          eq(contestRegistrationsTable.trackId, track.trackId),
          inArray(contestRegistrationsTable.status, ["test_passed", "assignment_submitted", "assignment_passed", "assignment_failed"]),
        ))
        .orderBy(asc(contestRegistrationsTable.createdAt));
      return { ...track, passedUsers };
    }));

    return res.json(result);
  } catch (err) {
    logger.error({ err }, "[contests/:id/public-list GET]");
    return res.status(500).json({ error: "获取公示名单失败" });
  }
});

/* ─── OPC: Register (名额原子扣减 + 事务) ──────────────────────── */

router.post("/contests/:id/tracks/:trackId/register", requireAuth, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const trackId = Number(req.params.trackId);
    const userId = req.user!.id;

    const [contest] = await db.select().from(contestsTable).where(eq(contestsTable.id, contestId)).limit(1);
    if (!contest) return res.status(404).json({ error: "大赛不存在" });

    const now = new Date();
    if (now < contest.announcementAt) return res.status(404).json({ error: "大赛不存在" });
    if (now < contest.registrationAt) return res.status(400).json({ error: "报名时间未到" });
    const registrationCutoff = new Date(contest.publicAt.getTime() - 2 * 24 * 60 * 60 * 1000);
    if (now >= registrationCutoff) return res.status(400).json({ error: "报名已截止" });

    const [existing] = await db.select({ id: contestRegistrationsTable.id })
      .from(contestRegistrationsTable)
      .where(and(eq(contestRegistrationsTable.trackId, trackId), eq(contestRegistrationsTable.userId, userId)))
      .limit(1);
    if (existing) return res.status(409).json({ error: "您已报名该赛道" });

    // Atomic quota decrement + insert in one transaction
    const reg = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE contest_tracks
        SET quota_used = quota_used + 1
        WHERE id = ${trackId}
          AND contest_id = ${contestId}
          AND quota_used < quota_total
        RETURNING id
      `);

      if (result.rows.length === 0) {
        throw Object.assign(new Error("QUOTA_FULL"), { statusCode: 400 });
      }

      const [newReg] = await tx.insert(contestRegistrationsTable).values({
        contestId,
        trackId,
        userId,
        status: "registered",
      }).returning();

      return newReg;
    });

    return res.status(201).json(reg);
  } catch (err: any) {
    if (err?.message === "QUOTA_FULL") {
      return res.status(400).json({ error: "该赛道名额已满，报名失败" });
    }
    logger.error({ err }, "[contests/:id/tracks/:trackId/register POST]");
    return res.status(500).json({ error: "报名失败" });
  }
});

export default router;
