import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, usersTable, demandsTable, demandPaymentsTable, ordersTable, bidsTable, postsTable, postCommentsTable, coursesTable, enrollmentsTable, portfoliosTable, notificationsTable, siteSettingsTable, sensitiveWordsTable, learningResourcesTable, adminRolesTable, adminRoleAssignmentsTable, ADMIN_PERMISSION_KEYS, systemLogsTable, settlementAccountsTable, announcementsTable, quoteDimensionsTable, quoteTiersTable, catCategoriesTable, creditLevelsTable, opcTrackCertsTable, opcUserCatTagsTable, portfolioReviewLogsTable, demandInvitationsTable } from "@workspace/db";
import { eq, desc, count, sql, and, ilike, or, asc, inArray, ne } from "drizzle-orm";
import { requireAdmin, requirePermission, requireSuperAdmin } from "../middleware/adminAuth";
import { Resend } from "resend";
import { ReviewDemandPaymentBody, PutQuoteCardConfigBody, CreateQuoteDimensionBody, UpdateQuoteDimensionBody, CreateQuoteTierBody, UpdateQuoteTierBody } from "@workspace/api-zod";
import { createRefund } from "../lib/payment";
import { callLLM } from "../lib/llm";
import { selectInvitedOpcs } from "../lib/selectInvitedOpcs";
import { sendInvitationInAppNotifications, scheduleInvitationEmails, scheduleInvitationSms } from "../lib/notifyChannels";

const resend = new Resend(process.env.RESEND_API_KEY || "re_missing_placeholder");

/* ─── AI 赛道推断 ───────────────────────────────────────────────────────── */

// 旧版 type 英文枚举 → cat_categories.code 静态映射
const LEGACY_TYPE_TO_CAT_CODE: Record<string, string> = {
  education: "TK",
  software:  "SA",
  marketing: "BO",
  content:   "CG",
  other:     "OTHER",
};

/**
 * 推断作品所属赛道分类 ID。
 * 推断顺序：1）静态旧类型码映射  2）AI 综合分析
 * 返回匹配到的 cat_category id；推断失败返回 null。
 */
async function inferPortfolioCatCategory(
  portfolio: { title: string; type: string; description: string },
  allCategories: Array<{ id: number; code: string; name: string; description: string }>
): Promise<{ id: number; name: string; inferred: boolean } | null> {
  if (allCategories.length === 0) return null;

  // 1. 静态旧类型码映射
  const legacyCode = LEGACY_TYPE_TO_CAT_CODE[portfolio.type];
  if (legacyCode) {
    const found = allCategories.find(c => c.code === legacyCode);
    if (found) return { id: found.id, name: found.name, inferred: true };
  }

  // 2. 名称精确匹配（已迁移的记录直接用中文名作为 type）
  const nameMatch = allCategories.find(c => c.name === portfolio.type);
  if (nameMatch) return { id: nameMatch.id, name: nameMatch.name, inferred: false };

  // 3. AI 综合分析
  try {
    const catList = allCategories
      .map(c => `- ${c.code}（${c.name}）：${c.description}`)
      .join("\n");

    const resp = await callLLM([
      {
        role: "system",
        content:
          "你是一个专业的项目分类助手，帮助平台将OPC的作品案例归入正确的赛道分类。" +
          "请根据作品信息，从给定的赛道列表中选出最匹配的一个，只返回该赛道的 code（如 SA、TK、CG、BO、OTHER），不要任何其他文字。",
      },
      {
        role: "user",
        content:
          `作品标题：${portfolio.title}\n` +
          `作品类型标签：${portfolio.type}\n` +
          `作品简介：${portfolio.description}\n\n` +
          `可选赛道：\n${catList}\n\n` +
          "请直接回答赛道 code：",
      },
    ]);

    const raw = (resp.content ?? "").trim().toUpperCase();
    const aiMatch = allCategories.find(c => c.code === raw || raw.startsWith(c.code));
    if (aiMatch) return { id: aiMatch.id, name: aiMatch.name, inferred: true };
  } catch (err) {
    logger.warn({ err }, "inferPortfolioCatCategory: AI 推断失败");
  }

  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBulkEmail(nickname: string, body: string): string {
  const bodyHtml = body
    .split("\n")
    .map(line => line.trim())
    .map(line =>
      line
        ? `<p style="color:#4b5563;font-size:15px;margin:0 0 12px;line-height:1.7;">${escapeHtml(line)}</p>`
        : `<p style="margin:0 0 12px;">&nbsp;</p>`
    )
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f9fc;">
      <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
          <div style="background:#0047ab;width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;">
            <span style="color:white;font-weight:900;font-size:18px;line-height:1;">接</span>
          </div>
          <span style="display:inline-block;vertical-align:middle;font-weight:900;font-size:20px;color:#0047ab;margin-left:10px;">接单吧</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#1a1c1e;margin:0 0 20px;">您好，${escapeHtml(nickname)} 👋</h2>
        <div style="border-left:3px solid #0047ab;padding-left:16px;margin-bottom:24px;">
          ${bodyHtml}
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:16px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
          此邮件由系统自动发送，请勿直接回复。
        </p>
      </div>
      <p style="text-align:center;color:#c4c4c4;font-size:12px;margin:16px 0 0;">© 2026 接单吧 · OPC撮合交易平台</p>
    </div>
  `;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

interface BulkEmailResult {
  sent: number;
  failed: number;
  skipped: number;
  failedEmails: Array<{ email: string; reason: string }>;
}

async function sendBatchedEmails(
  jobs: Array<{ email: string; nickname: string }>,
  subject: string,
  body: string,
  from: string
): Promise<BulkEmailResult> {
  const BATCH_SIZE = 2;
  const DELAY_MS = 1100;
  let sent = 0, failed = 0, skipped = 0;
  const failedEmails: Array<{ email: string; reason: string }> = [];

  const valid = jobs.filter(j => {
    if (!j.email || !isValidEmail(j.email)) { skipped++; return false; }
    return true;
  });

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (j) => {
        try {
          const { error } = await resend.emails.send({
            from,
            to: j.email,
            subject: subject!.trim(),
            html: buildBulkEmail(j.nickname ?? j.email, body!.trim()),
          });
          if (error) {
            failed++;
            const reason = (error as any).message ?? JSON.stringify(error);
            failedEmails.push({ email: j.email, reason });
            logger.error({ err: error, email: j.email }, "Bulk email send error");
          } else {
            sent++;
          }
        } catch (err) {
          failed++;
          const reason = err instanceof Error ? err.message : String(err);
          failedEmails.push({ email: j.email, reason });
          logger.error({ err, email: j.email }, "Bulk email send exception");
        }
      })
    );
    if (i + BATCH_SIZE < valid.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return { sent, failed, skipped, failedEmails };
}

async function writeSystemLog(
  level: "info" | "warn" | "error",
  category: string,
  message: string,
  metadata?: Record<string, unknown>,
  operatorId?: number
) {
  try {
    await db.insert(systemLogsTable).values({ level, category, message, metadata: metadata ?? null, operatorId: operatorId ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to write system log");
  }
}

const router: IRouter = Router();

router.use("/admin", requireAdmin);

/* ─── Path-based permission guard ─────────────────────────────────────────
   Maps URL path prefixes to required permission keys.
   Super admins (adminPermissions === ["*"]) bypass this check automatically.
   Paths not listed here are accessible to any authenticated admin.
   ───────────────────────────────────────────────────────────────────────── */
const PATH_PERMISSION_MAP: Array<{ prefix: string; permission: string }> = [
  { prefix: "/api/admin/stats",         permission: "dashboard" },
  { prefix: "/api/admin/cockpit",       permission: "cockpit" },
  { prefix: "/api/admin/users",         permission: "users" },
  { prefix: "/api/admin/demands",       permission: "demands" },
  { prefix: "/api/admin/demand-refunds", permission: "demands" },
  { prefix: "/api/admin/orders",        permission: "orders" },
  { prefix: "/api/admin/finance",       permission: "finance" },
  { prefix: "/api/admin/ecosystem",     permission: "ecosystem" },
  { prefix: "/api/admin/training",      permission: "training" },
  { prefix: "/api/admin/level-certs",   permission: "levelcert" },
  { prefix: "/api/admin/credit-levels", permission: "levelcert" },
  { prefix: "/api/admin/credit-rules",  permission: "settings" },
  { prefix: "/api/admin/credit-transactions", permission: "settings" },
  { prefix: "/api/admin/content",       permission: "content" },
  { prefix: "/api/admin/sensitive-words", permission: "sensitivewords" },
  { prefix: "/api/admin/settings",      permission: "settings" },
  { prefix: "/api/admin/disputes",      permission: "disputes" },
  { prefix: "/api/admin/activities",    permission: "activities" },
];

import { Request, Response, NextFunction } from "express";
router.use("/admin", (req: Request, res: Response, next: NextFunction) => {
  const perms = req.user?.adminPermissions ?? [];
  if (perms.includes("*")) return next(); // super admin

  // req.originalUrl contains the full path e.g. "/api/admin/users?foo=bar"
  const urlPath = req.originalUrl.split("?")[0];
  const match = PATH_PERMISSION_MAP.find(m => urlPath.startsWith(m.prefix));
  if (!match) return next(); // unprotected path (profile, roles mgmt, etc.)

  if (perms.includes(match.permission)) return next();
  return res.status(403).json({ error: "权限不足", required: match.permission });
});

function paginate(query: Record<string, string | string[] | undefined>, defaultSize = 20) {
  const page = Math.max(1, parseInt(String(query.page ?? 1)) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? defaultSize)) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

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

    return res.json({
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
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取统计数据失败" });
  }
});

/* ─── USER MANAGEMENT ─────────────────────────────── */

router.get("/admin/users", async (req, res) => {
  try {
    const { role, status, q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (role && role !== "all") conditions.push(eq(usersTable.role, role as "opc" | "publisher" | "admin"));
    if (status && status !== "all") conditions.push(eq(usersTable.status, status as "active" | "suspended"));
    if (q) conditions.push(or(
      ilike(usersTable.nickname, `%${q}%`),
      ilike(usersTable.email, `%${q}%`)
    ));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(usersTable).where(where);

    const users = await db.select({
      id: usersTable.id,
      nickname: usersTable.nickname,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      status: usersTable.status,
      avatar: usersTable.avatar,
      createdAt: usersTable.createdAt,
    })
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize).offset(offset);

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

    return res.json({ data: withOpcProfiles, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取用户列表失败" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id as string);
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

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── DEMAND MANAGEMENT ───────────────────────────── */

router.get("/admin/demands", async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(demandsTable.status, status as "pending_review" | "published" | "in_progress" | "completed" | "closed" | "matched" | "draft" | "pending_acceptance" | "pending_payment" | "refund_pending" | "refunding" | "refunded"));
    if (q) conditions.push(or(
      ilike(demandsTable.title, `%${q}%`),
      ilike(demandsTable.demandNo, `%${q}%`),
    ));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(demandsTable).where(where);

    const demands = await db.select({
      id: demandsTable.id,
      demandNo: demandsTable.demandNo,
      title: demandsTable.title,
      status: demandsTable.status,
      mode: demandsTable.mode,
      budget: demandsTable.budget,
      budgetMin: demandsTable.budgetMin,
      budgetMax: demandsTable.budgetMax,
      isUrgent: demandsTable.isUrgent,
      createdAt: demandsTable.createdAt,
      publisherId: demandsTable.publisherId,
      deadline: demandsTable.deadline,
      opcLevel: demandsTable.opcLevel,
      requiredTrackLevel: demandsTable.requiredTrackLevel,
      bidCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${bidsTable} WHERE ${bidsTable.demandId} = ${demandsTable.id}), 0)`,
    })
      .from(demandsTable)
      .where(where)
      .orderBy(desc(demandsTable.createdAt))
      .limit(pageSize).offset(offset);

    const withPublisher = await Promise.all(demands.map(async (d) => {
      const [pub] = await db.select({ nickname: usersTable.nickname })
        .from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);
      return { ...d, publisherName: pub?.nickname ?? "—", bidCount: Number(d.bidCount ?? 0) };
    }));

    return res.json({ data: withPublisher, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取需求列表失败" });
  }
});

router.get("/admin/demands/:id/bids", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { opcProfilesTable } = await import("@workspace/db");
    const rows = await db
      .select({
        id: bidsTable.id,
        opcId: bidsTable.opcId,
        opcNickname: usersTable.nickname,
        opcAvatar: usersTable.avatar,
        opcLevel: opcProfilesTable.level,
        opcCreditScore: opcProfilesTable.creditScore,
        opcAvgRating: opcProfilesTable.avgRating,
        opcCompletedOrders: sql<number>`COALESCE((SELECT COUNT(*) FROM ${ordersTable} WHERE ${ordersTable.opcId} = ${bidsTable.opcId} AND ${ordersTable.status} = 'completed'), 0)`,
        proposal: bidsTable.proposal,
        estimatedDays: bidsTable.estimatedDays,
        quotedPrice: bidsTable.quotedPrice,
        status: bidsTable.status,
        createdAt: bidsTable.createdAt,
      })
      .from(bidsTable)
      .leftJoin(usersTable, eq(bidsTable.opcId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(bidsTable.opcId, opcProfilesTable.userId))
      .where(eq(bidsTable.demandId, id))
      .orderBy(desc(bidsTable.createdAt));
    return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    logger.error({ err }, "[admin/demands/:id/bids]");
    return res.status(500).json({ error: "获取抢单列表失败" });
  }
});

router.get("/admin/demands/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const [d] = await db.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!d) return res.status(404).json({ error: "需求不存在" });
    const [pub] = await db.select({
      nickname: usersTable.nickname,
      email: usersTable.email,
      phone: usersTable.phone,
    }).from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);

    const [payment] = await db.select().from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.demandId, id))
      .orderBy(desc(demandPaymentsTable.createdAt))
      .limit(1);

    // Auto-invitations for this demand, sorted by track level A→B→C then invitedAt.
    // `hasBid` flags whether the invited OPC has already submitted a bid on this demand.
    const invitationRows = await db
      .select({
        id: demandInvitationsTable.id,
        opcId: demandInvitationsTable.opcId,
        opcNickname: usersTable.nickname,
        opcAvatar: usersTable.avatar,
        opcEmail: usersTable.email,
        trackLevel: demandInvitationsTable.trackLevel,
        source: demandInvitationsTable.source,
        invitedAt: demandInvitationsTable.invitedAt,
        emailedAt: demandInvitationsTable.emailedAt,
        hasBid: sql<boolean>`EXISTS (SELECT 1 FROM ${bidsTable} WHERE ${bidsTable.demandId} = ${demandInvitationsTable.demandId} AND ${bidsTable.opcId} = ${demandInvitationsTable.opcId})`,
      })
      .from(demandInvitationsTable)
      .leftJoin(usersTable, eq(demandInvitationsTable.opcId, usersTable.id))
      .where(eq(demandInvitationsTable.demandId, id))
      .orderBy(
        sql`CASE ${demandInvitationsTable.trackLevel} WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END DESC`,
        asc(demandInvitationsTable.invitedAt),
      );

    return res.json({
      ...d,
      publisherName: pub?.nickname ?? "—",
      publisherEmail: pub?.email ?? null,
      publisherPhone: pub?.phone ?? null,
      invitations: invitationRows.map(r => ({
        id: r.id,
        opcId: r.opcId,
        opcNickname: r.opcNickname,
        opcAvatar: r.opcAvatar,
        opcEmail: r.opcEmail,
        trackLevel: r.trackLevel,
        source: r.source,
        invitedAt: r.invitedAt.toISOString(),
        emailedAt: r.emailedAt ? r.emailedAt.toISOString() : null,
        hasBid: Boolean(r.hasBid),
      })),
      payment: payment ? {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        paymentOrderNo: payment.paymentOrderNo,
        refundOrderNo: payment.refundOrderNo,
        refundReason: payment.refundReason,
        refundRequestedAt: payment.refundRequestedAt?.toISOString() ?? null,
        refundRejectReason: payment.refundRejectReason,
        refundReceiptUrl: payment.refundReceiptUrl,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        receiptUrl: payment.receiptUrl,
      } : null,
    });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取需求详情失败" });
  }
});

/* ─── Send in-app notification to demand publisher ── */
router.post("/admin/demands/:id/notify", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { title, content } = req.body as { title?: string; content?: string };
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "标题和内容不能为空" });
    }
    const [d] = await db.select({ publisherId: demandsTable.publisherId })
      .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!d) return res.status(404).json({ error: "需求不存在" });
    await db.insert(notificationsTable).values({
      userId: d.publisherId,
      type: "system",
      title: title.trim(),
      content: content.trim(),
      relatedId: id,
      relatedType: "demand",
    });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "发送站内信失败" });
  }
});

/* ─── Send email to demand publisher ─────────────── */
router.post("/admin/demands/:id/send-email", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { subject, content } = req.body as { subject?: string; content?: string };
    if (!subject?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "主题和内容不能为空" });
    }
    const [d] = await db.select({ publisherId: demandsTable.publisherId })
      .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!d) return res.status(404).json({ error: "需求不存在" });
    const [pub] = await db.select({ nickname: usersTable.nickname, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);
    if (!pub?.email) return res.status(400).json({ error: "该用户未绑定邮箱" });
    const { error } = await resend.emails.send({
      from: "接单吧 <jiedanba@opcorder.com>",
      to: pub.email,
      subject: subject!.trim(),
      html: buildBulkEmail(pub.nickname ?? pub.email, content.trim()),
    });
    if (error) return res.status(500).json({ error: "邮件发送失败" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "发送邮件失败" });
  }
});

router.patch("/admin/demands/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { action, reason } = req.body as { action: string; reason?: string };

    // Load demand + publisher info for notifications
    const [d] = await db.select({ publisherId: demandsTable.publisherId, title: demandsTable.title })
      .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!d) return res.status(404).json({ error: "需求不存在" });
    const [pub] = await db.select({ nickname: usersTable.nickname, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);

    if (action === "approve") {
      // Approve: directly publish the demand (no longer requires payment at this stage)
      await db.update(demandsTable).set({ status: "published" }).where(eq(demandsTable.id, id));
      // In-app notification
      await db.insert(notificationsTable).values({
        userId: d.publisherId,
        type: "system",
        title: "您的需求已通过审核并发布",
        content: `您的需求「${d.title}」已通过平台审核，现已在需求大厅公开发布，OPC 可以查看并提交报价。`,
        relatedId: id,
        relatedType: "demand",
      });
      // Email notification
      if (pub?.email) {
        await resend.emails.send({
          from: "接单吧 <jiedanba@opcorder.com>",
          to: pub.email,
          subject: "您的需求已通过审核并发布 - 接单吧",
          html: buildBulkEmail(pub.nickname ?? pub.email, `您的需求「${d.title}」已通过平台审核，现已在需求大厅公开发布。\n\nOPC 将根据您的需求提交结构化报价卡，您可以在平台上对比各家报价后选择最合适的 OPC。`),
        }).catch(() => {/* ignore email errors */});
      }

      // Auto-invite up to 7 OPCs based on cat_category + required track level.
      // Skip if directed-invite mode or no catCategoryId.
      try {
        const [fullDemand] = await db
          .select({
            id: demandsTable.id,
            title: demandsTable.title,
            mode: demandsTable.mode,
            catCategoryId: demandsTable.catCategoryId,
            requiredTrackLevel: demandsTable.requiredTrackLevel,
            budget: demandsTable.budget,
            budgetMin: demandsTable.budgetMin,
            budgetMax: demandsTable.budgetMax,
            deadline: demandsTable.deadline,
            bidDeadline: demandsTable.bidDeadline,
            publisherId: demandsTable.publisherId,
          })
          .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);

        if (fullDemand && fullDemand.mode !== "directed" && fullDemand.catCategoryId) {
          const required = (fullDemand.requiredTrackLevel ?? "any") as "any" | "C" | "B" | "A";
          const invitees = await selectInvitedOpcs({
            catCategoryId: fullDemand.catCategoryId,
            requiredTrackLevel: required,
            publisherId: fullDemand.publisherId,
          });

          if (invitees.length > 0) {
            // Persist invitations (skip duplicates if already invited).
            // `.returning()` only returns rows actually inserted, so re-approves don't re-notify.
            const inserted = await db.insert(demandInvitationsTable).values(
              invitees.map(i => ({
                demandId: fullDemand.id,
                opcId: i.userId,
                trackLevel: i.trackLevel,
                source: "auto",
              })),
            ).onConflictDoNothing().returning({ opcId: demandInvitationsTable.opcId });

            const newOpcIds = new Set(inserted.map(r => r.opcId));
            const newInvitees = invitees.filter(i => newOpcIds.has(i.userId));

            if (newInvitees.length > 0) {
              // Resolve cat name once (used by both in-app + email content)
              let catName = "未指定赛道";
              if (fullDemand.catCategoryId) {
                const [cat] = await db.select({ name: catCategoriesTable.name })
                  .from(catCategoriesTable)
                  .where(eq(catCategoriesTable.id, fullDemand.catCategoryId))
                  .limit(1);
                if (cat?.name) catName = cat.name;
              }

              const channelArgs = {
                demandId: fullDemand.id,
                demandTitle: fullDemand.title,
                catName,
                requiredTrackLevel: required,
                budget: fullDemand.budget,
                budgetMin: fullDemand.budgetMin,
                budgetMax: fullDemand.budgetMax,
                deadline: fullDemand.deadline,
                bidDeadline: fullDemand.bidDeadline,
              };

              // In-app notifications (sync) — enriched body: track / level / budget range / delivery+bid deadlines / one-click link
              try {
                await sendInvitationInAppNotifications({
                  ...channelArgs,
                  invitedOpcIds: newInvitees.map(i => i.userId),
                });
              } catch (notifyErr) {
                logger.warn({ err: notifyErr, demandId: id }, "Invitation in-app notify failed");
                await writeSystemLog("error", "demand_invitation",
                  `站内信下发失败 demand=${id}`,
                  { demandId: id, opcIds: newInvitees.map(i => i.userId), error: String(notifyErr) });
              }

              // Email — async sequential 1.1s gap, non-blocking. Only newly invited OPCs.
              scheduleInvitationEmails({
                ...channelArgs,
                invitees: newInvitees.map(i => ({ userId: i.userId, email: i.email, nickname: i.nickname })),
              });

              // SMS — reserved no-op
              scheduleInvitationSms({ demandId: fullDemand.id, invitees: newInvitees });
            }
          }
        }
      } catch (inviteErr) {
        logger.warn({ err: inviteErr, demandId: id }, "Auto-invite on approve failed (non-blocking)");
        await writeSystemLog("error", "demand_invitation",
          `自动邀请流程失败 demand=${id}`,
          { demandId: id, error: String(inviteErr) });
      }
    } else if (action === "reject") {
      if (!reason?.trim()) {
        return res.status(400).json({ error: "审核不通过时必须填写原因" });
      }
      const reasonText = reason.trim();
      await db.update(demandsTable).set({ status: "draft", rejectionReason: reasonText }).where(eq(demandsTable.id, id));
      // In-app notification
      await db.insert(notificationsTable).values({
        userId: d.publisherId,
        type: "system",
        title: "您的需求未通过审核",
        content: `您的需求「${d.title}」未通过平台审核。\n\n审核意见：${reasonText}\n\n请根据上述意见修改后重新提交。`,
        relatedId: id,
        relatedType: "demand",
      });
      // Email notification
      if (pub?.email) {
        await resend.emails.send({
          from: "接单吧 <jiedanba@opcorder.com>",
          to: pub.email,
          subject: "您的需求未通过审核 - 接单吧",
          html: buildBulkEmail(pub.nickname ?? pub.email, `您的需求「${d.title}」未通过平台审核。\n\n审核意见：${reasonText}\n\n请根据上述意见修改后重新提交审核。`),
        }).catch(() => {/* ignore email errors */});
      }
    } else if (action === "markUrgent") {
      await db.update(demandsTable).set({ isUrgent: true }).where(eq(demandsTable.id, id));
    } else if (action === "removeUrgent") {
      await db.update(demandsTable).set({ isUrgent: false }).where(eq(demandsTable.id, id));
    } else if (action === "forceClose") {
      await db.update(demandsTable).set({ status: "closed" }).where(eq(demandsTable.id, id));
    } else if (action === "revertToDraft") {
      await db.update(demandsTable).set({ status: "draft" }).where(eq(demandsTable.id, id));
    } else if (action === "setOpcLevel") {
      const value = (req.body as { value?: string }).value;
      const validLevels = ["any", "C", "B", "A"];
      if (!value || !validLevels.includes(value)) {
        return res.status(400).json({ error: "无效的 OPC 等级" });
      }
      await db.update(demandsTable).set({ opcLevel: value }).where(eq(demandsTable.id, id));
    } else if (action === "setRequiredTrackLevel") {
      const value = (req.body as { value?: string }).value;
      const validLevels = ["any", "C", "B", "A"];
      if (!value || !validLevels.includes(value)) {
        return res.status(400).json({ error: "无效的赛道认证等级" });
      }
      await db.update(demandsTable).set({ requiredTrackLevel: value }).where(eq(demandsTable.id, id));
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── ORDER MANAGEMENT ────────────────────────────── */

router.get("/admin/orders", async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(ordersTable.status, status as "pending_payment" | "in_progress" | "pending_acceptance" | "completed" | "closed" | "disputed"));
    if (q) conditions.push(or(
      ilike(ordersTable.orderNo, `%${q}%`),
      sql`${ordersTable.demandId} IN (SELECT id FROM demands WHERE title ILIKE ${`%${q}%`})`,
      sql`${ordersTable.opcId} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${q}%`})`,
    ));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(ordersTable).where(where);

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
      paymentMethod: ordersTable.paymentMethod,
      paymentReceiptUrl: ordersTable.paymentReceiptUrl,
      paymentRejectReason: ordersTable.paymentRejectReason,
      paidAt: ordersTable.paidAt,
    })
      .from(ordersTable)
      .where(where)
      .orderBy(desc(ordersTable.createdAt))
      .limit(pageSize).offset(offset);

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

    return res.json({ data: enriched, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取订单列表失败" });
  }
});

router.patch("/admin/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
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

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── FINANCE ─────────────────────────────────────── */

router.get("/admin/finance", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

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

    const txConditions = [];
    if (status && status !== "all") txConditions.push(eq(ordersTable.status, status as "in_progress" | "pending_acceptance" | "completed" | "closed" | "disputed"));
    const txWhere = txConditions.length > 0 ? and(...txConditions) : undefined;

    const [{ total: txTotal }] = await db.select({ total: count() }).from(ordersTable).where(txWhere);

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
    }).from(ordersTable).where(txWhere).orderBy(desc(ordersTable.createdAt)).limit(pageSize).offset(offset);

    const transactions = await Promise.all(recentOrders.map(async (o) => {
      const [opc] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.opcId)).limit(1);
      const [pub] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, o.publisherId)).limit(1);
      return { ...o, opcName: opc?.nickname ?? "—", publisherName: pub?.nickname ?? "—" };
    }));

    return res.json({
      totalSettled: Number(totals.totalAmount) || 0,
      platformFee: Number(totals.totalPlatformFee) || 0,
      opcShare: Number(totals.totalOpcShare) || 0,
      pendingEscrow: Number(pendingAmount.val) || 0,
      transactions,
      transactionsTotal: Number(txTotal),
      transactionsPage: page,
      transactionsPageSize: pageSize,
    });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取财务数据失败" });
  }
});

/* ─── ECOSYSTEM (OPC POOL) ─────────────────────────── */

router.get("/admin/ecosystem", async (req, res) => {
  try {
    const { q, catId, level } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const qFilter  = q ? sql`AND (u.nickname ILIKE ${'%' + q + '%'} OR u.email ILIKE ${'%' + q + '%'})` : sql``;
    const hasCat = catId && catId !== "all";
    const hasLevel = hasCat && level && ["C", "B", "A"].includes(level);
    const catFilter = hasCat
      ? hasLevel
        ? sql`AND EXISTS (SELECT 1 FROM opc_track_certs _tc WHERE _tc.user_id = u.id AND _tc.cat_category_id = ${Number(catId)} AND _tc.level = ${level})`
        : sql`AND EXISTS (SELECT 1 FROM opc_track_certs _tc WHERE _tc.user_id = u.id AND _tc.cat_category_id = ${Number(catId)})`
      : sql``;

    // Accurate stats (full DB, not paginated subset)
    const [totalRow] = (await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM users u WHERE u.role = 'opc'
    `)).rows as Array<{ total: number }>;

    const [aLevelRow] = (await db.execute(sql`
      SELECT COUNT(DISTINCT u.id)::int AS cnt FROM users u
      WHERE u.role = 'opc'
      AND EXISTS (SELECT 1 FROM opc_track_certs tc WHERE tc.user_id = u.id AND tc.level = 'A')
    `)).rows as Array<{ cnt: number }>;

    const [warnRow] = (await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM users u
      JOIN opc_profiles p ON p.user_id = u.id
      WHERE u.role = 'opc' AND p.credit_score < 3.5
    `)).rows as Array<{ cnt: number }>;

    const opcs = await db.execute(sql`
      SELECT
        u.id,
        u.nickname,
        u.email,
        u.status,
        u.created_at,
        p.credit_score,
        p.credit_points,
        p.total_orders,
        p.completion_rate,
        p.avg_rating,
        cl.name  AS credit_level_name,
        cl.color AS credit_level_color,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT('cat_id', tc.cat_category_id, 'cat_name', cc.name, 'level', tc.level)
          ) FILTER (WHERE tc.id IS NOT NULL),
          '[]'::json
        ) AS track_certs,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT('tag_id', uct.cat_tag_id, 'tag_name', ct.name, 'cat_id', ct.cat_category_id)
          ) FILTER (WHERE uct.id IS NOT NULL),
          '[]'::json
        ) AS user_tags
      FROM users u
      LEFT JOIN opc_profiles p ON p.user_id = u.id
      LEFT JOIN credit_levels cl ON cl.id = p.credit_level_id
      LEFT JOIN opc_track_certs tc ON tc.user_id = u.id
      LEFT JOIN cat_categories cc ON cc.id = tc.cat_category_id
      LEFT JOIN opc_user_cat_tags uct ON uct.user_id = u.id
      LEFT JOIN cat_tags ct ON ct.id = uct.cat_tag_id
      WHERE u.role = 'opc'
      ${qFilter} ${catFilter}
      GROUP BY u.id, u.nickname, u.email, u.status, u.created_at,
        p.credit_score, p.credit_points, p.total_orders, p.completion_rate, p.avg_rating,
        cl.name, cl.color
      ORDER BY p.credit_score DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return res.json({
      data: opcs.rows,
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      stats: {
        total: Number(totalRow?.total ?? 0),
        aLevelCount: Number(aLevelRow?.cnt ?? 0),
        warnCount: Number(warnRow?.cnt ?? 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取生态池数据失败" });
  }
});

router.patch("/admin/ecosystem/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId as string);
    const { action, value, catCategoryId, tagIds } = req.body as {
      action: string;
      value?: string | number;
      catCategoryId?: number;
      tagIds?: number[];
    };

    if (action === "addCredit" && value) {
      await db.execute(sql`UPDATE opc_profiles SET credit_score = LEAST(5.0, credit_score + ${Number(value)}) WHERE user_id = ${userId}`);
    } else if (action === "subtractCredit" && value) {
      await db.execute(sql`UPDATE opc_profiles SET credit_score = GREATEST(0, credit_score - ${Number(value)}) WHERE user_id = ${userId}`);
    } else if (action === "setTrackLevel" && catCategoryId && value) {
      await db.execute(sql`
        INSERT INTO opc_track_certs (user_id, cat_category_id, level, status, certified_at, manually_granted)
        VALUES (${userId}, ${Number(catCategoryId)}, ${String(value)}, 'active', NOW(), true)
        ON CONFLICT (user_id, cat_category_id) DO UPDATE SET level = ${String(value)}, status = 'active'
      `);
    } else if (action === "setTrackTags" && catCategoryId !== undefined) {
      // Delete all tags in this category for this user, then re-insert selected
      await db.execute(sql`
        DELETE FROM opc_user_cat_tags
        WHERE user_id = ${userId}
          AND cat_tag_id IN (SELECT id FROM cat_tags WHERE cat_category_id = ${Number(catCategoryId)})
      `);
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await db.execute(sql`
            INSERT INTO opc_user_cat_tags (user_id, cat_tag_id, granted_at)
            VALUES (${userId}, ${tagId}, NOW())
            ON CONFLICT (user_id, cat_tag_id) DO NOTHING
          `);
        }
      }
    } else {
      return res.status(400).json({ error: "无效操作" });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── TRAINING ─────────────────────────────────────── */

router.get("/admin/training", async (req, res) => {
  try {
    const { q, status: courseStatus, level, catCategoryId: catCatQ } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const qFilter = q ? sql`AND c.title ILIKE ${'%' + q + '%'}` : sql``;
    const statusFilter = (courseStatus && courseStatus !== "all") ? sql`AND c.status = ${courseStatus}` : sql``;
    const levelFilter = (level && level !== "all") ? sql`AND c.required_level = ${level}` : sql``;
    const catFilter = (catCatQ && catCatQ !== "all") ? sql`AND c.cat_category_id = ${Number(catCatQ)}` : sql``;

    const catCategories = (await db.execute(sql`SELECT id, name FROM cat_categories WHERE is_active = true ORDER BY sort_order`)).rows as Array<{ id: number; name: string }>;

    const [countRow] = (await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM courses c
      WHERE 1=1 ${qFilter} ${statusFilter} ${levelFilter} ${catFilter}
    `)).rows as Array<{ total: number }>;

    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.category,
        c.cat_category_id,
        cc.name AS cat_category_name,
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
      LEFT JOIN cat_categories cc ON cc.id = c.cat_category_id
      LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE 1=1 ${qFilter} ${statusFilter} ${levelFilter} ${catFilter}
      GROUP BY c.id, cc.name
      ORDER BY c.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
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

    return res.json({
      data: rows.rows,
      total: Number(countRow?.total ?? 0),
      page,
      pageSize,
      courses: rows.rows,
      coursesTotal: Number(countRow?.total ?? 0),
      coursesPage: page,
      coursesPageSize: pageSize,
      catCategories,
      totalEnrollments: Number(enrollStats?.total_enrollments ?? 0),
      totalPassed: Number(enrollStats?.total_passed ?? 0),
      totalCerts: Number(enrollStats?.total_certs ?? 0),
      totalRevenue: Number(enrollStats?.total_revenue ?? 0),
    });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取培训数据失败" });
  }
});

router.post("/admin/training/courses", async (req, res) => {
  try {
    const {
      title, category, catCategoryId, requiredLevel, durationMinutes, description,
      badge, rating, isRequired, status, price, syllabusUrl, instructor, maxEnrollments,
    } = req.body as Record<string, unknown>;

    const [course] = await db.insert(coursesTable).values({
      title: String(title || ""),
      category: (category as "tech" | "strategy" | "compliance" | "operations") || "tech",
      catCategoryId: catCategoryId ? Number(catCategoryId) : null,
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

    return res.status(201).json(course);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "创建课程失败" });
  }
});

router.put("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const {
      title, category, catCategoryId, requiredLevel, durationMinutes, description,
      badge, rating, isRequired, status, price, syllabusUrl, instructor, maxEnrollments,
    } = req.body as Record<string, unknown>;

    await db.update(coursesTable).set({
      title: String(title || ""),
      category: (category as "tech" | "strategy" | "compliance" | "operations") || "tech",
      catCategoryId: catCategoryId ? Number(catCategoryId) : null,
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

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "更新课程失败" });
  }
});

router.delete("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    await db.delete(enrollmentsTable).where(eq(enrollmentsTable.courseId, id));
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "删除课程失败" });
  }
});

router.patch("/admin/training/courses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
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

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.get("/admin/training/courses/:id/enrollments", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
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
    return res.json(rows.rows);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取报名列表失败" });
  }
});

router.post("/admin/training/enrollments/:enrollId/pay", async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId as string);
    await db.update(enrollmentsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(enrollmentsTable.id, enrollId));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/admin/training/enrollments/:enrollId/issue-cert", async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId as string);
    const [enroll] = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, enrollId));
    if (!enroll) return res.status(404).json({ error: "报名记录不存在" });

    await db.update(enrollmentsTable)
      .set({ certIssued: true, certIssuedAt: new Date(), completedAt: enroll.completedAt ?? new Date() })
      .where(eq(enrollmentsTable.id, enrollId));

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "发证失败" });
  }
});

/* ─── COURSE REFUND MANAGEMENT ─────────────────── */

/** List all pending course refund requests */
router.get("/admin/training/refunds", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        enrollment: enrollmentsTable,
        course: coursesTable,
        user: {
          id: usersTable.id,
          nickname: usersTable.nickname,
          email: usersTable.email,
        },
      })
      .from(enrollmentsTable)
      .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .leftJoin(usersTable, eq(enrollmentsTable.userId, usersTable.id))
      .where(eq(enrollmentsTable.paymentStatus, "refund_pending"))
      .orderBy(desc(enrollmentsTable.refundRequestedAt));

    return res.json(rows.map(({ enrollment, course, user }) => ({
      id: enrollment.id,
      courseId: enrollment.courseId,
      courseTitle: course?.title ?? null,
      courseCategory: course?.category ?? null,
      coursePrice: course?.price ?? null,
      userId: enrollment.userId,
      userNickname: user?.nickname ?? null,
      userEmail: user?.email ?? null,
      paymentStatus: enrollment.paymentStatus,
      paymentOrderNo: enrollment.paymentOrderNo ?? null,
      refundReason: enrollment.refundReason ?? null,
      refundRequestedAt: enrollment.refundRequestedAt?.toISOString() ?? null,
      refundRejectReason: enrollment.refundRejectReason ?? null,
      createdAt: enrollment.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err: err }, "[admin-course-refunds]");
    return res.status(500).json({ error: "获取退款列表失败" });
  }
});

/** Admin approves a course enrollment refund request */
router.post("/admin/training/enrollments/:enrollId/approve-refund", requireAdmin, async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId as string);

    const [enrollment] = await db
      .select({ enrollment: enrollmentsTable, course: coursesTable, user: usersTable })
      .from(enrollmentsTable)
      .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .leftJoin(usersTable, eq(enrollmentsTable.userId, usersTable.id))
      .where(eq(enrollmentsTable.id, enrollId));

    if (!enrollment) return res.status(404).json({ error: "报名记录不存在" });
    if (enrollment.enrollment.paymentStatus !== "refund_pending") {
      return res.status(409).json({ error: "该报名记录当前不处于退款审核中" });
    }
    if (!enrollment.enrollment.paymentOrderNo) {
      return res.status(400).json({ error: "缺少支付订单号，无法发起退款" });
    }

    const amountFen = Math.round((enrollment.course?.price ?? 0) * 100);
    const businessOrderNo = `COURSE-REFUND-${enrollId}-${Date.now()}`;

    const refundResult = await createRefund({
      paymentOrderNo: enrollment.enrollment.paymentOrderNo,
      amount: amountFen,
      reason: enrollment.enrollment.refundReason ?? "课程退款",
      businessOrderNo,
      notifyUrl: "https://www.opcorder.com/api/payment/refund-callback",
      needAudit: false,
    });

    await db.update(enrollmentsTable)
      .set({
        paymentStatus: "refunded",
        refundOrderNo: refundResult.refundOrderNo,
        refundedAt: new Date(),
      })
      .where(eq(enrollmentsTable.id, enrollId));

    if (enrollment.user?.id) {
      await db.insert(notificationsTable).values({
        userId: enrollment.user.id,
        type: "system",
        title: "课程退款已完成",
        content: `您申请的课程「${enrollment.course?.title ?? ""}」退款申请已通过，退款将在1-5个工作日内到账。`,
        relatedId: enrollment.enrollment.courseId,
        relatedType: "course",
      }).catch(() => {});
    }

    return res.json({ success: true, refundOrderNo: refundResult.refundOrderNo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    logger.error({ err: err }, "[admin-approve-course-refund]");
    return res.status(500).json({ error: msg });
  }
});

/** Admin rejects a course enrollment refund request */
router.post("/admin/training/enrollments/:enrollId/reject-refund", requireAdmin, async (req, res) => {
  try {
    const enrollId = Number(req.params.enrollId as string);
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) return res.status(400).json({ error: "请填写拒绝原因" });

    const [enrollment] = await db
      .select({ enrollment: enrollmentsTable, course: coursesTable, user: usersTable })
      .from(enrollmentsTable)
      .leftJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
      .leftJoin(usersTable, eq(enrollmentsTable.userId, usersTable.id))
      .where(eq(enrollmentsTable.id, enrollId));

    if (!enrollment) return res.status(404).json({ error: "报名记录不存在" });
    if (enrollment.enrollment.paymentStatus !== "refund_pending") {
      return res.status(409).json({ error: "该报名记录当前不处于退款审核中" });
    }

    await db.update(enrollmentsTable)
      .set({
        paymentStatus: "paid",
        refundRejectReason: reason.trim(),
      })
      .where(eq(enrollmentsTable.id, enrollId));

    if (enrollment.user?.id) {
      await db.insert(notificationsTable).values({
        userId: enrollment.user.id,
        type: "system",
        title: "课程退款申请未通过",
        content: `您申请的课程「${enrollment.course?.title ?? ""}」退款未获批准。原因：${reason.trim()}。如有疑问请联系平台客服。`,
        relatedId: enrollment.enrollment.courseId,
        relatedType: "course",
      }).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    logger.error({ err: err }, "[admin-reject-course-refund]");
    return res.status(500).json({ error: msg });
  }
});

/* ─── USER BULK EMAIL ───────────────────────────── */

router.post("/admin/users/bulk-email", async (req, res) => {
  try {
    const {
      subject, body,
      filterRole, filterStatus,
      filterNames, filterEmails, filterPhones, filterLevels,
      filterRegisteredFrom, filterRegisteredTo,
    } = req.body as {
      subject?: string; body?: string;
      filterRole?: string; filterStatus?: string;
      filterNames?: string; filterEmails?: string; filterPhones?: string;
      filterLevels?: string;
      filterRegisteredFrom?: string; filterRegisteredTo?: string;
    };

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "邮件主题和正文不能为空" });
    }

    // Build conditions for the users query
    const conditions: any[] = [];
    if (filterRole && filterRole !== "all") {
      conditions.push(eq(usersTable.role, filterRole as any));
    }
    if (filterStatus && filterStatus !== "all") {
      conditions.push(eq(usersTable.status, filterStatus as any));
    }
    if (filterRegisteredFrom?.trim()) {
      conditions.push(sql`${usersTable.createdAt} >= ${new Date(filterRegisteredFrom)}`);
    }
    if (filterRegisteredTo?.trim()) {
      conditions.push(sql`${usersTable.createdAt} <= ${new Date(filterRegisteredTo + "T23:59:59")}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let users = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, phone: usersTable.phone, role: usersTable.role })
      .from(usersTable)
      .where(where);

    // Apply name filter (comma-separated list, partial match)
    if (filterNames?.trim()) {
      const names = filterNames.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      users = users.filter(u => names.some(n => u.nickname?.toLowerCase().includes(n)));
    }
    // Apply email filter (comma-separated list, partial match)
    if (filterEmails?.trim()) {
      const emails = filterEmails.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
      users = users.filter(u => emails.some(e => u.email?.toLowerCase().includes(e)));
    }
    // Apply phone filter (comma-separated, partial match)
    if (filterPhones?.trim()) {
      const phones = filterPhones.split(",").map(p => p.trim()).filter(Boolean);
      users = users.filter(u => u.phone && phones.some(p => u.phone!.includes(p)));
    }
    // Apply OPC level filter — requires joining opc_profiles
    if (filterLevels?.trim()) {
      const levels = filterLevels.split(",").map(l => l.trim()).filter(Boolean);
      if (levels.length > 0) {
        const opcIds = (await db.execute(
          sql`SELECT user_id FROM opc_profiles WHERE level = ANY(${levels}::text[])`
        )).rows.map((r: any) => r.user_id as number);
        const idSet = new Set(opcIds);
        users = users.filter(u => idSet.has(u.id));
      }
    }

    // Filter out users with no email
    users = users.filter(u => !!u.email);

    if (users.length === 0) {
      return res.json({ total: 0, message: "没有符合条件的用户" });
    }

    const FROM = "接单吧 <jiedanba@opcorder.com>";
    const jobs = users.map(u => ({ email: u.email!, nickname: u.nickname ?? u.email! }));
    const total = jobs.length;
    const operatorId = req.user?.id;

    res.status(202).json({ total, message: `群发任务已启动，共 ${total} 位收件人，正在后台发送` });

    await writeSystemLog("info", "email", `群发邮件任务开始：${subject!.trim()}`, { subject: subject!.trim(), total }, operatorId);

    sendBatchedEmails(jobs, subject!.trim(), body!.trim(), FROM)
      .then(async ({ sent, failed, skipped, failedEmails }) => {
        logger.info({ sent, failed, skipped, total }, "Bulk email job completed");
        const level = failed > 0 ? "warn" : "info";
        await writeSystemLog(level, "email", `群发邮件任务完成：${subject!.trim()}`, {
          subject: subject!.trim(), total, sent, failed, skipped,
          ...(failedEmails.length > 0 ? { failedEmails } : {}),
        }, operatorId);
      })
      .catch(async (err) => {
        logger.error({ err }, "Bulk email job failed");
        await writeSystemLog("error", "email", `群发邮件任务异常：${subject!.trim()}`, { subject: subject!.trim(), error: err instanceof Error ? err.message : String(err) }, operatorId);
      });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "群发邮件失败" });
  }
});

/* ─── BULK NOTIFY (in-app) ─────────────────────── */

router.post("/admin/users/bulk-notify", async (req, res) => {
  try {
    const {
      title, content,
      filterRole, filterStatus,
      filterNames, filterEmails, filterPhones, filterLevels,
      filterRegisteredFrom, filterRegisteredTo,
    } = req.body as {
      title?: string; content?: string;
      filterRole?: string; filterStatus?: string;
      filterNames?: string; filterEmails?: string; filterPhones?: string;
      filterLevels?: string;
      filterRegisteredFrom?: string; filterRegisteredTo?: string;
    };

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "标题和内容不能为空" });
    }

    const conditions: any[] = [];
    if (filterRole && filterRole !== "all") conditions.push(eq(usersTable.role, filterRole as any));
    if (filterStatus && filterStatus !== "all") conditions.push(eq(usersTable.status, filterStatus as any));
    if (filterRegisteredFrom?.trim()) conditions.push(sql`${usersTable.createdAt} >= ${new Date(filterRegisteredFrom)}`);
    if (filterRegisteredTo?.trim()) conditions.push(sql`${usersTable.createdAt} <= ${new Date(filterRegisteredTo + "T23:59:59")}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    let users = await db.select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, phone: usersTable.phone }).from(usersTable).where(where);

    if (filterNames?.trim()) {
      const names = filterNames.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      users = users.filter(u => names.some(n => u.nickname?.toLowerCase().includes(n)));
    }
    if (filterEmails?.trim()) {
      const emails = filterEmails.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
      users = users.filter(u => emails.some(e => u.email?.toLowerCase().includes(e)));
    }
    if (filterPhones?.trim()) {
      const phones = filterPhones.split(",").map(p => p.trim()).filter(Boolean);
      users = users.filter(u => u.phone && phones.some(p => u.phone!.includes(p)));
    }
    if (filterLevels?.trim()) {
      const levels = filterLevels.split(",").map(l => l.trim()).filter(Boolean);
      if (levels.length > 0) {
        const opcIds = (await db.execute(
          sql`SELECT user_id FROM opc_profiles WHERE level = ANY(${levels}::text[])`
        )).rows.map((r: any) => r.user_id as number);
        const idSet = new Set(opcIds);
        users = users.filter(u => idSet.has(u.id));
      }
    }

    if (users.length === 0) {
      return res.json({ sent: 0, total: 0, message: "没有符合条件的用户" });
    }

    await db.insert(notificationsTable).values(
      users.map(u => ({
        userId: u.id,
        type: "system" as const,
        title: title.trim(),
        content: content.trim(),
      }))
    );

    return res.json({ sent: users.length, total: users.length });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "群发站内信失败" });
  }
});

/* ─── BULK EMAIL (Training) ─────────────────────── */

router.post("/admin/training/courses/:courseId/bulk-email", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId as string);
    const { subject, body, filterNames, filterPaymentStatus } = req.body as {
      subject?: string;
      body?: string;
      filterNames?: string;
      filterPaymentStatus?: string;
    };

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "邮件主题和正文不能为空" });
    }

    const rows = await db.execute(sql`
      SELECT e.id, e.payment_status, u.nickname, u.email
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = ${courseId}
    `);
    let list = rows.rows as Array<{ id: number; payment_status: string; nickname: string; email: string }>;

    if (filterPaymentStatus && filterPaymentStatus !== "all") {
      list = list.filter(r => r.payment_status === filterPaymentStatus);
    }

    if (filterNames?.trim()) {
      const names = filterNames.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      list = list.filter(r => names.some(n => r.nickname?.toLowerCase().includes(n)));
    }

    if (list.length === 0) {
      return res.json({ total: 0, message: "没有符合条件的学员" });
    }

    const FROM = "接单吧 <jiedanba@opcorder.com>";
    const jobs = list.map(r => ({ email: r.email, nickname: r.nickname ?? r.email }));
    const total = jobs.length;
    const operatorId = req.user?.id;

    res.status(202).json({ total, message: `群发任务已启动，共 ${total} 位收件人，正在后台发送` });

    await writeSystemLog("info", "email", `课程群发邮件任务开始：${subject!.trim()}`, { subject: subject!.trim(), courseId, total }, operatorId);

    sendBatchedEmails(jobs, subject!.trim(), body!.trim(), FROM)
      .then(async ({ sent, failed, skipped, failedEmails }) => {
        logger.info({ sent, failed, skipped, total, courseId }, "Course bulk email job completed");
        const level = failed > 0 ? "warn" : "info";
        await writeSystemLog(level, "email", `课程群发邮件任务完成：${subject!.trim()}`, {
          subject: subject!.trim(), courseId, total, sent, failed, skipped,
          ...(failedEmails.length > 0 ? { failedEmails } : {}),
        }, operatorId);
      })
      .catch(async (err) => {
        logger.error({ err, courseId }, "Course bulk email job failed");
        await writeSystemLog("error", "email", `课程群发邮件任务异常：${subject!.trim()}`, { subject: subject!.trim(), courseId, error: err instanceof Error ? err.message : String(err) }, operatorId);
      });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "群发邮件失败" });
  }
});

/* ─── LEVEL CERT REVIEW ───────────────────────────── */

router.get("/admin/level-certs", async (req, res) => {
  try {
    const { status, catCategoryId } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const statusClause = (status && status !== "all")
      ? (status === "reviewed"
          ? sql`AND p.level_apply_status IN ('approved', 'downgraded')`
          : sql`AND p.level_apply_status = ${status}`)
      : sql``;
    const catClause = catCategoryId ? sql`AND p.cat_category_id = ${Number(catCategoryId)}` : sql``;

    const [countRow] = (await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM portfolios p
      WHERE p.apply_level IS NOT NULL ${statusClause} ${catClause}
    `)).rows as Array<{ total: number }>;

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
        p.cat_category_id,
        COALESCE(
          p.cat_category_id,
          (SELECT otc.cat_category_id FROM opc_track_certs otc
            WHERE otc.user_id = p.user_id AND otc.status = 'approved'
            ORDER BY otc.granted_at DESC NULLS LAST, otc.id DESC LIMIT 1),
          (SELECT p3.cat_category_id FROM portfolios p3
            WHERE p3.user_id = p.user_id AND p3.cat_category_id IS NOT NULL
              AND p3.level_apply_status = 'approved'
            ORDER BY p3.reviewed_at DESC NULLS LAST, p3.id DESC LIMIT 1)
        ) AS effective_cat_category_id,
        cc_eff.name AS effective_cat_category_name,
        (p.cat_category_id IS NULL AND cc_eff.id IS NOT NULL) AS cat_inferred,
        u.id AS user_id,
        u.nickname,
        u.email,
        op.level AS current_level,
        op.credit_score,
        (SELECT otc.level FROM opc_track_certs otc
          WHERE otc.user_id = p.user_id
            AND otc.cat_category_id = COALESCE(p.cat_category_id, cc_eff.id)
            AND otc.status = 'approved'
          LIMIT 1) AS track_current_level,
        (SELECT COUNT(*)::int FROM portfolios p2
          WHERE p2.user_id = p.user_id
            AND p2.apply_level IS NOT NULL
            AND (
              (p.cat_category_id IS NOT NULL AND p2.cat_category_id = p.cat_category_id)
              OR (p.cat_category_id IS NULL AND p2.cat_category_id IS NULL AND p2.type = p.type)
            )) AS apply_count,
        (SELECT json_agg(json_build_object(
            'apply_level', p2.apply_level,
            'note', p2.level_apply_note,
            'reviewed_at', p2.reviewed_at,
            'status', p2.level_apply_status
          ) ORDER BY p2.reviewed_at DESC)
          FROM portfolios p2
          WHERE p2.user_id = p.user_id
            AND p2.apply_level IS NOT NULL
            AND (
              (p.cat_category_id IS NOT NULL AND p2.cat_category_id = p.cat_category_id)
              OR (p.cat_category_id IS NULL AND p2.cat_category_id IS NULL AND p2.type = p.type)
            )
            AND p2.level_apply_status IN ('rejected', 'downgraded')
            AND p2.id != p.id) AS past_reviews
      FROM portfolios p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN opc_profiles op ON op.user_id = p.user_id
      LEFT JOIN LATERAL (
        SELECT cc.id, cc.name FROM cat_categories cc WHERE cc.id = COALESCE(
          p.cat_category_id,
          (SELECT otc.cat_category_id FROM opc_track_certs otc
            WHERE otc.user_id = p.user_id AND otc.status = 'approved'
            ORDER BY otc.granted_at DESC NULLS LAST, otc.id DESC LIMIT 1),
          (SELECT p3.cat_category_id FROM portfolios p3
            WHERE p3.user_id = p.user_id AND p3.cat_category_id IS NOT NULL
              AND p3.level_apply_status = 'approved'
            ORDER BY p3.reviewed_at DESC NULLS LAST, p3.id DESC LIMIT 1)
        ) LIMIT 1
      ) cc_eff ON TRUE
      WHERE p.apply_level IS NOT NULL ${statusClause} ${catClause}
      ORDER BY
        CASE p.level_apply_status WHEN 'pending' THEN 0 ELSE 1 END,
        p.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    return res.json({ data: rows.rows, total: Number(countRow?.total ?? 0), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取等级认证列表失败" });
  }
});

router.get("/admin/level-certs/categories", async (req, res) => {
  try {
    const rows = (await db.execute(sql`
      SELECT id, code, name FROM cat_categories WHERE is_active = true ORDER BY sort_order
    `)).rows;
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取赛道列表失败" });
  }
});

router.get("/admin/level-certs/:portfolioId/review-logs", async (req, res) => {
  try {
    const portfolioId = Number(req.params.portfolioId as string);
    if (isNaN(portfolioId)) return res.status(400).json({ error: "portfolioId 无效" });
    const rows = (await db.execute(sql`
      SELECT
        l.id, l.result, l.note, l.created_at,
        u.nickname AS admin_username, u.avatar AS admin_avatar
      FROM portfolio_review_logs l
      LEFT JOIN users u ON u.id = l.admin_id
      WHERE l.portfolio_id = ${portfolioId}
      ORDER BY l.created_at DESC
    `)).rows;
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取评审历史失败" });
  }
});

router.patch("/admin/level-certs/:portfolioId/category", async (req, res) => {
  try {
    const portfolioId = Number(req.params.portfolioId as string);
    const { catCategoryId, grantedLevel, tagIds } = req.body as { catCategoryId: number; grantedLevel?: string; tagIds?: number[] };
    if (!catCategoryId || isNaN(catCategoryId)) return res.status(400).json({ error: "catCategoryId 无效" });

    const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
    if (!portfolio) return res.status(404).json({ error: "作品不存在" });
    if (!portfolio.applyLevel) return res.status(400).json({ error: "该作品未发起等级申请" });
    if (portfolio.levelApplyStatus === "pending") return res.status(400).json({ error: "该申请尚未审核完成" });
    if (portfolio.levelApplyStatus === "rejected") return res.status(400).json({ error: "已拒绝的申请无需设置赛道" });

    const [catRow] = (await db.execute(sql`SELECT id, name FROM cat_categories WHERE id = ${catCategoryId} AND is_active = true`)).rows as Array<{ id: number; name: string }>;
    if (!catRow) return res.status(400).json({ error: "赛道不存在" });

    await db.update(portfoliosTable).set({ catCategoryId }).where(eq(portfoliosTable.id, portfolioId));

    if (portfolio.levelApplyStatus === "approved" || portfolio.levelApplyStatus === "downgraded") {
      const levelOrder: ("C" | "B" | "A")[] = ["C", "B", "A"];
      const applyLevel = portfolio.applyLevel as "A" | "B" | "C";
      let level: "C" | "B" | "A";
      if (portfolio.levelApplyStatus === "approved") {
        level = applyLevel;
      } else {
        if (grantedLevel && levelOrder.includes(grantedLevel as any) && grantedLevel !== applyLevel) {
          level = grantedLevel as "C" | "B" | "A";
        } else {
          const applyIdx = levelOrder.indexOf(applyLevel);
          level = levelOrder[Math.max(0, applyIdx - 1)];
        }
      }
      await db.execute(sql`
        INSERT INTO opc_track_certs (user_id, cat_category_id, level, certified_at, manually_granted)
        VALUES (${portfolio.userId}, ${catCategoryId}, ${level}, NOW(), TRUE)
        ON CONFLICT (user_id, cat_category_id)
        DO UPDATE SET level = EXCLUDED.level, manually_granted = TRUE, certified_at = NOW()
      `);
      logger.info({ portfolioId, catCategoryId, level, userId: portfolio.userId }, "admin set category + upserted opc_track_certs");

      // 写入二级标签
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await db.execute(sql`
            INSERT INTO opc_user_cat_tags (user_id, cat_tag_id, granted_at, source_portfolio_id)
            VALUES (${portfolio.userId}, ${tagId}, NOW(), ${portfolioId})
            ON CONFLICT (user_id, cat_tag_id) DO UPDATE SET granted_at = NOW(), source_portfolio_id = ${portfolioId}
          `);
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "设置赛道失败" });
  }
});

router.post("/admin/level-certs/:portfolioId/review", async (req, res) => {
  try {
    const portfolioId = Number(req.params.portfolioId as string);
    const { result, note, downgradeTo, tagIds } = req.body as {
      result: "approved" | "downgraded" | "rejected";
      note?: string;
      downgradeTo?: "A" | "B" | "C";
      tagIds?: number[];
    };

    const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
    if (!portfolio) return res.status(404).json({ error: "作品不存在" });
    if (!portfolio.applyLevel) return res.status(400).json({ error: "该作品未发起等级申请" });

    // 若作品未关联赛道，自动推断（静态映射 → AI）
    let effectiveCatId: number | null = portfolio.catCategoryId ?? null;
    if (!effectiveCatId && (result === "approved" || result === "downgraded")) {
      const allCats = (await db.execute(sql`
        SELECT id, code, name, description FROM cat_categories WHERE is_active = true ORDER BY sort_order
      `)).rows as Array<{ id: number; code: string; name: string; description: string }>;

      const inferred = await inferPortfolioCatCategory(
        { title: portfolio.title, type: portfolio.type ?? "", description: portfolio.description ?? "" },
        allCats
      );

      if (inferred) {
        effectiveCatId = inferred.id;
        // 同步写回 portfolio，方便后续查询保持一致
        await db.update(portfoliosTable)
          .set({ catCategoryId: effectiveCatId })
          .where(eq(portfoliosTable.id, portfolioId));
        logger.info({ portfolioId, catId: effectiveCatId, catName: inferred.name }, "level-cert review: auto-inferred cat category");
      } else {
        return res.status(400).json({
          error: "无法自动推断赛道分类，无法写入赛道认证记录。请先点击【AI推断赛道】或驳回后让 OPC 重新选择赛道分类。",
        });
      }
    }

    const applyLevel = portfolio.applyLevel as "A" | "B" | "C";
    const levelOrder: ("newbie" | "C" | "B" | "A")[] = ["newbie", "C", "B", "A"];
    const applyIdx = levelOrder.indexOf(applyLevel);

    // 获取该赛道当前认证等级用于校验（无记录则视为 newbie）
    const certRows = effectiveCatId
      ? (await db.execute(sql`SELECT level FROM opc_track_certs WHERE user_id = ${portfolio.userId} AND cat_category_id = ${effectiveCatId} LIMIT 1`)).rows
      : [];
    const currentLevel = ((certRows[0] as any)?.level ?? "newbie") as string;
    const currentIdx = levelOrder.indexOf(currentLevel as any);

    let grantedLevel: "newbie" | "C" | "B" | "A" = applyLevel;
    let notifTitle = "";
    let notifContent = "";

    if (result === "approved") {
      grantedLevel = applyLevel;
      // 校验：通过后等级必须高于当前赛道等级
      if (applyIdx <= currentIdx) {
        return res.status(400).json({ error: `该OPC在此赛道已持有 ${currentLevel} 级认证，不能通过低于或等于当前等级的申请` });
      }
      notifTitle = `🎉 赛道认证成功 · 升至 ${applyLevel} 级`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，认证通过！您在该赛道的等级已升至 ${applyLevel}级。${note ? `\n评审意见：${note}` : ""}`;
    } else if (result === "downgraded") {
      // 使用前端指定的降级目标，默认降一级
      if (downgradeTo && levelOrder.includes(downgradeTo)) {
        grantedLevel = downgradeTo;
      } else {
        const downIdx = Math.max(1, applyIdx - 1); // 最低 C 级（索引 1）
        grantedLevel = levelOrder[downIdx];
      }
      const grantIdx = levelOrder.indexOf(grantedLevel);
      // 校验：降级通过后等级必须高于当前赛道等级
      if (grantIdx <= currentIdx) {
        return res.status(400).json({ error: `该OPC在此赛道已持有 ${currentLevel} 级认证，无法降级通过至 ${grantedLevel} 级` });
      }
      notifTitle = `✅ 降级认证成功 · 获得 ${grantedLevel} 级`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，综合评估后授予 ${grantedLevel}级认证（您申请的是 ${applyLevel}级）。${note ? `\n评审意见：${note}` : ""}`;
    } else {
      notifTitle = `📝 赛道申请评审结果：还需努力`;
      notifContent = `您提交的作品「${portfolio.title}」经平台专家评审，暂未达到 ${applyLevel}级认证标准，请继续积累项目经验后再次申请。${note ? `\n评审意见：${note}` : ""}`;
    }

    await db.update(portfoliosTable).set({
      levelApplyStatus: result,
      levelApplyNote: note ?? null,
      reviewedAt: new Date(),
    }).where(eq(portfoliosTable.id, portfolioId));

    // 写入评审历史日志（每次评审都记录，不覆盖）
    const adminId = req.user?.id ?? null;
    await db.insert(portfolioReviewLogsTable).values({
      portfolioId,
      adminId,
      result,
      note: note ?? null,
    });

    // 写入赛道认证记录（通过/降级通过时）
    if ((result === "approved" || result === "downgraded") && effectiveCatId) {
      await db.execute(sql`
        INSERT INTO opc_track_certs (user_id, cat_category_id, level, status, certified_at, manually_granted)
        VALUES (${portfolio.userId}, ${effectiveCatId}, ${grantedLevel}, 'active', NOW(), FALSE)
        ON CONFLICT (user_id, cat_category_id)
        DO UPDATE SET level = EXCLUDED.level, certified_at = NOW(), manually_granted = FALSE
      `);
    }

    // 写入二级标签（仅通过/降级通过时，忽略拒绝）
    if (result !== "rejected" && tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await db.execute(sql`
          INSERT INTO opc_user_cat_tags (user_id, cat_tag_id, granted_at, source_portfolio_id)
          VALUES (${portfolio.userId}, ${tagId}, NOW(), ${portfolioId})
          ON CONFLICT (user_id, cat_tag_id) DO UPDATE SET granted_at = NOW(), source_portfolio_id = ${portfolioId}
        `);
      }
    }

    await db.insert(notificationsTable).values({
      userId: portfolio.userId,
      type: "system",
      title: notifTitle,
      content: notifContent,
      relatedId: portfolioId,
      relatedType: "portfolio",
    });

    return res.json({ ok: true, grantedLevel: result !== "rejected" ? grantedLevel : null });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "评审操作失败" });
  }
});

/* ─── CREDIT LEVELS CRUD ──────────────────────────── */

router.get("/admin/credit-levels", async (req, res) => {
  try {
    const rows = await db.select().from(creditLevelsTable).orderBy(asc(creditLevelsTable.sortOrder), asc(creditLevelsTable.id));
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取信用等级列表失败" });
  }
});

router.post("/admin/credit-levels", async (req, res) => {
  try {
    const { name, minPoints, sortOrder, color, isActive } = req.body as {
      name: string; minPoints?: number; sortOrder?: number; color?: string; isActive?: boolean;
    };
    if (!name?.trim()) return res.status(400).json({ error: "名称不能为空" });
    const autoCode = `level_${Date.now().toString(36)}`;
    const [row] = await db.insert(creditLevelsTable).values({
      code: autoCode,
      name: name.trim(),
      minPoints: minPoints ?? 0,
      sortOrder: sortOrder ?? 0,
      color: color ?? null,
      isActive: isActive ?? true,
    }).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "创建信用等级失败" });
  }
});

router.put("/admin/credit-levels/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, minPoints, sortOrder, color, isActive } = req.body as {
      name?: string; minPoints?: number; sortOrder?: number; color?: string; isActive?: boolean;
    };
    const [row] = await db.update(creditLevelsTable).set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(minPoints !== undefined ? { minPoints } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }).where(eq(creditLevelsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "等级不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "更新信用等级失败" });
  }
});

router.delete("/admin/credit-levels/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [inUse] = (await db.execute(sql`SELECT 1 FROM opc_profiles WHERE credit_level_id = ${id} LIMIT 1`)).rows;
    if (inUse) return res.status(400).json({ error: "该等级已被 OPC 账号使用，无法删除" });
    const [row] = await db.delete(creditLevelsTable).where(eq(creditLevelsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "等级不存在" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "删除信用等级失败" });
  }
});

router.put("/admin/users/:id/credit-level", async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { creditLevelId, creditPoints } = req.body as { creditLevelId?: number | null; creditPoints?: number | null };
    await db.execute(sql`
      UPDATE opc_profiles
      SET credit_level_id = ${creditLevelId ?? null},
          credit_points   = ${creditPoints ?? null}
      WHERE user_id = ${userId}
    `);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "设置信用等级失败" });
  }
});

router.get("/admin/users/:id/opc-detail", async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string, 10);

    const [opcRow] = (await db.execute(sql`
      SELECT
        op.credit_level_id,
        op.credit_points,
        cl.name  AS credit_level_name,
        cl.color AS credit_level_color
      FROM opc_profiles op
      LEFT JOIN credit_levels cl ON cl.id = op.credit_level_id
      WHERE op.user_id = ${userId}
    `)).rows as Array<{
      credit_level_id: number | null;
      credit_points: number | null;
      credit_level_name: string | null;
      credit_level_color: string | null;
    }>;

    if (!opcRow) return res.status(404).json({ error: "该用户无OPC档案" });

    const trackCerts = (await db.execute(sql`
      SELECT
        otc.id,
        otc.cat_category_id,
        cc.name AS cat_category_name,
        otc.level,
        otc.status,
        otc.certified_at
      FROM opc_track_certs otc
      LEFT JOIN cat_categories cc ON cc.id = otc.cat_category_id
      WHERE otc.user_id = ${userId}
      ORDER BY otc.certified_at DESC
    `)).rows;

    return res.json({
      creditLevelId: opcRow.credit_level_id,
      creditPoints: opcRow.credit_points ?? 0,
      creditLevelName: opcRow.credit_level_name,
      creditLevelColor: opcRow.credit_level_color,
      trackCerts,
    });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取OPC详情失败" });
  }
});

/* ─── CONTENT REVIEW ──────────────────────────────── */

router.get("/admin/content", async (req, res) => {
  try {
    const { q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (q) conditions.push(or(
      ilike(postsTable.title, `%${q}%`),
      ilike(postsTable.content, `%${q}%`),
      sql`${postsTable.authorId} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${q}%`})`,
    ));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(postsTable).where(where);

    const posts = await db.select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      tags: postsTable.tags,
      likesCount: postsTable.likesCount,
      commentsCount: postsTable.commentsCount,
      viewsCount: postsTable.viewsCount,
      isFeatured: postsTable.isFeatured,
      authorId: postsTable.authorId,
      createdAt: postsTable.createdAt,
    })
      .from(postsTable)
      .where(where)
      .orderBy(desc(postsTable.createdAt))
      .limit(pageSize).offset(offset);

    const enriched = await Promise.all(posts.map(async (p) => {
      const [author] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, p.authorId)).limit(1);
      return { ...p, authorName: author?.nickname ?? "—" };
    }));

    return res.json({ data: enriched, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取内容列表失败" });
  }
});

router.patch("/admin/content/:postId/feature", async (req, res) => {
  try {
    const id = Number(req.params.postId as string);
    const { isFeatured } = req.body as { isFeatured: boolean };
    await db.update(postsTable).set({ isFeatured }).where(eq(postsTable.id, id));
    return res.json({ ok: true, isFeatured });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.delete("/admin/content/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    await db.execute(sql`DELETE FROM post_comments WHERE post_id = ${id}`);
    await db.execute(sql`DELETE FROM post_likes WHERE post_id = ${id}`);
    await db.delete(postsTable).where(eq(postsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "删除失败" });
  }
});

router.get("/admin/content/comments", async (req, res) => {
  try {
    const { q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    const conditions = [];
    if (q) conditions.push(or(
      ilike(postCommentsTable.content, `%${q}%`),
      sql`${postCommentsTable.authorId} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${q}%`})`,
    ));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(postCommentsTable).where(where);

    const comments = await db
      .select({
        id: postCommentsTable.id,
        postId: postCommentsTable.postId,
        content: postCommentsTable.content,
        authorId: postCommentsTable.authorId,
        createdAt: postCommentsTable.createdAt,
        postTitle: postsTable.title,
        authorName: usersTable.nickname,
      })
      .from(postCommentsTable)
      .where(where)
      .leftJoin(postsTable, eq(postCommentsTable.postId, postsTable.id))
      .leftJoin(usersTable, eq(postCommentsTable.authorId, usersTable.id))
      .orderBy(desc(postCommentsTable.createdAt))
      .limit(pageSize).offset(offset);

    return res.json({ data: comments, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取评论列表失败" });
  }
});

router.delete("/admin/content/comments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const [comment] = await db.select({ postId: postCommentsTable.postId }).from(postCommentsTable).where(eq(postCommentsTable.id, id)).limit(1);
    if (!comment) return res.status(404).json({ error: "评论不存在" });
    await db.delete(postCommentsTable).where(eq(postCommentsTable.id, id));
    await db.update(postsTable)
      .set({ commentsCount: sql`GREATEST(0, ${postsTable.commentsCount} - 1)` })
      .where(eq(postsTable.id, comment.postId));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "删除失败" });
  }
});

/* ─── CHANGE PASSWORD ───────────────────────────── */

router.post("/admin/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "请填写当前密码和新密码" });
    if (newPassword.length < 6) return res.status(400).json({ error: "新密码至少6位" });

    const userId = req.user!.id;
    const [user] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "用户不存在" });

    const { compare, hash } = await import("bcryptjs");
    const valid = await compare(currentPassword, user.passwordHash!);
    if (!valid) return res.status(401).json({ error: "当前密码错误" });

    const newHash = await hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "修改密码失败" });
  }
});

/* ─── SENSITIVE WORDS ───────────────────────────── */

router.get("/admin/sensitive-words", async (_req, res) => {
  try {
    const words = await db.select().from(sensitiveWordsTable).orderBy(sensitiveWordsTable.createdAt);
    return res.json(words);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取敏感词失败" });
  }
});

router.post("/admin/sensitive-words", async (req, res) => {
  try {
    const { word } = req.body as { word: string };
    if (!word || !word.trim()) return res.status(400).json({ error: "敏感词不能为空" });
    const [row] = await db.insert(sensitiveWordsTable).values({ word: word.trim().toLowerCase() }).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "该敏感词已存在" });
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "添加失败" });
  }
});

router.delete("/admin/sensitive-words/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    await db.delete(sensitiveWordsTable).where(eq(sensitiveWordsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "删除失败" });
  }
});

/* ─── SITE SETTINGS ─────────────────────────────── */

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name:    "接单吧",
  site_subtitle: "OPC撮合交易平台",
  site_logo:    "",
  site_favicon: "",
  footer_text:  "© 2026 接单吧 · 海创元 × 东升原点OPC社区",
  icp_number:   "京ICP备2025138186号-5",
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
  welcome_email_subject:   "【接单吧】欢迎加入 OPC 撮合交易平台",
  welcome_email_body:      "欢迎加入接单吧！我们是专注 OPC 超级个体的撮合交易平台，更多功能正在持续开发与上线中，敬请期待。",
  welcome_email_group_tip: "扫码加入官方微信交流群，与更多 OPC 伙伴一起交流成长：",
  wechat_group_qr:         "",
  opc_welcome_email_subject:   "【接单吧】欢迎成为 OPC 超级个体",
  opc_welcome_email_body:      "欢迎加入接单吧！您已成功注册为 OPC 超级个体，平台将为您精准匹配优质需求，助力您的业务成长，敬请期待更多功能上线。",
  opc_welcome_email_group_tip: "扫码加入 OPC 专属交流群，与更多超级个体一起交流成长：",
  opc_wechat_group_qr:         "",
  legal_terms_updated:     "2026 年 1 月 1 日",
  legal_terms_content:     "",
  legal_privacy_updated:   "2026 年 1 月 1 日",
  legal_privacy_content:   "",
};

router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) result[row.key] = row.value ?? "";
    return res.json(result);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取站点设置失败" });
  }
});

const LEGAL_CONTENT_KEYS = new Set(["legal_terms_content", "legal_privacy_content"]);

function stripDangerousHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/javascript\s*:/gi, "about:");
}

router.put("/admin/settings", async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, rawValue] of Object.entries(updates)) {
      const value = LEGAL_CONTENT_KEYS.has(key) ? stripDangerousHtml(String(rawValue)) : rawValue;
      await db
        .insert(siteSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "保存站点设置失败" });
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
    return res.json(await loadSettings());
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取站点设置失败" });
  }
});

/* ─── ANNOUNCEMENTS ─────────────────────────────── */

router.get("/admin/announcements", requireAdmin, requirePermission("settings"), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.createdAt));
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取公告列表失败" });
  }
});

router.post("/admin/announcements", requireAdmin, requirePermission("settings"), async (req, res) => {
  try {
    const { title, fileUrl, fileName, fileType, isPinned } = req.body as {
      title?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      isPinned?: boolean;
    };
    if (!title?.trim()) return res.status(400).json({ error: "公告标题不能为空" });
    const [row] = await db
      .insert(announcementsTable)
      .values({
        title: title.trim(),
        fileUrl: fileUrl ?? null,
        fileName: fileName ?? null,
        fileType: fileType ?? null,
        isPinned: isPinned ?? false,
      })
      .returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "发布公告失败" });
  }
});

router.patch("/admin/announcements/:id", requireAdmin, requirePermission("settings"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, fileUrl, fileName, fileType, isPinned } = req.body as {
      title?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      isPinned?: boolean;
    };
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title.trim();
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
    if (fileName !== undefined) updateData.fileName = fileName;
    if (fileType !== undefined) updateData.fileType = fileType;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    const [row] = await db
      .update(announcementsTable)
      .set(updateData)
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "公告不存在" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "更新公告失败" });
  }
});

router.delete("/admin/announcements/:id", requireAdmin, requirePermission("settings"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "删除公告失败" });
  }
});

/* ─── PUBLIC: Announcements (no auth required) ─── */

router.get("/announcements", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.createdAt));
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取公告列表失败" });
  }
});

/* ─── LEARNING RESOURCES ─────────────────────────── */

router.get("/admin/learning-resources", async (_req, res) => {
  try {
    const rows = await db.select().from(learningResourcesTable).orderBy(learningResourcesTable.sortOrder, learningResourcesTable.createdAt);
    return res.json(rows);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取学习资源失败" });
  }
});

router.post("/admin/learning-resources", async (req, res) => {
  try {
    const { title, fileUrl, fileType, fileSize, description, sortOrder } = req.body as Record<string, unknown>;
    if (!title || !fileUrl) {
      return res.status(400).json({ error: "标题和文件地址为必填项" });
      return;
    }
    const [row] = await db.insert(learningResourcesTable).values({
      title: String(title),
      fileUrl: String(fileUrl),
      fileType: fileType ? String(fileType) : "file",
      fileSize: fileSize != null ? Number(fileSize) : null,
      description: description != null && String(description).trim() ? String(description).trim() : null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "创建学习资源失败" });
  }
});

router.put("/admin/learning-resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { title, fileUrl, fileType, fileSize, description, sortOrder } = req.body as Record<string, unknown>;
    await db.update(learningResourcesTable).set({
      title: String(title || ""),
      fileUrl: String(fileUrl || ""),
      fileType: fileType ? String(fileType) : "file",
      fileSize: fileSize != null ? Number(fileSize) : null,
      description: description != null ? String(description) : null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    }).where(eq(learningResourcesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "更新学习资源失败" });
  }
});

router.delete("/admin/learning-resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    await db.delete(learningResourcesTable).where(eq(learningResourcesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "删除学习资源失败" });
  }
});

/* ─── DEMAND PAYMENT MANAGEMENT ───────────────────── */

router.get("/admin/demand-payments", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };

    const VALID_PAYMENT_STATUSES = ["all", "pending", "confirmed", "rejected"] as const;
    type PaymentStatus = "pending" | "confirmed" | "rejected";
    if (status && !VALID_PAYMENT_STATUSES.includes(status as typeof VALID_PAYMENT_STATUSES[number])) {
      return res.status(400).json({ error: `status 参数无效，允许值：${VALID_PAYMENT_STATUSES.join(", ")}` });
    }

    const rows = await db
      .select({
        id: demandPaymentsTable.id,
        demandId: demandPaymentsTable.demandId,
        demandTitle: demandsTable.title,
        publisherName: usersTable.nickname,
        publisherEmail: usersTable.email,
        publisherPhone: usersTable.phone,
        amount: demandPaymentsTable.amount,
        method: demandPaymentsTable.method,
        status: demandPaymentsTable.status,
        receiptUrl: demandPaymentsTable.receiptUrl,
        paymentNote: demandPaymentsTable.paymentNote,
        rejectReason: demandPaymentsTable.rejectReason,
        confirmedAt: demandPaymentsTable.confirmedAt,
        createdAt: demandPaymentsTable.createdAt,
      })
      .from(demandPaymentsTable)
      .leftJoin(demandsTable, eq(demandPaymentsTable.demandId, demandsTable.id))
      .leftJoin(usersTable, eq(demandsTable.publisherId, usersTable.id))
      .where(
        status && status !== "all"
          ? and(eq(demandPaymentsTable.method, "offline"), eq(demandPaymentsTable.status, status as PaymentStatus))
          : eq(demandPaymentsTable.method, "offline")
      )
      .orderBy(desc(demandPaymentsTable.createdAt));

    return res.json(rows.map(r => ({
      ...r,
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "获取缴费记录失败" });
  }
});

router.patch("/admin/demand-payments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);

    const parsed = ReviewDemandPaymentBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "请求参数无效", details: parsed.error.flatten().fieldErrors });
    }
    const { action, rejectReason } = parsed.data;

    const [payment] = await db
      .select({
        id: demandPaymentsTable.id,
        demandId: demandPaymentsTable.demandId,
        amount: demandPaymentsTable.amount,
        status: demandPaymentsTable.status,
      })
      .from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.id, id))
      .limit(1);

    if (!payment) return res.status(404).json({ error: "缴费记录不存在" });

    // State guard: only allow transitions from pending state
    if (payment.status !== "pending") {
      return res.status(409).json({ error: "该缴费记录已处理，不可重复审核" });
    }

    const [demand] = await db
      .select({ publisherId: demandsTable.publisherId, title: demandsTable.title, status: demandsTable.status })
      .from(demandsTable)
      .where(eq(demandsTable.id, payment.demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "关联需求不存在" });

    // Only publish if demand is still pending_payment
    if (action === "confirm" && demand.status !== "pending_payment") {
      return res.status(409).json({ error: "需求当前状态不允许发布" });
    }

    if (action === "reject" && (!rejectReason || !rejectReason.trim())) {
      return res.status(400).json({ error: "拒绝操作必须填写原因" });
    }

    const adminId = req.user!.id;

    // Wrap payment status update, demand status update, and notification in a transaction
    // to ensure atomicity — partial updates cannot leave payment/demand in inconsistent state
    await db.transaction(async (tx) => {
      if (action === "confirm") {
        const now = new Date();
        await tx.update(demandPaymentsTable).set({
          status: "confirmed",
          confirmedAt: now,
          confirmedBy: adminId,
        }).where(eq(demandPaymentsTable.id, id));

        await tx.update(demandsTable).set({
          status: "published",
          updatedAt: now,
        }).where(eq(demandsTable.id, payment.demandId));

        await tx.insert(notificationsTable).values({
          userId: demand.publisherId,
          type: "system",
          title: "保证金已到账，需求已发布",
          content: `您的需求「${demand.title}」的保证金已到账确认，需求现已在需求大厅公开发布，OPC可以查看并投标。`,
          relatedId: payment.demandId,
          relatedType: "demand",
        });
      } else {
        const reasonText = rejectReason?.trim() ?? "保证金信息有误，请重新提交";
        await tx.update(demandPaymentsTable).set({
          status: "rejected",
          rejectReason: reasonText,
        }).where(eq(demandPaymentsTable.id, id));

        await tx.insert(notificationsTable).values({
          userId: demand.publisherId,
          type: "system",
          title: "保证金审核未通过",
          content: `您的需求「${demand.title}」的保证金审核未通过。原因：${reasonText}。请在需求详情页重新提交缴费凭证。`,
          relatedId: payment.demandId,
          relatedType: "demand",
        });
      }
    });

    const [updated] = await db
      .select({
        id: demandPaymentsTable.id,
        demandId: demandPaymentsTable.demandId,
        amount: demandPaymentsTable.amount,
        method: demandPaymentsTable.method,
        status: demandPaymentsTable.status,
        receiptUrl: demandPaymentsTable.receiptUrl,
        paymentNote: demandPaymentsTable.paymentNote,
        rejectReason: demandPaymentsTable.rejectReason,
        confirmedAt: demandPaymentsTable.confirmedAt,
        createdAt: demandPaymentsTable.createdAt,
      })
      .from(demandPaymentsTable)
      .where(eq(demandPaymentsTable.id, id))
      .limit(1);

    return res.json({
      ...updated,
      confirmedAt: updated!.confirmedAt?.toISOString() ?? null,
      createdAt: updated!.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err: err }, "Route handler error");
    return res.status(500).json({ error: "操作失败" });
  }
});

/* ─── DEMAND DEPOSIT REFUND WORKFLOW ───────────────────── */

/** List all demand deposit refund requests (pending, refunding, refunded) */
router.get("/admin/demand-refunds", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query as Record<string, string | string[] | undefined>);

    type RefundableStatus = "refund_pending" | "refunding" | "refunded";
    const REFUNDABLE_STATUSES: RefundableStatus[] = ["refund_pending", "refunding", "refunded"];
    const isRefundableStatus = (s: string): s is RefundableStatus => REFUNDABLE_STATUSES.includes(s as RefundableStatus);

    const conditions = [
      sql`${demandsTable.status} IN ('refund_pending', 'refunding', 'refunded')`,
    ];
    if (status && status !== "all" && isRefundableStatus(status)) {
      conditions.push(eq(demandsTable.status, status));
    }
    const where = and(...conditions);

    const [{ total }] = await db.select({ total: count() }).from(demandsTable).where(where);

    const demands = await db
      .select({
        id: demandsTable.id,
        demandNo: demandsTable.demandNo,
        title: demandsTable.title,
        status: demandsTable.status,
        budget: demandsTable.budget,
        budgetMin: demandsTable.budgetMin,
        budgetMax: demandsTable.budgetMax,
        publisherId: demandsTable.publisherId,
        createdAt: demandsTable.createdAt,
        updatedAt: demandsTable.updatedAt,
      })
      .from(demandsTable)
      .where(where)
      .orderBy(desc(demandsTable.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const enriched = await Promise.all(demands.map(async (d) => {
      const [pub] = await db.select({ nickname: usersTable.nickname, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, d.publisherId)).limit(1);
      const [payment] = await db.select({
        id: demandPaymentsTable.id,
        method: demandPaymentsTable.method,
        status: demandPaymentsTable.status,
        amount: demandPaymentsTable.amount,
        refundReason: demandPaymentsTable.refundReason,
        refundRequestedAt: demandPaymentsTable.refundRequestedAt,
        refundRejectReason: demandPaymentsTable.refundRejectReason,
        refundReceiptUrl: demandPaymentsTable.refundReceiptUrl,
        refundOrderNo: demandPaymentsTable.refundOrderNo,
        refundedAt: demandPaymentsTable.refundedAt,
        paymentOrderNo: demandPaymentsTable.paymentOrderNo,
        receiptUrl: demandPaymentsTable.receiptUrl,
      }).from(demandPaymentsTable)
        .where(eq(demandPaymentsTable.demandId, d.id))
        .orderBy(desc(demandPaymentsTable.createdAt))
        .limit(1);
      return {
        ...d,
        publisherName: pub?.nickname ?? "—",
        publisherEmail: pub?.email ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        payment: payment ? {
          ...payment,
          refundRequestedAt: payment.refundRequestedAt?.toISOString() ?? null,
          refundedAt: payment.refundedAt?.toISOString() ?? null,
        } : null,
      };
    }));

    return res.json({ data: enriched, total: Number(total), page, pageSize });
  } catch (err) {
    logger.error({ err: err }, "[admin-demand-refunds]");
    return res.status(500).json({ error: "获取退款列表失败" });
  }
});

/** Admin approves a publisher's refund request */
router.post("/admin/demands/:id/approve-refund", requireAdmin, async (req, res) => {
  try {
    const demandId = Number(req.params.id as string);

    const [demand] = await db
      .select()
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.status !== "refund_pending") {
      return res.status(409).json({ error: "该需求当前不处于退款审核中" });
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "refund_pending")))
      .limit(1);

    if (!payment) return res.status(404).json({ error: "未找到退款审核中的保证金记录" });

    const now = new Date();

    if (payment.method === "online") {
      if (!payment.paymentOrderNo) {
        return res.status(400).json({ error: "在线支付记录缺少订单号，无法发起退款" });
      }
      const amountFen = Math.round((payment.amount ?? 0) * 100);
      const businessOrderNo = `REFUND-${payment.id}-${Date.now()}`;

      const refundResult = await createRefund({
        paymentOrderNo: payment.paymentOrderNo,
        amount: amountFen,
        reason: payment.refundReason ?? "需求保证金退款",
        businessOrderNo,
        notifyUrl: "https://www.opcorder.com/api/payment/refund-callback",
        needAudit: false,
      });

      await db.transaction(async (tx) => {
        await tx.update(demandPaymentsTable).set({
          status: "refunding",
          refundOrderNo: refundResult.refundOrderNo,
        }).where(eq(demandPaymentsTable.id, payment.id));

        await tx.update(demandsTable).set({ status: "refunding", updatedAt: now })
          .where(eq(demandsTable.id, demandId));

        const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);

        if (demand.publisherId) {
          await tx.insert(notificationsTable).values({
            userId: demand.publisherId, type: "system",
            title: "退款申请已通过，退款处理中",
            content: `您对需求「${demand.title}」的退款申请已获批准，退款正在处理中，预计1-5个工作日到账，请耐心等待。`,
            relatedId: demandId, relatedType: "demand",
          });
        }
        if (pub?.email) {
          await resend.emails.send({
            from: "接单吧 <noreply@opcorder.com>", to: pub.email,
            subject: `退款处理中 — 需求「${demand.title}」`,
            html: buildBulkEmail(pub.nickname ?? pub.email, `您申请的需求「${demand.title}」保证金退款申请已获批准，退款正在处理中，预计1-5个工作日到账，请耐心等待。`),
          }).catch(() => {});
        }
      });

      return res.json({ success: true, refundOrderNo: refundResult.refundOrderNo });
    }

    // Offline payment — just move to refunding, admin will upload receipt later
    await db.transaction(async (tx) => {
      await tx.update(demandPaymentsTable).set({ status: "refunding" })
        .where(eq(demandPaymentsTable.id, payment.id));
      await tx.update(demandsTable).set({ status: "refunding", updatedAt: now })
        .where(eq(demandsTable.id, demandId));

      const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);

      if (demand.publisherId) {
        await tx.insert(notificationsTable).values({
          userId: demand.publisherId, type: "system",
          title: "退款申请已通过，等待线下退款",
          content: `您对需求「${demand.title}」的退款申请已获批准，工作人员将通过线下方式退还保证金，请留意后续通知。`,
          relatedId: demandId, relatedType: "demand",
        });
      }
      if (pub?.email) {
        await resend.emails.send({
          from: "接单吧 <noreply@opcorder.com>", to: pub.email,
          subject: `退款已批准 — 需求「${demand.title}」`,
          html: buildBulkEmail(pub.nickname ?? pub.email, `您申请的需求「${demand.title}」保证金退款申请已获批准，工作人员将通过线下方式退还保证金，请留意后续通知。`),
        }).catch(() => {});
      }
    });

    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    logger.error({ err: err }, "[admin-approve-refund] error:");
    return res.status(500).json({ error: msg });
  }
});

/** Admin rejects a publisher's refund request */
router.post("/admin/demands/:id/reject-refund", requireAdmin, async (req, res) => {
  try {
    const demandId = Number(req.params.id as string);
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) return res.status(400).json({ error: "请填写拒绝原因" });

    const [demand] = await db
      .select()
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.status !== "refund_pending") {
      return res.status(409).json({ error: "该需求当前不处于退款审核中" });
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "refund_pending")))
      .limit(1);

    if (!payment) return res.status(404).json({ error: "未找到退款审核中的保证金记录" });

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(demandPaymentsTable).set({
        status: "confirmed",
        refundRejectReason: reason.trim(),
      }).where(eq(demandPaymentsTable.id, payment.id));

      await tx.update(demandsTable).set({ status: "published", updatedAt: now })
        .where(eq(demandsTable.id, demandId));

      const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);

      if (demand.publisherId) {
        await tx.insert(notificationsTable).values({
          userId: demand.publisherId, type: "system",
          title: "退款申请未通过",
          content: `您对需求「${demand.title}」的退款申请未获批准。原因：${reason.trim()}。如有疑问请联系平台客服。`,
          relatedId: demandId, relatedType: "demand",
        });
      }
      if (pub?.email) {
        await resend.emails.send({
          from: "接单吧 <noreply@opcorder.com>", to: pub.email,
          subject: `退款申请未通过 — 需求「${demand.title}」`,
          html: buildBulkEmail(pub.nickname ?? pub.email, `您申请的需求「${demand.title}」保证金退款申请未获批准。\n\n拒绝原因：${reason.trim()}\n\n如有疑问，请联系平台客服。`),
        }).catch(() => {});
      }
    });

    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    logger.error({ err: err }, "[admin-reject-refund] error:");
    return res.status(500).json({ error: msg });
  }
});

/** Admin confirms an offline refund by uploading a receipt */
router.post("/admin/demands/:id/confirm-offline-refund", requireAdmin, async (req, res) => {
  try {
    const demandId = Number(req.params.id as string);
    const { refundReceiptUrl } = req.body as { refundReceiptUrl?: string };
    if (!refundReceiptUrl?.trim()) return res.status(400).json({ error: "请上传退款凭证" });

    const [demand] = await db
      .select()
      .from(demandsTable)
      .where(eq(demandsTable.id, demandId))
      .limit(1);

    if (!demand) return res.status(404).json({ error: "需求不存在" });
    if (demand.status !== "refunding") {
      return res.status(409).json({ error: "该需求当前不处于退款中状态" });
    }

    const [payment] = await db
      .select()
      .from(demandPaymentsTable)
      .where(and(eq(demandPaymentsTable.demandId, demandId), eq(demandPaymentsTable.status, "refunding")))
      .limit(1);

    if (!payment) return res.status(404).json({ error: "未找到退款中的保证金记录" });
    if (payment.method !== "offline") {
      return res.status(400).json({ error: "只有线下支付的退款才需要手动确认" });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(demandPaymentsTable).set({
        status: "refunded",
        refundReceiptUrl: refundReceiptUrl.trim(),
        refundedAt: now,
      }).where(eq(demandPaymentsTable.id, payment.id));

      await tx.update(demandsTable).set({ status: "refunded", updatedAt: now })
        .where(eq(demandsTable.id, demandId));

      const [pub] = await tx.select({ nickname: usersTable.nickname, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, demand.publisherId)).limit(1);

      if (demand.publisherId) {
        await tx.insert(notificationsTable).values({
          userId: demand.publisherId, type: "system",
          title: "保证金已退款",
          content: `您的需求「${demand.title}」的保证金已成功退还，请确认到账情况。如有问题请联系平台客服。`,
          relatedId: demandId, relatedType: "demand",
        });
      }
      if (pub?.email) {
        await resend.emails.send({
          from: "接单吧 <noreply@opcorder.com>", to: pub.email,
          subject: `保证金已退款 — 需求「${demand.title}」`,
          html: buildBulkEmail(pub.nickname ?? pub.email, `您的需求「${demand.title}」的保证金已成功退还，请确认到账情况。如有问题请联系平台客服。`),
        }).catch(() => {});
      }
    });

    return res.json({ success: true, refundedAt: now.toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    logger.error({ err: err }, "[admin-confirm-offline-refund] error:");
    return res.status(500).json({ error: msg });
  }
});

/* ─────────────────────────────────────────────────
   Admin profile (permissions for current session)
   ───────────────────────────────────────────────── */
router.get("/admin/profile", async (req, res) => {
  try {
    const userId = req.user!.id;
    const [user] = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const permissions = req.user!.adminPermissions ?? [];
    return res.json({ ...user, permissions, isSuperAdmin: user?.isSuperAdmin ?? false });
  } catch (err) {
    return res.status(500).json({ error: "获取管理员信息失败" });
  }
});

/* ─────────────────────────────────────────────────
   Roles CRUD (super admin only)
   ───────────────────────────────────────────────── */
router.get("/admin/roles", requireSuperAdmin, async (_req, res) => {
  try {
    const roles = await db.select().from(adminRolesTable).orderBy(asc(adminRolesTable.id));
    // attach member count
    const counts = await db
      .select({ roleId: adminRoleAssignmentsTable.roleId, cnt: count() })
      .from(adminRoleAssignmentsTable)
      .groupBy(adminRoleAssignmentsTable.roleId);
    const countMap = Object.fromEntries(counts.map(c => [c.roleId, c.cnt]));
    return res.json(roles.map(r => ({ ...r, memberCount: countMap[r.id] ?? 0 })));
  } catch (err) {
    return res.status(500).json({ error: "获取角色列表失败" });
  }
});

router.post("/admin/roles", requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, permissions } = req.body as { name: string; description?: string; permissions: string[] };
    if (!name?.trim()) return res.status(400).json({ error: "角色名称不能为空" });
    const validPerms = permissions.filter((p: string) => (ADMIN_PERMISSION_KEYS as readonly string[]).includes(p));
    const [role] = await db.insert(adminRolesTable)
      .values({ name: name.trim(), description: description?.trim() ?? null, permissions: validPerms })
      .returning();
    return res.json(role);
  } catch (err) {
    return res.status(500).json({ error: "创建角色失败" });
  }
});

router.patch("/admin/roles/:id", requireSuperAdmin, async (req, res) => {
  try {
    const roleId = Number(req.params.id as string);
    const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: string[] };
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name?.trim()) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() ?? null;
    if (permissions !== undefined) {
      updateData.permissions = permissions.filter((p: string) => (ADMIN_PERMISSION_KEYS as readonly string[]).includes(p));
    }
    const [role] = await db.update(adminRolesTable).set(updateData).where(eq(adminRolesTable.id, roleId)).returning();
    if (!role) return res.status(404).json({ error: "角色不存在" });
    return res.json(role);
  } catch (err) {
    return res.status(500).json({ error: "更新角色失败" });
  }
});

router.delete("/admin/roles/:id", requireSuperAdmin, async (req, res) => {
  try {
    const roleId = Number(req.params.id as string);
    await db.delete(adminRoleAssignmentsTable).where(eq(adminRoleAssignmentsTable.roleId, roleId));
    await db.delete(adminRolesTable).where(eq(adminRolesTable.id, roleId));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "删除角色失败" });
  }
});

/* ─────────────────────────────────────────────────
   Admin users management (super admin only)
   ───────────────────────────────────────────────── */
router.get("/admin/admin-users", requireSuperAdmin, async (_req, res) => {
  try {
    const admins = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .orderBy(desc(usersTable.isSuperAdmin), asc(usersTable.id));

    const assignments = await db
      .select({ userId: adminRoleAssignmentsTable.userId, roleId: adminRoleAssignmentsTable.roleId })
      .from(adminRoleAssignmentsTable)
      .where(inArray(adminRoleAssignmentsTable.userId, admins.map(a => a.id)));

    const roleMap: Record<number, number[]> = {};
    for (const a of assignments) {
      if (!roleMap[a.userId]) roleMap[a.userId] = [];
      roleMap[a.userId].push(a.roleId);
    }

    return res.json(admins.map(a => ({ ...a, roleIds: roleMap[a.id] ?? [] })));
  } catch (err) {
    return res.status(500).json({ error: "获取管理员列表失败" });
  }
});

/** Promote an existing user to admin and assign roles */
router.post("/admin/admin-users", requireSuperAdmin, async (req, res) => {
  try {
    const { userId, roleIds } = req.body as { userId: number; roleIds: number[] };
    if (!userId) return res.status(400).json({ error: "请选择用户" });

    const [user] = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "用户不存在" });

    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, userId));

    if (Array.isArray(roleIds) && roleIds.length > 0) {
      await db.delete(adminRoleAssignmentsTable).where(eq(adminRoleAssignmentsTable.userId, userId));
      await db.insert(adminRoleAssignmentsTable).values(roleIds.map(r => ({ userId, roleId: r })));
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "设置管理员失败" });
  }
});

/** Update an admin's role assignments */
router.patch("/admin/admin-users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id as string);
    const currentId = req.user!.id;
    const { roleIds } = req.body as { roleIds: number[] };

    const [target] = await db.select({ isSuperAdmin: usersTable.isSuperAdmin }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: "管理员不存在" });
    if (target.isSuperAdmin && targetId !== currentId) return res.status(403).json({ error: "无法修改其他超级管理员的角色" });

    await db.delete(adminRoleAssignmentsTable).where(eq(adminRoleAssignmentsTable.userId, targetId));
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      await db.insert(adminRoleAssignmentsTable).values(roleIds.map(r => ({ userId: targetId, roleId: r })));
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "更新角色分配失败" });
  }
});

/** Revoke admin access from a user */
router.delete("/admin/admin-users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id as string);
    const currentId = req.user!.id;
    if (targetId === currentId) return res.status(400).json({ error: "不能撤销自己的管理员权限" });

    const [target] = await db.select({ isSuperAdmin: usersTable.isSuperAdmin }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: "管理员不存在" });
    if (target.isSuperAdmin) return res.status(403).json({ error: "不能撤销超级管理员权限" });

    await db.delete(adminRoleAssignmentsTable).where(eq(adminRoleAssignmentsTable.userId, targetId));
    await db.update(usersTable).set({ role: "opc" }).where(eq(usersTable.id, targetId));

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "撤销管理员权限失败" });
  }
});

/** Search non-admin users to promote */
router.get("/admin/admin-users/search-users", requireSuperAdmin, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const users = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(and(
        ne(usersTable.role, "admin"),
        or(ilike(usersTable.nickname, `%${q}%`), ilike(usersTable.email, `%${q}%`))
      ))
      .limit(10);
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: "搜索失败" });
  }
});

/* ─── SYSTEM LOGS ───────────────────────────────── */

router.get("/admin/system-logs", async (req, res) => {
  try {
    const { category, level, limit: limitStr, offset: offsetStr } = req.query as Record<string, string>;
    const limit = Math.min(Number(limitStr) || 50, 200);
    const offset = Number(offsetStr) || 0;

    const conditions = [];
    if (category && category !== "all") conditions.push(eq(systemLogsTable.category, category));
    if (level && level !== "all") conditions.push(eq(systemLogsTable.level, level));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(systemLogsTable).where(where);
    const rows = await db
      .select({
        id: systemLogsTable.id,
        level: systemLogsTable.level,
        category: systemLogsTable.category,
        message: systemLogsTable.message,
        metadata: systemLogsTable.metadata,
        operatorId: systemLogsTable.operatorId,
        operatorName: usersTable.nickname,
        createdAt: systemLogsTable.createdAt,
      })
      .from(systemLogsTable)
      .leftJoin(usersTable, eq(systemLogsTable.operatorId, usersTable.id))
      .where(where)
      .orderBy(desc(systemLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      total: Number(totalResult.count),
      rows: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "查询系统日志失败" });
  }
});

/* ─── SETTLEMENT ACCOUNT REVIEW ───────────────────── */

router.get("/admin/settlement-accounts", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await db
      .select({
        id: settlementAccountsTable.id,
        userId: settlementAccountsTable.userId,
        userNickname: usersTable.nickname,
        userEmail: usersTable.email,
        companyName: settlementAccountsTable.companyName,
        creditCode: settlementAccountsTable.creditCode,
        bankName: settlementAccountsTable.bankName,
        bankBranch: settlementAccountsTable.bankBranch,
        bankAccount: settlementAccountsTable.bankAccount,
        accountName: settlementAccountsTable.accountName,
        contactName: settlementAccountsTable.contactName,
        contactPhone: settlementAccountsTable.contactPhone,
        businessLicenseUrl: settlementAccountsTable.businessLicenseUrl,
        legalRepIdFrontUrl: settlementAccountsTable.legalRepIdFrontUrl,
        legalRepIdBackUrl: settlementAccountsTable.legalRepIdBackUrl,
        rejectReason: settlementAccountsTable.rejectReason,
        status: settlementAccountsTable.status,
        createdAt: settlementAccountsTable.createdAt,
        updatedAt: settlementAccountsTable.updatedAt,
      })
      .from(settlementAccountsTable)
      .leftJoin(usersTable, eq(settlementAccountsTable.userId, usersTable.id))
      .where(
        status && status !== "all"
          ? eq(settlementAccountsTable.status, status as any)
          : undefined
      )
      .orderBy(desc(settlementAccountsTable.updatedAt));

    return res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取结算账户列表失败" });
  }
});

router.patch("/admin/settlement-accounts/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { action, rejectReason } = req.body as { action: "approve" | "reject"; rejectReason?: string };

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action 只能是 approve 或 reject" });
    }
    if (action === "reject" && !rejectReason?.trim()) {
      return res.status(400).json({ error: "驳回时必须填写原因" });
    }

    const [row] = await db
      .update(settlementAccountsTable)
      .set({
        status: action === "approve" ? "verified" : "rejected",
        rejectReason: action === "reject" ? rejectReason!.trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(settlementAccountsTable.id, id))
      .returning();

    if (!row) return res.status(404).json({ error: "记录不存在" });

    // Send in-app notification to the OPC
    const notifContent = action === "approve"
      ? "您的结算账户已通过审核，现在可以正常抢单了"
      : `您的结算账户审核未通过，原因：${rejectReason}，请修改后重新提交`;

    await db.insert(notificationsTable).values({
      userId: row.userId,
      type: "system",
      title: action === "approve" ? "结算账户审核通过" : "结算账户审核未通过",
      content: notifContent,
      isRead: false,
    }).catch(() => {});

    return res.json({ ok: true, status: row.status });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "审核操作失败" });
  }
});

/* ─── ADMIN: Quote Card v2 – structured dimensions + tiers ──────────────── */

async function buildAllCategoryConfigs(filterCategory?: string) {
  // Fetch all cat_categories for name resolution
  const catCats = await db.select({ id: catCategoriesTable.id, code: catCategoriesTable.code, name: catCategoriesTable.name })
    .from(catCategoriesTable).orderBy(asc(catCategoriesTable.sortOrder));
  const catById = new Map(catCats.map(c => [c.id, c]));

  const CODE_TO_LEGACY: Record<string, string> = { CG: "content", SA: "software", TK: "education", BO: "marketing", OTHER: "other" };

  const dims = await db.select().from(quoteDimensionsTable)
    .where(filterCategory
      ? and(eq(quoteDimensionsTable.isActive, true), eq(quoteDimensionsTable.category, filterCategory))
      : eq(quoteDimensionsTable.isActive, true))
    .orderBy(asc(quoteDimensionsTable.category), asc(quoteDimensionsTable.layer), asc(quoteDimensionsTable.sortOrder));

  if (dims.length === 0) return filterCategory ? { category: filterCategory, base: [], adjustment: [], optional: [] } : [];

  const dimIds = dims.map(d => d.id);
  const tiers = await db.select().from(quoteTiersTable)
    .where(inArray(quoteTiersTable.dimensionId, dimIds))
    .orderBy(asc(quoteTiersTable.sortOrder));

  const tiersByDim = new Map<number, typeof tiers>();
  for (const t of tiers) {
    if (!tiersByDim.has(t.dimensionId)) tiersByDim.set(t.dimensionId, []);
    tiersByDim.get(t.dimensionId)!.push(t);
  }

  const mapDim = (d: typeof dims[0]) => ({
    id: d.id, code: d.code, label: d.label, description: d.description,
    sortOrder: d.sortOrder, isActive: d.isActive,
    catCategoryId: d.catCategoryId ?? null,
    tiers: (tiersByDim.get(d.id) ?? []).map(t => ({
      id: t.id, tier: t.tier, tierLabel: t.tierLabel, basePrice: t.basePrice,
      coefficient: t.coefficient, description: t.description, sortOrder: t.sortOrder,
    })),
  });

  // Group by catCategoryId (primary), falling back to legacy category string
  type CatBuckets = { catCategoryId: number | null; categoryName: string; category: string; base: ReturnType<typeof mapDim>[]; adjustment: ReturnType<typeof mapDim>[]; optional: ReturnType<typeof mapDim>[] };
  const catIdMap = new Map<string, CatBuckets>(); // key: catCategoryId ?? "legacy:"+category

  for (const d of dims) {
    const groupKey = d.catCategoryId ? String(d.catCategoryId) : `legacy:${d.category}`;
    if (!catIdMap.has(groupKey)) {
      const catInfo = d.catCategoryId ? catById.get(d.catCategoryId) : undefined;
      const categoryName = catInfo?.name ?? d.category;
      const legacyCat = catInfo ? (CODE_TO_LEGACY[catInfo.code] ?? d.category) : d.category;
      catIdMap.set(groupKey, { catCategoryId: d.catCategoryId ?? null, categoryName, category: legacyCat, base: [], adjustment: [], optional: [] });
    }
    const c = catIdMap.get(groupKey)!;
    if (d.layer === "base") c.base.push(mapDim(d));
    else if (d.layer === "optional") c.optional.push(mapDim(d));
    else c.adjustment.push(mapDim(d));
  }

  if (filterCategory) {
    // Support filtering by either legacy category string or catCategoryId
    const found = Array.from(catIdMap.values()).find(c => c.category === filterCategory || String(c.catCategoryId) === filterCategory);
    return found ?? { catCategoryId: null, categoryName: filterCategory, category: filterCategory, base: [], adjustment: [], optional: [] };
  }
  // Sort by catCategoryId (known first), then legacy-only entries
  return Array.from(catIdMap.values()).sort((a, b) => {
    if (a.catCategoryId && b.catCategoryId) return a.catCategoryId - b.catCategoryId;
    if (a.catCategoryId) return -1;
    if (b.catCategoryId) return 1;
    return a.category.localeCompare(b.category);
  });
}

router.get("/admin/quote-card/config", requireAdmin, async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const result = await buildAllCategoryConfigs(category);
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /admin/quote-card/config error");
    return res.status(500).json({ error: "获取报价卡配置失败" });
  }
});

router.post("/admin/quote-card/dimensions", requireAdmin, async (req, res) => {
  try {
    const parsed = CreateQuoteDimensionBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "参数无效", details: parsed.error.flatten().fieldErrors });
    const { category, layer, code, label, description, sortOrder } = parsed.data;

    // Resolve catCategoryId from request body or look it up from the legacy category string
    let catCategoryId: number | null = (req.body.catCategoryId as number | null) ?? null;
    if (!catCategoryId && category) {
      const LEGACY_TO_CODE: Record<string, string> = { content: "CG", software: "SA", education: "TK", marketing: "BO", other: "OTHER" };
      const code_ = LEGACY_TO_CODE[category];
      if (code_) {
        const [cat] = await db.select({ id: catCategoriesTable.id }).from(catCategoriesTable)
          .where(eq(catCategoriesTable.code, code_)).limit(1);
        if (cat) catCategoryId = cat.id;
      }
    }

    const [dim] = await db.insert(quoteDimensionsTable).values({
      category, layer, code, label, description: description ?? null, sortOrder: sortOrder ?? 0,
      catCategoryId,
    }).returning();
    return res.status(201).json(dim);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "该分类/层级下维度代码已存在" });
    logger.error({ err }, "POST /admin/quote-card/dimensions error");
    return res.status(500).json({ error: "创建维度失败" });
  }
});

router.put("/admin/quote-card/dimensions/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = UpdateQuoteDimensionBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "参数无效" });
    const { label, description, sortOrder, isActive } = parsed.data;
    const set: Record<string, any> = { updatedAt: new Date() };
    if (label !== undefined) set.label = label;
    if (description !== undefined) set.description = description;
    if (sortOrder !== undefined) set.sortOrder = sortOrder;
    if (isActive !== undefined) set.isActive = isActive;
    const [dim] = await db.update(quoteDimensionsTable).set(set).where(eq(quoteDimensionsTable.id, id)).returning();
    if (!dim) return res.status(404).json({ error: "维度不存在" });
    return res.json(dim);
  } catch (err) {
    logger.error({ err }, "PUT /admin/quote-card/dimensions/:id error");
    return res.status(500).json({ error: "更新维度失败" });
  }
});

router.delete("/admin/quote-card/dimensions/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [dim] = await db.delete(quoteDimensionsTable).where(eq(quoteDimensionsTable.id, id)).returning();
    if (!dim) return res.status(404).json({ error: "维度不存在" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/quote-card/dimensions/:id error");
    return res.status(500).json({ error: "删除维度失败" });
  }
});

router.post("/admin/quote-card/tiers", requireAdmin, async (req, res) => {
  try {
    const parsed = CreateQuoteTierBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "参数无效", details: parsed.error.flatten().fieldErrors });
    const { dimensionId, tier, tierLabel, basePrice, coefficient, description, sortOrder } = parsed.data;
    const [t] = await db.insert(quoteTiersTable).values({
      dimensionId, tier, tierLabel, basePrice: basePrice ?? 0,
      coefficient: coefficient ?? null, description: description ?? null, sortOrder: sortOrder ?? 0,
    }).returning();
    return res.status(201).json(t);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "该维度下档位代码已存在" });
    logger.error({ err }, "POST /admin/quote-card/tiers error");
    return res.status(500).json({ error: "创建档位失败" });
  }
});

router.put("/admin/quote-card/tiers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = UpdateQuoteTierBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "参数无效" });
    const { tierLabel, basePrice, coefficient, description, sortOrder } = parsed.data;
    const set: Record<string, any> = { updatedAt: new Date() };
    if (tierLabel !== undefined) set.tierLabel = tierLabel;
    if (basePrice !== undefined) set.basePrice = basePrice;
    if (coefficient !== undefined) set.coefficient = coefficient;
    if (description !== undefined) set.description = description;
    if (sortOrder !== undefined) set.sortOrder = sortOrder;
    const [t] = await db.update(quoteTiersTable).set(set).where(eq(quoteTiersTable.id, id)).returning();
    if (!t) return res.status(404).json({ error: "档位不存在" });
    return res.json(t);
  } catch (err) {
    logger.error({ err }, "PUT /admin/quote-card/tiers/:id error");
    return res.status(500).json({ error: "更新档位失败" });
  }
});

router.delete("/admin/quote-card/tiers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [t] = await db.delete(quoteTiersTable).where(eq(quoteTiersTable.id, id)).returning();
    if (!t) return res.status(404).json({ error: "档位不存在" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/quote-card/tiers/:id error");
    return res.status(500).json({ error: "删除档位失败" });
  }
});

/* ─── ADMIN: confirm pending_payment order (offline payment) ─────────────── */
router.post("/admin/orders/:orderId/confirm-payment", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId as string);
    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status, opcId: ordersTable.opcId, publisherId: ordersTable.publisherId, orderNo: ordersTable.orderNo })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ error: "只有待付款状态的订单可以确认付款" });
    }

    const now = new Date();
    const [updated] = await db
      .update(ordersTable)
      .set({ status: "in_progress", paidAt: now, updatedAt: now })
      .where(eq(ordersTable.id, orderId))
      .returning();

    // Notify OPC that work can begin
    await db.insert(notificationsTable).values({
      userId: order.opcId,
      type: "system",
      title: "发单方已付款，订单正式开始",
      content: `订单「${order.orderNo}」的保证金已到账确认，订单现已正式进入执行阶段，请按时完成交付。`,
      relatedId: orderId,
      relatedType: "order",
    });

    // Notify publisher too
    await db.insert(notificationsTable).values({
      userId: order.publisherId,
      type: "system",
      title: "付款确认，订单正式开始",
      content: `您的订单「${order.orderNo}」付款已确认，OPC 已开始执行，请关注交付进度。`,
      relatedId: orderId,
      relatedType: "order",
    });

    return res.json({ ok: true, orderId, status: updated.status, paidAt: updated.paidAt?.toISOString() });
  } catch (err) {
    logger.error({ err }, "admin confirm-payment error");
    return res.status(500).json({ error: "确认付款失败" });
  }
});

/* ─── ADMIN: reject offline payment receipt for an order ──────────────────── */
router.post("/admin/orders/:orderId/reject-payment", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId as string);
    const { reason } = req.body as { reason?: string };

    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status, publisherId: ordersTable.publisherId, orderNo: ordersTable.orderNo })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ error: "只有待付款状态的订单可以拒绝付款凭证" });
    }

    const reasonText = reason?.trim() || "付款凭证有误，请重新提交";
    const now = new Date();

    await db.update(ordersTable).set({
      paymentRejectReason: reasonText,
      paymentReceiptUrl: null,
      paymentMethod: null,
      updatedAt: now,
    }).where(eq(ordersTable.id, orderId));

    await db.insert(notificationsTable).values({
      userId: order.publisherId,
      type: "system",
      title: "付款凭证审核未通过",
      content: `订单「${order.orderNo}」的付款凭证审核未通过。原因：${reasonText}。请重新提交付款凭证。`,
      relatedId: orderId,
      relatedType: "order",
    });

    return res.json({ ok: true, orderId });
  } catch (err) {
    logger.error({ err }, "admin reject-payment error");
    return res.status(500).json({ error: "拒绝付款失败" });
  }
});

/* ─── ADMIN: force close a pending_payment order ───────────────────────────── */
router.post("/admin/orders/:orderId/force-close", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId as string);
    const { reason } = req.body as { reason?: string };

    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status, opcId: ordersTable.opcId, publisherId: ordersTable.publisherId, orderNo: ordersTable.orderNo, demandId: ordersTable.demandId })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ error: "只有「待付款」状态的订单可以强制关闭" });
    }

    const now = new Date();
    await db.update(ordersTable).set({ status: "closed", updatedAt: now }).where(eq(ordersTable.id, orderId));

    // Reopen demand to published if it was matched
    const [demand] = await db
      .select({ status: demandsTable.status })
      .from(demandsTable)
      .where(eq(demandsTable.id, order.demandId))
      .limit(1);

    if (demand?.status === "matched") {
      await db.update(demandsTable).set({ status: "published", updatedAt: now }).where(eq(demandsTable.id, order.demandId));
    }

    const reasonText = reason?.trim() || "管理员关闭";
    await db.insert(notificationsTable).values([
      {
        userId: order.opcId,
        type: "system",
        title: "订单已关闭",
        content: `订单「${order.orderNo}」已被管理员关闭。原因：${reasonText}`,
        relatedId: orderId,
        relatedType: "order",
      },
      {
        userId: order.publisherId,
        type: "system",
        title: "订单已关闭",
        content: `订单「${order.orderNo}」已被管理员关闭。原因：${reasonText}`,
        relatedId: orderId,
        relatedType: "order",
      },
    ]);

    return res.json({ ok: true, orderId, status: "closed" });
  } catch (err) {
    logger.error({ err }, "admin force-close order error");
    return res.status(500).json({ error: "强制关闭订单失败" });
  }
});

/* ─── CREDIT RULES ──────────────────────────────────────────────────────── */

// List all credit rules (seeded, one per action_type)
router.get("/admin/credit-rules", async (_req, res) => {
  try {
    const rows = (await db.execute(sql`
      SELECT id, action_type, points_delta, description, is_active, created_at, updated_at
      FROM credit_rules ORDER BY id
    `)).rows;
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取积分规则失败" });
  }
});

// Update a credit rule (points_delta, description, is_active)
router.put("/admin/credit-rules/:id", async (req, res) => {
  try {
    const id = Number(req.params.id as string);
    const { pointsDelta, description, isActive } = req.body as {
      pointsDelta?: number; description?: string; isActive?: boolean;
    };
    if (pointsDelta === undefined && description === undefined && isActive === undefined) {
      return res.status(400).json({ error: "无可更新字段" });
    }
    // Use tagged template literals to keep parameters safe
    const parts: ReturnType<typeof sql>[] = [];
    if (pointsDelta !== undefined) parts.push(sql`points_delta = ${pointsDelta}`);
    if (description !== undefined) parts.push(sql`description = ${description}`);
    if (isActive !== undefined)    parts.push(sql`is_active = ${isActive}`);
    parts.push(sql`updated_at = NOW()`);

    // Combine all SET clauses
    const setClauses = parts.reduce((acc, part, i) => i === 0 ? part : sql`${acc}, ${part}`, sql``);
    await db.execute(sql`UPDATE credit_rules SET ${setClauses} WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "更新积分规则失败" });
  }
});

/* ─── CREDIT TRANSACTIONS ────────────────────────────────────────────────── */

// Paginated list of credit transactions (admin overview, optionally filtered by userId)
router.get("/admin/credit-transactions", async (req, res) => {
  try {
    const { userId, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const p = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (p - 1) * ps;
    const where = userId ? `WHERE ct.user_id = ${Number(userId)}` : "";

    const rows = (await db.execute(sql.raw(`
      SELECT
        ct.id, ct.user_id, ct.delta, ct.balance_after, ct.action_type,
        ct.ref_id, ct.note, ct.operator_id, ct.created_at,
        u.nickname AS user_nickname
      FROM credit_transactions ct
      LEFT JOIN users u ON u.id = ct.user_id
      ${where}
      ORDER BY ct.created_at DESC
      LIMIT ${ps} OFFSET ${offset}
    `))).rows;

    const [{ total }] = (await db.execute(sql.raw(`
      SELECT COUNT(*) AS total FROM credit_transactions ct ${where}
    `))).rows as Array<{ total: string }>;

    return res.json({ data: rows, total: Number(total), page: p, pageSize: ps });
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "获取积分流水失败" });
  }
});

// Admin manually adjusts OPC credit points
router.post("/admin/users/:userId/manual-credit", async (req, res) => {
  try {
    const userId = Number(req.params.userId as string);
    const { delta, note } = req.body as { delta?: number; note?: string };
    if (typeof delta !== "number" || delta === 0) {
      return res.status(400).json({ error: "delta 必须为非零整数" });
    }

    const { applyCredit } = await import("../lib/credit");
    const result = await applyCredit(userId, "manual_adjustment", {
      forceDelta: delta,
      note: note?.trim() || "管理员手动调整",
      operatorId: req.user!.id,
    });

    return res.json(result);
  } catch (err) {
    logger.error({ err }, "Route handler error");
    return res.status(500).json({ error: "积分调整失败" });
  }
});

export default router;
