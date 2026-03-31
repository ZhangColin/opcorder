import { Router, type IRouter } from "express";
import { db, usersTable, demandsTable, ordersTable, bidsTable, postsTable, coursesTable, enrollmentsTable, portfoliosTable, notificationsTable, siteSettingsTable } from "@workspace/db";
import { eq, desc, count, sql, and, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth";

const router: IRouter = Router();

router.use("/admin", requireAdmin);

/* ─── STATS ──────────────────────────────────────── */

router.get("/admin/stats", async (_req, res) => {
  try {
    const [orderStats] = await db.select({
      totalOrders: count(),
      totalAmount: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    }).from(ordersTable);

    const [completedOrders] = await db.select({ cnt: count() })
      .from(ordersTable).where(eq(ordersTable.status, "completed"));

    const [activeOpcCount] = await db.select({ cnt: count() })
      .from(usersTable).where(eq(usersTable.role, "opc"));

    const [inProgressOrders] = await db.select({ cnt: count() })
      .from(ordersTable).where(eq(ordersTable.status, "in_progress"));

    const [disputedOrders] = await db.select({ cnt: count() })
      .from(ordersTable).where(eq(ordersTable.status, "disputed"));

    const [pendingDemands] = await db.select({ cnt: count() })
      .from(demandsTable).where(eq(demandsTable.status, "pending_review"));

    const [postCount] = await db.select({ cnt: count() }).from(postsTable);

    const total = Number(orderStats.totalOrders) || 0;
    const completed = Number(completedOrders.cnt) || 0;
    const completionRate = total > 0 ? (completed / total * 100) : 0;

    res.json({
      totalOrders: total,
      totalAmount: Number(orderStats.totalAmount) || 0,
      completionRate: Math.round(completionRate * 10) / 10,
      activeOpcs: Number(activeOpcCount.cnt) || 0,
      inProgressOrders: Number(inProgressOrders.cnt) || 0,
      disputedOrders: Number(disputedOrders.cnt) || 0,
      pendingDemands: Number(pendingDemands.cnt) || 0,
      totalPosts: Number(postCount.cnt) || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取统计数据失败" });
  }
});

/* ─── USER MANAGEMENT ─────────────────────────────── */

router.get("/admin/users", async (req, res) => {
  try {
    const { role, status, q } = req.query as Record<string, string>;

    const conditions = [];
    if (role && role !== "all") conditions.push(eq(usersTable.role, role as "opc" | "publisher" | "admin"));
    if (status && status !== "all") conditions.push(eq(usersTable.status, status as "active" | "suspended"));
    if (q) conditions.push(or(
      ilike(usersTable.nickname, `%${q}%`),
      ilike(usersTable.email, `%${q}%`)
    ));

    const users = await db.select({
      id: usersTable.id,
      nickname: usersTable.nickname,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      avatar: usersTable.avatar,
      createdAt: usersTable.createdAt,
    })
      .from(usersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(100);

    const withOpcProfiles = await Promise.all(users.map(async (u) => {
      if (u.role !== "opc") return { ...u, opcLevel: null, creditScore: null, totalOrders: null };
      const [opc] = await db.execute(
        sql`SELECT level, credit_score, total_orders FROM opc_profiles WHERE user_id = ${u.id} LIMIT 1`
      ).then(r => r.rows as Array<Record<string, unknown>>);
      return {
        ...u,
        opcLevel: opc?.level ?? null,
        creditScore: opc?.credit_score ?? null,
        totalOrders: opc?.total_orders ?? null,
      };
    }));

    res.json(withOpcProfiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取用户列表失败" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { action, value } = req.body as { action: string; value?: string };

    if (action === "ban") {
      await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, userId));
    } else if (action === "unban") {
      await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, userId));
    } else if (action === "setLevel" && value) {
      await db.execute(sql`UPDATE opc_profiles SET level = ${value} WHERE user_id = ${userId}`);
    } else if (action === "adjustCredit" && value) {
      await db.execute(sql`UPDATE opc_profiles SET credit_score = LEAST(5.0, GREATEST(0, credit_score + ${Number(value)})) WHERE user_id = ${userId}`);
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

/* ─── DEMAND MANAGEMENT ───────────────────────────── */

router.get("/admin/demands", async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>;

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(demandsTable.status, status as "pending_review" | "published" | "in_progress" | "completed" | "closed" | "matched" | "draft" | "pending_acceptance"));
    if (q) conditions.push(ilike(demandsTable.title, `%${q}%`));

    const demands = await db.select({
      id: demandsTable.id,
      demandNo: demandsTable.demandNo,
      title: demandsTable.title,
      status: demandsTable.status,
      mode: demandsTable.mode,
      budgetMin: demandsTable.budgetMin,
      budgetMax: demandsTable.budgetMax,
      isUrgent: demandsTable.isUrgent,
      createdAt: demandsTable.createdAt,
      publisherId: demandsTable.publisherId,
      deadline: demandsTable.deadline,
    })
      .from(demandsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(demandsTable.createdAt))
      .limit(100);

    const withPublisher = await Promise.all(demands.map(async (d) => {
      const [pub] = await db.select({ nickname: usersTable.nickname })
        .from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);
      return { ...d, publisherName: pub?.nickname ?? "—" };
    }));

    res.json(withPublisher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取需求列表失败" });
  }
});

router.patch("/admin/demands/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body as { action: string };

    if (action === "approve") {
      await db.update(demandsTable).set({ status: "published" }).where(eq(demandsTable.id, id));
    } else if (action === "reject") {
      await db.update(demandsTable).set({ status: "closed" }).where(eq(demandsTable.id, id));
    } else if (action === "markUrgent") {
      await db.update(demandsTable).set({ isUrgent: true }).where(eq(demandsTable.id, id));
    } else if (action === "removeUrgent") {
      await db.update(demandsTable).set({ isUrgent: false }).where(eq(demandsTable.id, id));
    } else if (action === "forceClose") {
      await db.update(demandsTable).set({ status: "closed" }).where(eq(demandsTable.id, id));
    } else if (action === "revertToDraft") {
      await db.update(demandsTable).set({ status: "draft" }).where(eq(demandsTable.id, id));
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

/* ─── ORDER MANAGEMENT ────────────────────────────── */

router.get("/admin/orders", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(ordersTable.status, status as "in_progress" | "pending_acceptance" | "completed" | "closed" | "disputed"));

    const orders = await db.select({
      id: ordersTable.id,
      orderNo: ordersTable.orderNo,
      status: ordersTable.status,
      amount: ordersTable.amount,
      opcShare: ordersTable.opcShare,
      platformFee: ordersTable.platformFee,
      opcId: ordersTable.opcId,
      publisherId: ordersTable.publisherId,
      demandId: ordersTable.demandId,
      createdAt: ordersTable.createdAt,
      milestones: ordersTable.milestones,
    })
      .from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.createdAt))
      .limit(100);

    const enriched = await Promise.all(orders.map(async (o) => {
      const [opc] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.opcId)).limit(1);
      const [pub] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.publisherId)).limit(1);
      const [demand] = await db.select({ title: demandsTable.title }).from(demandsTable).where(eq(demandsTable.id, o.demandId)).limit(1);

      const totalMilestones = Array.isArray(o.milestones) ? o.milestones.length : 0;
      const completedMilestones = Array.isArray(o.milestones)
        ? o.milestones.filter((m: { status?: string }) => m.status === "completed" || m.status === "approved").length
        : 0;

      const daysSinceCreated = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...o,
        opcName: opc?.nickname ?? "—",
        publisherName: pub?.nickname ?? "—",
        demandTitle: demand?.title ?? "—",
        totalMilestones,
        completedMilestones,
        daysSinceCreated,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取订单列表失败" });
  }
});

router.patch("/admin/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body as { action: string };

    if (action === "forceSettle") {
      await db.update(ordersTable).set({ status: "completed" }).where(eq(ordersTable.id, id));
    } else if (action === "markDisputed") {
      await db.update(ordersTable).set({ status: "disputed" }).where(eq(ordersTable.id, id));
    } else if (action === "resolveDispute") {
      await db.update(ordersTable).set({ status: "in_progress" }).where(eq(ordersTable.id, id));
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

/* ─── FINANCE ─────────────────────────────────────── */

router.get("/admin/finance", async (_req, res) => {
  try {
    const [totals] = await db.select({
      totalAmount: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)`,
      totalPlatformFee: sql<number>`COALESCE(SUM(${ordersTable.platformFee}), 0)`,
      totalOpcShare: sql<number>`COALESCE(SUM(${ordersTable.opcShare}), 0)`,
    }).from(ordersTable).where(eq(ordersTable.status, "completed"));

    const [pendingAmount] = await db.select({
      val: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    }).from(ordersTable).where(
      or(eq(ordersTable.status, "in_progress"), eq(ordersTable.status, "pending_acceptance"))
    );

    const recentOrders = await db.select({
      id: ordersTable.id,
      orderNo: ordersTable.orderNo,
      amount: ordersTable.amount,
      opcShare: ordersTable.opcShare,
      platformFee: ordersTable.platformFee,
      status: ordersTable.status,
      opcId: ordersTable.opcId,
      publisherId: ordersTable.publisherId,
      createdAt: ordersTable.createdAt,
    }).from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(20);

    const transactions = await Promise.all(recentOrders.map(async (o) => {
      const [opc] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.opcId)).limit(1);
      const [pub] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.publisherId)).limit(1);
      return { ...o, opcName: opc?.nickname ?? "—", publisherName: pub?.nickname ?? "—" };
    }));

    res.json({
      totalSettled: Number(totals.totalAmount) || 0,
      platformFee: Number(totals.totalPlatformFee) || 0,
      opcShare: Number(totals.totalOpcShare) || 0,
      pendingEscrow: Number(pendingAmount.val) || 0,
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取财务数据失败" });
  }
});

/* ─── ECOSYSTEM (OPC POOL) ─────────────────────────── */

router.get("/admin/ecosystem", async (_req, res) => {
  try {
    const opcs = await db.execute(sql`
      SELECT
        u.id,
        u.nickname,
        u.email,
        u.status,
        u.created_at,
        p.level,
        p.credit_score,
        p.total_orders,
        p.completion_rate,
        p.avg_rating,
        p.skill_tags,
        p.industry_tags
      FROM users u
      LEFT JOIN opc_profiles p ON p.user_id = u.id
      WHERE u.role = 'opc'
      ORDER BY p.credit_score DESC NULLS LAST
      LIMIT 100
    `);

    res.json(opcs.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取生态池数据失败" });
  }
});

router.patch("/admin/ecosystem/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { action, value } = req.body as { action: string; value?: string | number };

    if (action === "setLevel" && value) {
      await db.execute(sql`UPDATE opc_profiles SET level = ${String(value)} WHERE user_id = ${userId}`);
    } else if (action === "addCredit" && value) {
      await db.execute(sql`UPDATE opc_profiles SET credit_score = LEAST(5.0, credit_score + ${Number(value)}) WHERE user_id = ${userId}`);
    } else if (action === "subtractCredit" && value) {
      await db.execute(sql`UPDATE opc_profiles SET credit_score = GREATEST(0, credit_score - ${Number(value)}) WHERE user_id = ${userId}`);
    } else if (action === "addTag" && value) {
      await db.execute(sql`UPDATE opc_profiles SET skill_tags = skill_tags || ${JSON.stringify([value])}::jsonb WHERE user_id = ${userId}`);
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

/* ─── TRAINING ─────────────────────────────────────── */

router.get("/admin/training", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.category,
        c.required_level,
        c.duration_minutes,
        c.description,
        c.badge,
        c.rating,
        c.learners_count,
        c.is_required,
        c.status,
        c.price,
        c.syllabus_url,
        c.instructor,
        c.max_enrollments,
        c.created_at,
        COUNT(e.id) AS enrolled_count,
        COUNT(e.id) FILTER (WHERE e.completed_at IS NOT NULL) AS passed_count,
        COUNT(e.id) FILTER (WHERE e.cert_issued = true) AS cert_issued_count,
        COALESCE(SUM(CASE WHEN e.payment_status = 'paid' THEN c.price ELSE 0 END), 0) AS total_revenue
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    const statsRows = await db.execute(sql`
      SELECT
        COUNT(*) AS total_enrollments,
        COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS total_passed,
        COUNT(*) FILTER (WHERE cert_issued = true) AS total_certs,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN (SELECT price FROM courses WHERE id = course_id) ELSE 0 END), 0) AS total_revenue
      FROM enrollments
    `);
    const enrollStats = (statsRows.rows as Array<Record<string, unknown>>)[0];

    res.json({
      courses: rows.rows,
      totalEnrollments: Number(enrollStats?.total_enrollments ?? 0),
      totalPassed: Number(enrollStats?.total_passed ?? 0),
      totalCerts: Number(enrollStats?.total_certs ?? 0),
      totalRevenue: Number(enrollStats?.total_revenue ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取培训数据失败" });
  }
});

router.post("/admin/training/courses", async (req, res) => {
  try {
    const {
      title, category, requiredLevel, durationMinutes, description,
      badge, rating, isRequired, status, price, syllabusUrl, instructor, maxEnrollments,
    } = req.body as Record<string, unknown>;

    const [course] = await db.insert(coursesTable).values({
      title: String(title || ""),
      category: (category as "tech" | "strategy" | "compliance" | "operations") || "tech",
      requiredLevel: (requiredLevel as "C" | "B" | "A") || "C",
      durationMinutes: Number(durationMinutes || 60),
      description: String(description || ""),
      badge: badge ? String(badge) : null,
      rating: rating != null ? Number(rating) : null,
      isRequired: Boolean(isRequired),
      status: (status as "draft" | "published" | "closed") || "draft",
      price: Number(price || 0),
      syllabusUrl: syllabusUrl ? String(syllabusUrl) : null,
      instructor: instructor ? String(instructor) : null,
      maxEnrollments: maxEnrollments != null ? Number(maxEnrollments) : null,
    }).returning();

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "创建课程失败" });
  }
});

router.put("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title, category, requiredLevel, durationMinutes, description,
      badge, rating, isRequired, status, price, syllabusUrl, instructor, maxEnrollments,
    } = req.body as Record<string, unknown>;

    await db.update(coursesTable).set({
      title: String(title || ""),
      category: (category as "tech" | "strategy" | "compliance" | "operations") || "tech",
      requiredLevel: (requiredLevel as "C" | "B" | "A") || "C",
      durationMinutes: Number(durationMinutes || 60),
      description: String(description || ""),
      badge: badge ? String(badge) : null,
      rating: rating != null ? Number(rating) : null,
      isRequired: Boolean(isRequired),
      status: (status as "draft" | "published" | "closed") || "draft",
      price: Number(price || 0),
      syllabusUrl: syllabusUrl ? String(syllabusUrl) : null,
      instructor: instructor ? String(instructor) : null,
      maxEnrollments: maxEnrollments != null ? Number(maxEnrollments) : null,
      updatedAt: new Date(),
    }).where(eq(coursesTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新课程失败" });
  }
});

router.delete("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(enrollmentsTable).where(eq(enrollmentsTable.courseId, id));
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "删除课程失败" });
  }
});

router.patch("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body as { action: string };

    if (action === "publish") {
      await db.update(coursesTable).set({ status: "published", isRequired: false }).where(eq(coursesTable.id, id));
    } else if (action === "draft") {
      await db.update(coursesTable).set({ status: "draft" }).where(eq(coursesTable.id, id));
    } else if (action === "close") {
      await db.update(coursesTable).set({ status: "closed" }).where(eq(coursesTable.id, id));
    } else if (action === "required") {
      await db.update(coursesTable).set({ isRequired: true, status: "published" }).where(eq(coursesTable.id, id));
    } else if (action === "optional") {
      await db.update(coursesTable).set({ isRequired: false }).where(eq(coursesTable.id, id));
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

router.get("/admin/training/courses/:id/enrollments", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.execute(sql`
      SELECT
        e.id, e.user_id, e.progress_pct, e.completed_at,
        e.payment_status, e.cert_issued, e.cert_issued_at, e.created_at,
        u.nickname, u.email
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = ${id}
      ORDER BY e.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取报名列表失败" });
  }
});

router.post("/admin/training/enrollments/:enrollId/pay", async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId);
    await db.update(enrollmentsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(enrollmentsTable.id, enrollId));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败" });
  }
});

router.post("/admin/training/enrollments/:enrollId/issue-cert", async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId);
    const [enroll] = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, enrollId));
    if (!enroll) return res.status(404).json({ error: "报名记录不存在" });

    await db.update(enrollmentsTable)
      .set({ certIssued: true, certIssuedAt: new Date(), completedAt: enroll.completedAt ?? new Date() })
      .where(eq(enrollmentsTable.id, enrollId));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "发证失败" });
  }
});

/* ─── LEVEL CERT REVIEW ───────────────────────────── */

router.get("/admin/level-certs", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.title,
        p.type,
        p.description,
        p.cover_image,
        p.project_url,
        p.apply_level,
        p.level_apply_status,
        p.level_apply_note,
        p.reviewed_at,
        p.created_at,
        u.id AS user_id,
        u.nickname,
        u.email,
        op.level AS current_level,
        op.credit_score
      FROM portfolios p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN opc_profiles op ON op.user_id = p.user_id
      WHERE p.apply_level IS NOT NULL
      ORDER BY
        CASE p.level_apply_status WHEN 'pending' THEN 0 ELSE 1 END,
        p.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取等级认证列表失败" });
  }
});

router.post("/admin/level-certs/:portfolioId/review", async (req, res) => {
  try {
    const portfolioId = Number(req.params.portfolioId);
    const { result, note } = req.body as { result: "approved" | "downgraded" | "rejected"; note?: string };

    const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
    if (!portfolio) return res.status(404).json({ error: "作品不存在" });
    if (!portfolio.applyLevel) return res.status(400).json({ error: "该作品未发起等级申请" });

    const applyLevel = portfolio.applyLevel as "A" | "B" | "C";
    const levelOrder: ("newbie" | "C" | "B" | "A")[] = ["newbie", "C", "B", "A"];
    const applyIdx = levelOrder.indexOf(applyLevel);

    let grantedLevel: "newbie" | "C" | "B" | "A" = applyLevel;
    let notifTitle = "";
    let notifContent = "";

    if (result === "approved") {
      grantedLevel = applyLevel;
      notifTitle = `🎉 等级认证成功 · 升至 ${applyLevel} 级`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，认证通过！您的OPC等级已升级为 ${applyLevel}级。${note ? `\n评审意见：${note}` : ""}`;
    } else if (result === "downgraded") {
      const downIdx = Math.max(0, applyIdx - 1);
      grantedLevel = levelOrder[downIdx];
      notifTitle = `✅ 降级认证成功 · 获得 ${grantedLevel} 级`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，综合评估后授予 ${grantedLevel}级认证（您申请的是 ${applyLevel}级）。${note ? `\n评审意见：${note}` : ""}`;
    } else {
      notifTitle = `📝 等级申请评审结果：还需努力`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，暂未达到 ${applyLevel}级认证标准，请继续积累项目经验后再次申请。${note ? `\n评审意见：${note}` : ""}`;
    }

    await db.update(portfoliosTable).set({
      levelApplyStatus: result,
      levelApplyNote: note ?? null,
      reviewedAt: new Date(),
    }).where(eq(portfoliosTable.id, portfolioId));

    if (result === "approved" || result === "downgraded") {
      await db.execute(sql`UPDATE opc_profiles SET level = ${grantedLevel} WHERE user_id = ${portfolio.userId}`);
    }

    await db.insert(notificationsTable).values({
      userId: portfolio.userId,
      type: "system",
      title: notifTitle,
      content: notifContent,
      relatedId: portfolioId,
      relatedType: "portfolio",
    });

    res.json({ ok: true, grantedLevel: result !== "rejected" ? grantedLevel : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "评审操作失败" });
  }
});

/* ─── CONTENT REVIEW ──────────────────────────────── */

router.get("/admin/content", async (_req, res) => {
  try {
    const posts = await db.select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      tags: postsTable.tags,
      likesCount: postsTable.likesCount,
      commentsCount: postsTable.commentsCount,
      viewsCount: postsTable.viewsCount,
      authorId: postsTable.authorId,
      createdAt: postsTable.createdAt,
    })
      .from(postsTable)
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    const enriched = await Promise.all(posts.map(async (p) => {
      const [author] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, p.authorId)).limit(1);
      return { ...p, authorName: author?.nickname ?? "—" };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取内容列表失败" });
  }
});

router.delete("/admin/content/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM post_comments WHERE post_id = ${id}`);
    await db.execute(sql`DELETE FROM post_likes WHERE post_id = ${id}`);
    await db.delete(postsTable).where(eq(postsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "删除失败" });
  }
});

/* ─── SITE SETTINGS ─────────────────────────────── */

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name:    "接单吧",
  site_subtitle: "OPC撮合交易平台",
  site_logo:    "",
  site_favicon: "",
  footer_text:  "© 2026 接单吧 · 海创元 × 东升原点OPC社区",
  icp_number:   "",
  copyright:    "© 2026 接单吧 All Rights Reserved",
  footer_slogan:       "引领企业数字生态转型的超级个体撮合交易平台。精准匹配，担保交易，赋能数字建设。",
  footer_copyright:    "© 2026 海创元数字交易中心. 保留所有权利. 国资监管机构.",
  footer_resource1_text: "API 开发文档",
  footer_resource1_url:  "#",
  footer_resource2_text: "OPC 认证体系",
  footer_resource2_url:  "#",
  footer_resource3_text: "交易保障协议",
  footer_resource3_url:  "#",
  footer_about1_text: "海创元生态",
  footer_about1_url:  "#",
  footer_about2_text: "联系客服",
  footer_about2_url:  "#",
  footer_about3_text: "隐私政策",
  footer_about3_url:  "#",
};

router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) result[row.key] = row.value ?? "";
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取站点设置失败" });
  }
});

router.put("/admin/settings", async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(siteSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "保存站点设置失败" });
  }
});

/* ─── PUBLIC SITE SETTINGS (no auth required, used by Footer etc.) ─── */

async function loadSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    result[row.key] = row.value ?? "";
  }
  return result;
}

router.get("/site-settings", async (_req, res) => {
  try {
    res.json(await loadSettings());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取站点设置失败" });
  }
});

export default router;
