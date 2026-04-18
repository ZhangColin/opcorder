import { Router, type IRouter } from "express";
import { db, portfoliosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/* Public — viewing portfolios requires no auth (OPC showcase) */
router.get("/portfolios", async (req, res) => {
  try {
    const params = ListPortfoliosQueryParams.parse(req.query);
    const conditions = [];
    if (params.userId) conditions.push(eq(portfoliosTable.userId, params.userId));

    const items = await db.select().from(portfoliosTable).where(conditions.length > 0 ? conditions[0] : undefined);

    return res.json(items.map(formatPortfolio));
  } catch (error) {
    return res.status(500).json({ error: "Failed to list portfolios" });
  }
});

router.post("/portfolios", requireAuth, async (req, res) => {
  try {
    const body = CreatePortfolioBody.parse(req.body);
    const userId = req.user!.id;

    const extra = req.body as Record<string, unknown>;
    const applyLevel = extra.applyLevel ? String(extra.applyLevel) : null;

    const [portfolio] = await db.insert(portfoliosTable).values({
      userId,
      title: body.title,
      type: body.type,
      coverImage: body.coverImage,
      description: body.description,
      projectUrl: body.projectUrl,
      applyLevel,
      levelApplyStatus: applyLevel ? "pending" : null,
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

    if ("applyLevel" in extra) {
      const applyLevel = extra.applyLevel ? String(extra.applyLevel) : null;
      updateData.applyLevel = applyLevel;
      updateData.levelApplyStatus = applyLevel ? "pending" : null;
      updateData.levelApplyNote = null;
      updateData.reviewedAt = null;
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

export default router;
