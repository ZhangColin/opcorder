import { Router, type IRouter } from "express";
import { db, portfoliosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListPortfoliosQueryParams,
  CreatePortfolioBody,
  UpdatePortfolioBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/portfolios", async (req, res) => {
  try {
    const params = ListPortfoliosQueryParams.parse(req.query);
    const conditions = [];
    if (params.userId) conditions.push(eq(portfoliosTable.userId, params.userId));

    const items = await db.select().from(portfoliosTable).where(conditions.length > 0 ? conditions[0] : undefined);

    res.json(items.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to list portfolios" });
  }
});

router.post("/portfolios", async (req, res) => {
  try {
    const body = CreatePortfolioBody.parse(req.body);

    const [portfolio] = await db.insert(portfoliosTable).values({
      userId: body.userId,
      title: body.title,
      type: body.type,
      coverImage: body.coverImage,
      description: body.description,
      projectUrl: body.projectUrl,
    }).returning();

    res.status(201).json({
      ...portfolio,
      createdAt: portfolio.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create portfolio" });
  }
});

router.put("/portfolios/:portfolioId", async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.portfolioId);
    const body = UpdatePortfolioBody.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.projectUrl !== undefined) updateData.projectUrl = body.projectUrl;

    const [updated] = await db.update(portfoliosTable).set(updateData).where(eq(portfoliosTable.id, portfolioId)).returning();

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
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
