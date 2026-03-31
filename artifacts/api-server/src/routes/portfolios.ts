import { Router, type IRouter } from "express";
import { db, portfoliosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListPortfoliosQueryParams,
  CreatePortfolioBody,
  UpdatePortfolioBody,
} from "@workspace/api-zod";

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

router.get("/portfolios", async (req, res) => {
  try {
    const params = ListPortfoliosQueryParams.parse(req.query);
    const conditions = [];
    if (params.userId) conditions.push(eq(portfoliosTable.userId, params.userId));

    const items = await db.select().from(portfoliosTable).where(conditions.length > 0 ? conditions[0] : undefined);

    res.json(items.map(formatPortfolio));
  } catch (error) {
    res.status(500).json({ error: "Failed to list portfolios" });
  }
});

router.post("/portfolios", async (req, res) => {
  try {
    const body = CreatePortfolioBody.parse(req.body);
    const extra = req.body as Record<string, unknown>;
    const applyLevel = extra.applyLevel ? String(extra.applyLevel) : null;

    const [portfolio] = await db.insert(portfoliosTable).values({
      userId: body.userId,
      title: body.title,
      type: body.type,
      coverImage: body.coverImage,
      description: body.description,
      projectUrl: body.projectUrl,
      applyLevel,
      levelApplyStatus: applyLevel ? "pending" : null,
    }).returning();

    res.status(201).json(formatPortfolio(portfolio));
  } catch (error) {
    res.status(500).json({ error: "Failed to create portfolio" });
  }
});

router.put("/portfolios/:portfolioId", async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId);
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

    res.json(formatPortfolio(updated));
  } catch (error) {
    res.status(500).json({ error: "Failed to update portfolio" });
  }
});

router.delete("/portfolios/:portfolioId", async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId);
    await db.delete(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete portfolio" });
  }
});

export default router;
