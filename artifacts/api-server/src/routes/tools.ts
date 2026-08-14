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
  toolEarningsTable,
  toolPluginsTable,
  toolPluginInstallsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

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

    // 幂等：已有 active 订阅时直接返回,不重复写入
    const [active] = await db.select().from(toolSubscriptionsTable).where(and(
      eq(toolSubscriptionsTable.userId, userId),
      eq(toolSubscriptionsTable.agentId, agentId),
      eq(toolSubscriptionsTable.status, "active"),
    ));
    if (active) return res.json(serialize(active));

    const amountFen = agent.priceFenPerMonth ?? 0;
    const sub = await db.transaction(async (tx) => {
      const [created] = await tx.insert(toolSubscriptionsTable).values({
        userId,
        agentId,
        amountFen,
        status: "active",
      }).returning();
      await tx.insert(toolEarningsTable).values({
        ownerId: agent.ownerId,
        agentId,
        subscriberId: userId,
        amountFen,
      });
      return created;
    });

    return res.status(201).json(serialize(sub));
  } catch (err) {
    logger.error({ err }, "subscribe");
    return res.status(500).json({ error: "订阅失败" });
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
    const [totalRow] = await db.select({
      total: sql<number>`COALESCE(SUM(${toolSubscriptionsTable.amountFen}), 0)`,
    }).from(toolSubscriptionsTable).where(eq(toolSubscriptionsTable.userId, userId));
    return res.json({
      totalSpentFen: Number(totalRow?.total ?? 0),
      items: rows.map((r) => serialize({
        ...r.subscription,
        agentName: r.agentName ?? "",
        agentIcon: r.agentIcon ?? null,
        authorName: r.authorName ?? "匿名用户",
      })),
    });
  } catch (err) {
    logger.error({ err }, "subscriptions");
    return res.status(500).json({ error: "获取失败" });
  }
});

export default router;
