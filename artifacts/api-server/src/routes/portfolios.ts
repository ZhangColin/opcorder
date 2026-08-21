import { Router, type IRouter } from "express";
import { db, portfoliosTable, catCategoriesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  ListPortfoliosQueryParams,
  CreatePortfolioBody,
  UpdatePortfolioBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function formatPortfolio(p: typeof portfoliosTable.$inferSelect) {
  return {
    ...p,
    applyLevel: p.applyLevel ?? null,
    levelApplyStatus: p.levelApplyStatus ?? null,
    levelApplyNote: p.levelApplyNote ?? null,
    catCategoryId: p.catCategoryId ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/* Public — viewing portfolios requires no auth (OPC showcase) */
router.get("/portfolios", async (req, res) => {
  try {
    const params = ListPortfoliosQueryParams.parse(req.query);
    const filterCatId = req.query.catCategoryId ? Number(req.query.catCategoryId) : null;

    const conditions = [];
    if (params.userId) conditions.push(eq(portfoliosTable.userId, params.userId));
    if (filterCatId)   conditions.push(eq(portfoliosTable.catCategoryId, filterCatId));

    const rows = await db
      .select({
        portfolio:        portfoliosTable,
        catCategoryName:  catCategoriesTable.name,
        catCategoryIcon:  catCategoriesTable.icon,
      })
      .from(portfoliosTable)
      .leftJoin(catCategoriesTable, eq(portfoliosTable.catCategoryId, catCategoriesTable.id))
      .where(conditions.length > 1 ? and(...conditions) : conditions.length === 1 ? conditions[0] : undefined);

    return res.json(rows.map(row => ({
      ...formatPortfolio(row.portfolio),
      catCategoryName: row.catCategoryName ?? null,
      catCategoryIcon: row.catCategoryIcon ?? null,
    })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to list portfolios" });
  }
});

router.post("/portfolios", requireAuth, async (req, res) => {
  try {
    const body = CreatePortfolioBody.parse(req.body);
    const userId = req.user!.id;

    const extra = req.body as Record<string, unknown>;
    const catCategoryId = extra.catCategoryId ? Number(extra.catCategoryId) : null;

    if (extra.applyLevel) {
      return res.status(410).json({ error: "作品申请 OPC 等级认证已关闭" });
    }

    const [portfolio] = await db.insert(portfoliosTable).values({
      userId,
      title: body.title,
      type: body.type,
      coverImage: body.coverImage,
      description: body.description,
      projectUrl: body.projectUrl,
      applyLevel: null,
      levelApplyStatus: null,
      catCategoryId: catCategoryId ?? undefined,
    }).returning();

    return res.status(201).json(formatPortfolio(portfolio));
  } catch (error) {
    return res.status(500).json({ error: "Failed to create portfolio" });
  }
});

router.put("/portfolios/:portfolioId", requireAuth, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId as string);

    const [existing] = await db
      .select({ userId: portfoliosTable.userId })
      .from(portfoliosTable)
      .where(eq(portfoliosTable.id, portfolioId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "作品集不存在" });
    if (req.user!.id !== existing.userId) {
      return res.status(403).json({ error: "无权修改他人作品集" });
    }

    const body = UpdatePortfolioBody.parse(req.body);
    const extra = req.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.projectUrl !== undefined) updateData.projectUrl = body.projectUrl;

    if (extra.applyLevel) {
      return res.status(410).json({ error: "作品申请 OPC 等级认证已关闭" });
    }
    if ("catCategoryId" in extra) {
      updateData.catCategoryId = extra.catCategoryId ? Number(extra.catCategoryId) : null;
    }

    const [updated] = await db.update(portfoliosTable).set(updateData).where(eq(portfoliosTable.id, portfolioId)).returning();

    return res.json(formatPortfolio(updated));
  } catch (error) {
    return res.status(500).json({ error: "Failed to update portfolio" });
  }
});

router.delete("/portfolios/:portfolioId", requireAuth, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId as string);

    const [existing] = await db
      .select({ userId: portfoliosTable.userId })
      .from(portfoliosTable)
      .where(eq(portfoliosTable.id, portfolioId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "作品集不存在" });
    if (req.user!.id !== existing.userId) {
      return res.status(403).json({ error: "无权删除他人作品集" });
    }

    await db.delete(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete portfolio" });
  }
});

/* ─── OPC Track Certs ────────────────────────────── */

router.get("/opc/track-certs", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rows = (await db.execute(sql`
      SELECT
        otc.id,
        otc.level,
        otc.status,
        otc.certified_at,
        cc.id   AS cat_category_id,
        cc.name AS cat_category_name,
        cc.icon AS cat_category_icon
      FROM opc_track_certs otc
      JOIN cat_categories cc ON cc.id = otc.cat_category_id
      WHERE otc.user_id = ${userId}
      ORDER BY otc.certified_at DESC
    `)).rows as Array<{
      id: number;
      level: string;
      status: string;
      certified_at: string;
      cat_category_id: number;
      cat_category_name: string;
      cat_category_icon: string | null;
    }>;
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "获取赛道认证失败" });
  }
});

export default router;
