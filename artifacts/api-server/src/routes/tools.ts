import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  toolAgentsTable,
  toolKnowledgeBasesTable,
  toolCustomToolsTable,
  toolAgentFavoritesTable,
  toolSubscriptionsTable,
  toolSubscriptionPaymentsTable,
  toolEarningsTable,
  toolPluginsTable,
  toolPluginInstallsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createPaymentOrder, queryPaymentStatus, PAYMENT_STATUS, TERMINAL_STATUSES } from "../lib/payment";

const NOTIFY_URL = "https://www.opcorder.com/api/payment/callback";

const router: IRouter = Router();

/**
 * 支付成功后激活订阅（幂等）：
 * 1) 服务端向支付网关查询订单,确认状态为已支付且金额与订阅冻结金额一致（不信任回调 body）
 * 2) 事务 + FOR UPDATE 行锁,仅当状态为 pending_payment 且订单号匹配时生效并写入创作者收益,
 *    因此回调与前端轮询并发触发也只会激活/记账一次。
 * 供 payment-callback 与 payment-status 轮询共用。
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 调用方已持有该订阅行锁、并已核验网关支付状态与金额,此处仅做状态转换+记创作者收益 */
async function activateLockedSub(tx: Tx, sub: typeof toolSubscriptionsTable.$inferSelect) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000); // 按月订阅
  const [updated] = await tx.update(toolSubscriptionsTable)
    .set({ status: "active", startsAt: now, expiresAt, paidAt: now, cancelledAt: null, updatedAt: now })
    .where(eq(toolSubscriptionsTable.id, sub.id)).returning();
  // 不可变支付流水：每笔成功支付一行,续订不覆盖历史。
  // payment_order_no 唯一索引 + onConflictDoNothing 保证同一支付单只记一次。
  await tx.insert(toolSubscriptionPaymentsTable).values({
    subscriptionId: sub.id,
    userId: sub.userId,
    agentId: sub.agentId,
    amountFen: sub.amountFen,
    businessOrderNo: sub.businessOrderNo,
    paymentOrderNo: sub.paymentOrderNo,
    paidAt: now,
  }).onConflictDoNothing();
  const [agent] = await tx.select().from(toolAgentsTable).where(eq(toolAgentsTable.id, sub.agentId));
  if (agent) {
    await tx.insert(toolEarningsTable).values({
      ownerId: agent.ownerId,
      agentId: sub.agentId,
      subscriberId: sub.userId,
      amountFen: sub.amountFen,
    });
  }
  return updated;
}

export async function activateToolSubscription(paymentOrderNo: string): Promise<boolean> {
  // 服务端确认支付状态与金额
  const order = await queryPaymentStatus(paymentOrderNo);
  if (order.status !== PAYMENT_STATUS.PAID) return false;

  return await db.transaction(async (tx) => {
    // 优先按支付单号匹配;若崩溃发生在「网关下单成功但尚未回填 payment_order_no」之间,
    // 退化按业务单号（意向单,先于网关调用落库）匹配并当场补链,保证已付订单总能激活。
    let [sub] = await tx.select().from(toolSubscriptionsTable)
      .where(eq(toolSubscriptionsTable.paymentOrderNo, paymentOrderNo))
      .for("update");
    if (!sub && order.businessOrderNo) {
      [sub] = await tx.select().from(toolSubscriptionsTable)
        .where(eq(toolSubscriptionsTable.businessOrderNo, order.businessOrderNo))
        .for("update");
      if (sub && sub.status === "pending_payment" && !sub.paymentOrderNo) {
        await tx.update(toolSubscriptionsTable)
          .set({ paymentOrderNo, updatedAt: new Date() })
          .where(eq(toolSubscriptionsTable.id, sub.id));
        sub = { ...sub, paymentOrderNo };
      }
    }
    if (!sub || sub.status !== "pending_payment" || sub.paymentOrderNo !== paymentOrderNo) return false;
    if (Number(order.amount) !== sub.amountFen) {
      logger.error({ paymentOrderNo, orderAmount: order.amount, subAmountFen: sub.amountFen }, "tool sub amount mismatch — not activating");
      return false;
    }
    await activateLockedSub(tx, sub);
    return true;
  });
}

export const TOOL_CATEGORIES = ["金融", "教育", "医疗", "法律", "客服助手", "办公助手", "生活助手", "角色扮演", "创意绘画", "游戏", "情感", "其他"];

function serialize<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

const MAX_PRICE_FEN = 100000000;
function isValidPriceFen(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PRICE_FEN;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agents
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/agents", requireAuth, async (req, res) => {
  try {
    const conds = [eq(toolAgentsTable.ownerId, req.user!.id)];
    if (typeof req.query.appType === "string") conds.push(eq(toolAgentsTable.appType, req.query.appType));
    if (typeof req.query.shareStatus === "string") conds.push(eq(toolAgentsTable.shareStatus, req.query.shareStatus));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) conds.push(or(ilike(toolAgentsTable.name, `%${search}%`), ilike(toolAgentsTable.description, `%${search}%`))!);
    const items = await db.select().from(toolAgentsTable)
      .where(and(...conds))
      .orderBy(desc(toolAgentsTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list agents");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/agents", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const priceFenPerMonth = b.priceFenPerMonth ?? 0;
    if (!isValidPriceFen(priceFenPerMonth)) return res.status(400).json({ error: "价格必须为非负整数(分)" });
    const [row] = await db.insert(toolAgentsTable).values({
      ownerId: req.user!.id,
      name: b.name,
      appType: b.appType ?? "agent",
      description: b.description ?? null,
      iconUrl: b.iconUrl ?? null,
      tags: Array.isArray(b.tags) ? b.tags : [],
      category: b.category ?? null,
      shareStatus: b.shareStatus ?? "private",
      priceFenPerMonth,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create agent");
    return res.status(500).json({ error: "创建失败" });
  }
});

async function ownAgent(id: number, userId: number) {
  const [row] = await db.select().from(toolAgentsTable).where(eq(toolAgentsTable.id, id));
  if (!row) return { err: 404 as const };
  if (row.ownerId !== userId) return { err: 403 as const };
  return { row };
}

router.patch("/tools/agents/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownAgent(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    if (b.priceFenPerMonth !== undefined && !isValidPriceFen(b.priceFenPerMonth)) {
      return res.status(400).json({ error: "价格必须为非负整数(分)" });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "appType", "description", "iconUrl", "category", "shareStatus", "priceFenPerMonth"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    if (b.tags !== undefined && Array.isArray(b.tags)) patch.tags = b.tags;
    const [row] = await db.update(toolAgentsTable).set(patch).where(eq(toolAgentsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch agent");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/tools/agents/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownAgent(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    await db.delete(toolAgentsTable).where(eq(toolAgentsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete agent");
    return res.status(500).json({ error: "删除失败" });
  }
});

router.post("/tools/agents/:id/publish", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownAgent(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    if (b.priceFenPerMonth !== undefined && !isValidPriceFen(b.priceFenPerMonth)) {
      return res.status(400).json({ error: "价格必须为非负整数(分)" });
    }
    const patch: Record<string, unknown> = {
      shareStatus: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    };
    if (b.priceFenPerMonth !== undefined) patch.priceFenPerMonth = b.priceFenPerMonth;
    if (b.category !== undefined) patch.category = b.category;
    if (b.tags !== undefined && Array.isArray(b.tags)) patch.tags = b.tags;
    const [row] = await db.update(toolAgentsTable).set(patch).where(eq(toolAgentsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "publish agent");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/tools/agents/:id/unpublish", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownAgent(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const [row] = await db.update(toolAgentsTable)
      .set({ shareStatus: "private", publishedAt: null, updatedAt: new Date() })
      .where(eq(toolAgentsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "unpublish agent");
    return res.status(500).json({ error: "操作失败" });
  }
});

router.post("/tools/agents/:id/publish-template", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const owned = await ownAgent(id, req.user!.id);
    if (owned.err === 404) return res.status(404).json({ error: "不存在" });
    if (owned.err === 403) return res.status(403).json({ error: "无权操作" });
    const [row] = await db.update(toolAgentsTable)
      .set({ shareStatus: "template", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(toolAgentsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "publish-template agent");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge bases
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/knowledge-bases", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(toolKnowledgeBasesTable)
      .where(eq(toolKnowledgeBasesTable.ownerId, req.user!.id))
      .orderBy(desc(toolKnowledgeBasesTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list kb");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/knowledge-bases", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(toolKnowledgeBasesTable).values({
      ownerId: req.user!.id,
      name: b.name,
      description: b.description ?? null,
      tags: Array.isArray(b.tags) ? b.tags : [],
      sizeMb: b.sizeMb ?? 0,
      docCount: b.docCount ?? 0,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create kb");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.patch("/tools/knowledge-bases/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(toolKnowledgeBasesTable).where(eq(toolKnowledgeBasesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "description", "sizeMb", "docCount"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    if (b.tags !== undefined && Array.isArray(b.tags)) patch.tags = b.tags;
    const [row] = await db.update(toolKnowledgeBasesTable).set(patch).where(eq(toolKnowledgeBasesTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch kb");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/tools/knowledge-bases/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(toolKnowledgeBasesTable).where(eq(toolKnowledgeBasesTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(toolKnowledgeBasesTable).where(eq(toolKnowledgeBasesTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete kb");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom tools
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/custom-tools", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(toolCustomToolsTable)
      .where(eq(toolCustomToolsTable.ownerId, req.user!.id))
      .orderBy(desc(toolCustomToolsTable.createdAt));
    return res.json({ items: items.map(serialize) });
  } catch (err) {
    logger.error({ err }, "list custom tools");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/custom-tools", requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "名称必填" });
    const [row] = await db.insert(toolCustomToolsTable).values({
      ownerId: req.user!.id,
      name: b.name,
      kind: b.kind ?? "custom",
      config: (b.config && typeof b.config === "object") ? b.config : {},
      enabled: b.enabled ?? true,
      refCount: b.refCount ?? 0,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "create custom tool");
    return res.status(500).json({ error: "创建失败" });
  }
});

router.patch("/tools/custom-tools/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(toolCustomToolsTable).where(eq(toolCustomToolsTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name", "kind", "enabled", "refCount"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    if (b.config !== undefined && typeof b.config === "object") patch.config = b.config;
    const [row] = await db.update(toolCustomToolsTable).set(patch).where(eq(toolCustomToolsTable.id, id)).returning();
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "patch custom tool");
    return res.status(500).json({ error: "更新失败" });
  }
});

router.delete("/tools/custom-tools/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(toolCustomToolsTable).where(eq(toolCustomToolsTable.id, id));
    if (!existing) return res.status(404).json({ error: "不存在" });
    if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: "无权操作" });
    await db.delete(toolCustomToolsTable).where(eq(toolCustomToolsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete custom tool");
    return res.status(500).json({ error: "删除失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Market
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/market", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const conds = [eq(toolAgentsTable.shareStatus, "published")];
    if (typeof req.query.appType === "string") conds.push(eq(toolAgentsTable.appType, req.query.appType));
    if (typeof req.query.category === "string") conds.push(eq(toolAgentsTable.category, req.query.category));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) conds.push(or(ilike(toolAgentsTable.name, `%${search}%`), ilike(toolAgentsTable.description, `%${search}%`))!);
    if (req.query.onlyMine === "true" || req.query.onlyMine === "1") conds.push(eq(toolAgentsTable.ownerId, userId));

    const rows = await db.select({
      agent: toolAgentsTable,
      authorName: usersTable.nickname,
    })
      .from(toolAgentsTable)
      .leftJoin(usersTable, eq(toolAgentsTable.ownerId, usersTable.id))
      .where(and(...conds))
      .orderBy(desc(toolAgentsTable.publishedAt), desc(toolAgentsTable.createdAt));

    // favorites of current user
    const favs = await db.select({ agentId: toolAgentFavoritesTable.agentId })
      .from(toolAgentFavoritesTable)
      .where(eq(toolAgentFavoritesTable.userId, userId));
    const favSet = new Set(favs.map((f) => f.agentId));

    let items = rows.map((r) => serialize({
      ...r.agent,
      authorName: r.authorName ?? "匿名用户",
      favorited: favSet.has(r.agent.id),
    }));

    if (req.query.onlyFavorites === "true" || req.query.onlyFavorites === "1") {
      items = items.filter((i) => i.favorited);
    }
    return res.json({ items, categories: TOOL_CATEGORIES });
  } catch (err) {
    logger.error({ err }, "market");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/market/:agentId/subscribe", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agentId = parseInt(req.params.agentId as string);
    const [agent] = await db.select().from(toolAgentsTable).where(eq(toolAgentsTable.id, agentId));
    if (!agent) return res.status(404).json({ error: "智能体不存在" });
    if (agent.shareStatus !== "published") return res.status(400).json({ error: "该智能体未发布" });
    if (agent.ownerId === userId) return res.status(400).json({ error: "不能订阅自己的智能体" });

    // 唯一约束 (user_id, agent_id)：每人每个智能体只有一行订阅记录,复用/更新该行
    const now = new Date();
    const [existing] = await db.select().from(toolSubscriptionsTable).where(and(
      eq(toolSubscriptionsTable.userId, userId),
      eq(toolSubscriptionsTable.agentId, agentId),
    ));

    // 幂等：已有未过期的 active 订阅时直接返回
    if (existing && existing.status === "active" && (!existing.expiresAt || existing.expiresAt > now)) {
      return res.json(serialize(existing));
    }

    const amountFen = agent.priceFenPerMonth ?? 0;

    // 免费智能体：直接生效（保持原有行为,收益表记 0 元用于订阅人次统计）
    if (amountFen === 0) {
      const sub = await db.transaction(async (tx) => {
        let row;
        if (existing) {
          [row] = await tx.update(toolSubscriptionsTable)
            .set({ status: "active", amountFen: 0, paymentOrderNo: null, startsAt: now, expiresAt: null, cancelledAt: null, updatedAt: now })
            .where(eq(toolSubscriptionsTable.id, existing.id)).returning();
        } else {
          [row] = await tx.insert(toolSubscriptionsTable).values({
            userId, agentId, amountFen: 0, status: "active", startsAt: now,
          }).returning();
        }
        await tx.insert(toolEarningsTable).values({
          ownerId: agent.ownerId, agentId, subscriberId: userId, amountFen: 0,
        });
        return row;
      });
      return res.status(201).json(serialize(sub));
    }

    // 付费智能体三段式（保证任何时刻网关侧不存在无法追溯到订阅的可支付订单）：
    //  Tx1（短事务,行锁）: 落库「支付意向」—— pending_payment + 唯一 business_order_no,先于网关调用提交;
    //  网关调用（事务外）: 用已持久化的 business_order_no 下单;
    //  Tx2（短事务,行锁）: 回填 payment_order_no。
    // 若在网关成功后、回填前崩溃：意向单已持久化,支付回调/激活逻辑可按 business_order_no
    // 反查并补链（见 activateToolSubscription）,用户已付订单仍能激活。
    const reservation = await db.transaction(async (tx) => {
      await tx.insert(toolSubscriptionsTable)
        .values({ userId, agentId, amountFen, status: "pending_payment" })
        .onConflictDoNothing();
      const [row] = await tx.select().from(toolSubscriptionsTable)
        .where(and(
          eq(toolSubscriptionsTable.userId, userId),
          eq(toolSubscriptionsTable.agentId, agentId),
        )).for("update");

      if (row.status === "active" && (!row.expiresAt || row.expiresAt > now)) {
        return { kind: "active" as const, sub: row };
      }

      if (row.status === "pending_payment" && row.paymentOrderNo) {
        // 已有关联订单,交给事务外查网关处理（复用/激活/换新单）
        return { kind: "existing_order" as const, sub: row };
      }

      if (row.status === "pending_payment" && row.businessOrderNo && !row.paymentOrderNo) {
        // 已有未回填的意向单:30 秒内视为另一请求正在下单;超时视为崩溃残留,复用同一业务单号重试。
        // 行锁内刷新 updated_at 作为认领标记,并发的下一个请求会落入 busy 分支,不会重复下单。
        const ageMs = now.getTime() - row.updatedAt.getTime();
        if (ageMs < 30_000) return { kind: "busy" as const };
        const [claimed] = await tx.update(toolSubscriptionsTable)
          .set({ updatedAt: now })
          .where(eq(toolSubscriptionsTable.id, row.id)).returning();
        return { kind: "reserved" as const, sub: claimed, businessOrderNo: row.businessOrderNo };
      }

      const businessOrderNo = `TOOLSUB-${row.id}-${Date.now()}`;
      const [updated] = await tx.update(toolSubscriptionsTable)
        .set({ status: "pending_payment", amountFen, businessOrderNo, paymentOrderNo: null, paidAt: null, updatedAt: now })
        .where(eq(toolSubscriptionsTable.id, row.id)).returning();
      return { kind: "reserved" as const, sub: updated, businessOrderNo };
    });

    if (reservation.kind === "active") return res.json(serialize(reservation.sub));
    if (reservation.kind === "busy") return res.status(409).json({ error: "正在生成支付单,请稍后重试" });

    if (reservation.kind === "existing_order") {
      const row = reservation.sub;
      const prev = await queryPaymentStatus(row.paymentOrderNo!);
      if (prev.status === PAYMENT_STATUS.PAID) {
        const activated = await activateToolSubscription(row.paymentOrderNo!);
        const [fresh] = await db.select().from(toolSubscriptionsTable).where(eq(toolSubscriptionsTable.id, row.id));
        if (activated || fresh?.status === "active") return res.json(serialize(fresh));
        return res.status(409).json({ error: "支付金额校验异常,请联系客服处理" });
      }
      if (prev.status === PAYMENT_STATUS.PENDING) {
        // 复用仍可支付的原订单,绝不覆盖其关联
        return res.status(201).json({
          ...serialize(row),
          paymentRequired: true,
          qrCodeUrl: prev.qrCodeUrl,
          paymentOrderNo: row.paymentOrderNo,
        });
      }
      // 原订单已终结（取消/过期/失败）：CAS 清链后落新的意向单再下单。
      // 谓词包含读取到的旧 payment_order_no —— 并发的两个请求只有一个能完成重置,
      // 输掉的一方直接 409,不会调网关,因此不会产生无法追溯的支付单。
      const businessOrderNo = `TOOLSUB-${row.id}-${Date.now()}`;
      const [reset] = await db.update(toolSubscriptionsTable)
        .set({ amountFen, businessOrderNo, paymentOrderNo: null, paidAt: null, updatedAt: new Date() })
        .where(and(
          eq(toolSubscriptionsTable.id, row.id),
          eq(toolSubscriptionsTable.status, "pending_payment"),
          eq(toolSubscriptionsTable.paymentOrderNo, row.paymentOrderNo!),
          eq(toolSubscriptionsTable.businessOrderNo, row.businessOrderNo!),
        ))
        .returning();
      if (!reset) return res.status(409).json({ error: "订阅状态已变化,请刷新后重试" });
      reservation.sub = reset;
      (reservation as any).businessOrderNo = businessOrderNo;
    }

    // 意向单已持久化,事务外调网关下单
    const businessOrderNo = (reservation as any).businessOrderNo as string;
    const order = await createPaymentOrder({
      businessOrderNo,
      amount: amountFen,
      subject: `智能体订阅-${agent.name}`,
      body: `订阅智能体「${agent.name}」1个月`,
      businessName: "工具平台订阅",
      notifyUrl: NOTIFY_URL,
    });

    // 短事务回填支付单号（仅当意向单未被并发改动时）
    const [linked] = await db.update(toolSubscriptionsTable)
      .set({ paymentOrderNo: order.paymentOrderNo, updatedAt: new Date() })
      .where(and(
        eq(toolSubscriptionsTable.id, reservation.sub.id),
        eq(toolSubscriptionsTable.status, "pending_payment"),
        eq(toolSubscriptionsTable.businessOrderNo, businessOrderNo),
      )).returning();
    if (!linked) {
      // 极端并发下意向单已被改动:该订单仍可通过 business_order_no 被回调补链,不会成为无主订单
      logger.warn({ businessOrderNo, paymentOrderNo: order.paymentOrderNo }, "tool sub link skipped — reservation changed");
      return res.status(409).json({ error: "订阅正在处理中,请刷新后重试" });
    }

    return res.status(201).json({
      ...serialize(linked),
      paymentRequired: true,
      qrCodeUrl: order.qrCodeUrl,
      paymentOrderNo: order.paymentOrderNo,
    });
  } catch (err) {
    logger.error({ err }, "subscribe");
    return res.status(500).json({ error: "订阅失败" });
  }
});

/* 轮询支付结果；支付成功则激活订阅（幂等,可与回调并发） */
router.post("/tools/market/:agentId/payment-status", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agentId = parseInt(req.params.agentId as string);
    const [sub] = await db.select().from(toolSubscriptionsTable).where(and(
      eq(toolSubscriptionsTable.userId, userId),
      eq(toolSubscriptionsTable.agentId, agentId),
    ));
    if (!sub) return res.status(404).json({ error: "未找到订阅记录" });
    if (sub.status === "active") return res.json({ paid: true, terminal: true, status: PAYMENT_STATUS.PAID });
    if (!sub.paymentOrderNo) return res.status(400).json({ error: "尚未创建支付订单" });

    const order = await queryPaymentStatus(sub.paymentOrderNo);
    if (order.status === PAYMENT_STATUS.PAID) {
      await activateToolSubscription(sub.paymentOrderNo);
      // 成功与否以激活后的订阅状态为准（金额核验失败等情况不得报成功）
      const [fresh] = await db.select().from(toolSubscriptionsTable).where(eq(toolSubscriptionsTable.id, sub.id));
      const activated = fresh?.status === "active";
      return res.json({
        status: order.status,
        statusName: activated ? order.statusName : "支付确认异常,请联系客服",
        paid: activated,
        terminal: true,
      });
    }
    return res.json({
      status: order.status,
      statusName: order.statusName,
      paid: false,
      terminal: (TERMINAL_STATUSES as number[]).includes(Number(order.status)),
    });
  } catch (err) {
    logger.error({ err }, "tool sub payment-status");
    return res.status(500).json({ error: "查询失败" });
  }
});

/* 退订：仅允许取消已生效订阅,立即取消不退款（按月一次性扣费）。
   待支付订单不允许「退订」——不支付即可,订单会自行过期;
   若取消后订单被支付,激活逻辑仍能正常生效,避免扣款却无服务。 */
router.post("/tools/market/:agentId/unsubscribe", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const agentId = parseInt(req.params.agentId as string);
    const now = new Date();
    const [row] = await db.update(toolSubscriptionsTable)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(and(
        eq(toolSubscriptionsTable.userId, userId),
        eq(toolSubscriptionsTable.agentId, agentId),
        eq(toolSubscriptionsTable.status, "active"),
      )).returning();
    if (!row) return res.status(404).json({ error: "没有可退订的订阅" });
    return res.json(serialize(row));
  } catch (err) {
    logger.error({ err }, "unsubscribe");
    return res.status(500).json({ error: "退订失败" });
  }
});

router.post("/tools/market/:agentId/favorite", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId as string);
    const [agent] = await db.select().from(toolAgentsTable).where(eq(toolAgentsTable.id, agentId));
    if (!agent) return res.status(404).json({ error: "智能体不存在" });
    if (agent.shareStatus !== "published" && agent.ownerId !== req.user!.id) {
      return res.status(404).json({ error: "智能体不存在" });
    }
    const [existing] = await db.select().from(toolAgentFavoritesTable).where(and(
      eq(toolAgentFavoritesTable.userId, req.user!.id),
      eq(toolAgentFavoritesTable.agentId, agentId),
    ));
    if (existing) {
      await db.delete(toolAgentFavoritesTable).where(eq(toolAgentFavoritesTable.id, existing.id));
      return res.json({ favorited: false });
    }
    await db.insert(toolAgentFavoritesTable).values({ userId: req.user!.id, agentId });
    return res.json({ favorited: true });
  } catch (err) {
    logger.error({ err }, "favorite");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/templates", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select({
      agent: toolAgentsTable,
      authorName: usersTable.nickname,
    })
      .from(toolAgentsTable)
      .leftJoin(usersTable, eq(toolAgentsTable.ownerId, usersTable.id))
      .where(eq(toolAgentsTable.shareStatus, "template"))
      .orderBy(desc(toolAgentsTable.createdAt));
    return res.json({ items: rows.map((r) => serialize({ ...r.agent, authorName: r.authorName ?? "匿名用户" })) });
  } catch (err) {
    logger.error({ err }, "templates");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/templates/:id/add-to-workspace", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [tpl] = await db.select().from(toolAgentsTable).where(eq(toolAgentsTable.id, id));
    if (!tpl) return res.status(404).json({ error: "模板不存在" });
    if (tpl.shareStatus !== "template") return res.status(400).json({ error: "该智能体不是模板" });
    const [row] = await db.insert(toolAgentsTable).values({
      ownerId: req.user!.id,
      name: tpl.name,
      appType: tpl.appType,
      description: tpl.description,
      iconUrl: tpl.iconUrl,
      tags: tpl.tags,
      category: tpl.category,
      shareStatus: "private",
      priceFenPerMonth: 0,
    }).returning();
    return res.status(201).json(serialize(row));
  } catch (err) {
    logger.error({ err }, "add-to-workspace");
    return res.status(500).json({ error: "操作失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/plugins", requireAuth, async (req, res) => {
  try {
    const plugins = await db.select().from(toolPluginsTable).orderBy(desc(toolPluginsTable.createdAt));
    const installs = await db.select({ pluginId: toolPluginInstallsTable.pluginId })
      .from(toolPluginInstallsTable)
      .where(eq(toolPluginInstallsTable.userId, req.user!.id));
    const installedSet = new Set(installs.map((i) => i.pluginId));
    return res.json({ items: plugins.map((p) => serialize({ ...p, installed: installedSet.has(p.id) })) });
  } catch (err) {
    logger.error({ err }, "list plugins");
    return res.status(500).json({ error: "获取失败" });
  }
});

router.post("/tools/plugins/:id/install", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [plugin] = await db.select().from(toolPluginsTable).where(eq(toolPluginsTable.id, id));
    if (!plugin) return res.status(404).json({ error: "插件不存在" });
    const [existing] = await db.select().from(toolPluginInstallsTable).where(and(
      eq(toolPluginInstallsTable.userId, req.user!.id),
      eq(toolPluginInstallsTable.pluginId, id),
    ));
    if (existing) return res.json({ success: true, alreadyInstalled: true });
    await db.insert(toolPluginInstallsTable).values({ userId: req.user!.id, pluginId: id });
    await db.update(toolPluginsTable)
      .set({ installCount: sql`${toolPluginsTable.installCount} + 1`, updatedAt: new Date() })
      .where(eq(toolPluginsTable.id, id));
    return res.status(201).json({ success: true });
  } catch (err) {
    logger.error({ err }, "install plugin");
    return res.status(500).json({ error: "安装失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Earnings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/earnings", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [totalRow] = await db.select({
      total: sql<number>`COALESCE(SUM(${toolEarningsTable.amountFen}), 0)`,
    }).from(toolEarningsTable).where(eq(toolEarningsTable.ownerId, userId));
    const rows = await db.select({
      earning: toolEarningsTable,
      agentName: toolAgentsTable.name,
      subscriberName: usersTable.nickname,
    })
      .from(toolEarningsTable)
      .leftJoin(toolAgentsTable, eq(toolEarningsTable.agentId, toolAgentsTable.id))
      .leftJoin(usersTable, eq(toolEarningsTable.subscriberId, usersTable.id))
      .where(eq(toolEarningsTable.ownerId, userId))
      .orderBy(desc(toolEarningsTable.createdAt));
    return res.json({
      totalFen: Number(totalRow?.total ?? 0),
      items: rows.map((r) => serialize({
        ...r.earning,
        agentName: r.agentName ?? "",
        subscriberName: r.subscriberName ?? "匿名用户",
      })),
    });
  } catch (err) {
    logger.error({ err }, "earnings");
    return res.status(500).json({ error: "获取失败" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tools/subscriptions", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    // 到期处理：过期的 active 订阅惰性标记为 expired
    await db.update(toolSubscriptionsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(
        eq(toolSubscriptionsTable.userId, userId),
        eq(toolSubscriptionsTable.status, "active"),
        sql`${toolSubscriptionsTable.expiresAt} IS NOT NULL AND ${toolSubscriptionsTable.expiresAt} < now()`,
      ));
    const rows = await db.select({
      subscription: toolSubscriptionsTable,
      agentName: toolAgentsTable.name,
      agentIcon: toolAgentsTable.iconUrl,
      authorName: usersTable.nickname,
    })
      .from(toolSubscriptionsTable)
      .leftJoin(toolAgentsTable, eq(toolSubscriptionsTable.agentId, toolAgentsTable.id))
      .leftJoin(usersTable, eq(toolAgentsTable.ownerId, usersTable.id))
      .where(eq(toolSubscriptionsTable.userId, userId))
      .orderBy(desc(toolSubscriptionsTable.createdAt));
    // 累计支出以支付流水表为事实来源：每笔成功扣款一行,续订不覆盖历史
    const [totalRow] = await db.select({
      total: sql<number>`COALESCE(SUM(${toolSubscriptionPaymentsTable.amountFen}), 0)`,
    }).from(toolSubscriptionPaymentsTable)
      .where(eq(toolSubscriptionPaymentsTable.userId, userId));
    const payments = await db.select().from(toolSubscriptionPaymentsTable)
      .where(eq(toolSubscriptionPaymentsTable.userId, userId))
      .orderBy(desc(toolSubscriptionPaymentsTable.paidAt));
    const paymentsBySub = new Map<number, ReturnType<typeof serialize>[]>();
    for (const p of payments) {
      const list = paymentsBySub.get(p.subscriptionId) ?? [];
      list.push(serialize({
        id: p.id,
        amountFen: p.amountFen,
        paymentOrderNo: p.paymentOrderNo,
        paidAt: p.paidAt,
      }));
      paymentsBySub.set(p.subscriptionId, list);
    }
    return res.json({
      totalSpentFen: Number(totalRow?.total ?? 0),
      items: rows.map((r) => serialize({
        ...r.subscription,
        agentName: r.agentName ?? "",
        agentIcon: r.agentIcon ?? null,
        authorName: r.authorName ?? "匿名用户",
        payments: paymentsBySub.get(r.subscription.id) ?? [],
      })),
    });
  } catch (err) {
    logger.error({ err }, "subscriptions");
    return res.status(500).json({ error: "获取失败" });
  }
});

export default router;
