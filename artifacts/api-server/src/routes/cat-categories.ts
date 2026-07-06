import { Router, type IRouter, type Request, type Response } from "express";
import { db, catCategoriesTable, catTagsTable, quoteDimensionsTable, quoteTiersTable } from "@workspace/db";
import { eq, asc, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function autoCode(prefix: string): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}`;
}

/* ─── Public: list active categories with nested tags ─── */
router.get("/cat-categories", async (_req: Request, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(catCategoriesTable)
      .where(eq(catCategoriesTable.isActive, true))
      .orderBy(asc(catCategoriesTable.sortOrder));

    const tags = await db
      .select()
      .from(catTagsTable)
      .where(eq(catTagsTable.isActive, true))
      .orderBy(asc(catTagsTable.sortOrder));

    const result = categories.map((cat) => ({
      ...cat,
      tags: tags.filter((t) => t.catCategoryId === cat.id),
    }));

    return res.json(result);
  } catch (error) {
    logger.error({ error }, "Failed to list cat categories");
    return res.status(500).json({ error: "获取分类列表失败" });
  }
});

/* ─── Admin: CRUD for cat_categories ─── */

router.get("/admin/cat-categories", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(catCategoriesTable)
      .orderBy(asc(catCategoriesTable.sortOrder));

    const tags = await db
      .select()
      .from(catTagsTable)
      .orderBy(asc(catTagsTable.sortOrder));

    const result = categories.map((cat) => ({
      ...cat,
      tags: tags.filter((t) => t.catCategoryId === cat.id),
    }));

    return res.json(result);
  } catch (error) {
    logger.error({ error }, "Failed to list admin cat categories");
    return res.status(500).json({ error: "获取分类列表失败" });
  }
});

router.post("/admin/cat-categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, colorHex, icon, sortOrder, isActive, docTemplate } = req.body as {
      name: string; description?: string; colorHex?: string;
      icon?: string; sortOrder?: number; isActive?: boolean; docTemplate?: string;
    };
    if (!name?.trim()) {
      return res.status(400).json({ error: "分类名称不能为空" });
    }
    const [created] = await db.insert(catCategoriesTable).values({
      code: autoCode("CAT"),
      name: name.trim(),
      description: description?.trim(),
      colorHex: colorHex?.trim(),
      icon: icon?.trim(),
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
      docTemplate: docTemplate?.trim() || null,
    }).returning();
    return res.status(201).json(created);
  } catch (error: any) {
    logger.error({ error }, "Failed to create cat category");
    return res.status(500).json({ error: "创建分类失败" });
  }
});

router.put("/admin/cat-categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, colorHex, icon, sortOrder, isActive, docTemplate } = req.body as {
      name?: string; description?: string; colorHex?: string;
      icon?: string; sortOrder?: number; isActive?: boolean; docTemplate?: string | null;
    };
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (colorHex !== undefined) updateData.colorHex = colorHex.trim();
    if (icon !== undefined) updateData.icon = icon.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (docTemplate !== undefined) updateData.docTemplate = docTemplate === null ? null : docTemplate;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有可更新的字段" });
    }

    const [updated] = await db
      .update(catCategoriesTable)
      .set(updateData)
      .where(eq(catCategoriesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "分类不存在" });
    return res.json(updated);
  } catch (error: any) {
    logger.error({ error }, "Failed to update cat category");
    return res.status(500).json({ error: "更新分类失败" });
  }
});

router.delete("/admin/cat-categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(catCategoriesTable)
      .where(eq(catCategoriesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "分类不存在" });
    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete cat category");
    return res.status(500).json({ error: "删除分类失败" });
  }
});

/* ─── Admin: CRUD for cat_tags ─── */

router.get("/admin/cat-tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const catCategoryId = req.query.catCategoryId ? parseInt(req.query.catCategoryId as string) : undefined;
    const query = db.select().from(catTagsTable).orderBy(asc(catTagsTable.sortOrder));
    const tags = catCategoryId
      ? await db.select().from(catTagsTable).where(eq(catTagsTable.catCategoryId, catCategoryId)).orderBy(asc(catTagsTable.sortOrder))
      : await query;
    return res.json(tags);
  } catch (error) {
    logger.error({ error }, "Failed to list cat tags");
    return res.status(500).json({ error: "获取标签列表失败" });
  }
});

router.post("/admin/cat-tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { catCategoryId, name, description, sortOrder, isActive } = req.body as {
      catCategoryId: number; name: string; description?: string;
      sortOrder?: number; isActive?: boolean;
    };
    if (!catCategoryId) {
      return res.status(400).json({ error: "请选择所属大类" });
    }
    if (!name?.trim()) {
      return res.status(400).json({ error: "标签名称不能为空" });
    }
    const [created] = await db.insert(catTagsTable).values({
      catCategoryId,
      code: autoCode("TAG"),
      name: name.trim(),
      description: description?.trim(),
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    }).returning();
    return res.status(201).json(created);
  } catch (error: any) {
    logger.error({ error }, "Failed to create cat tag");
    return res.status(500).json({ error: "创建标签失败" });
  }
});

router.put("/admin/cat-tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sortOrder, isActive, catCategoryId } = req.body as {
      name?: string; description?: string; sortOrder?: number;
      isActive?: boolean; catCategoryId?: number;
    };
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (catCategoryId !== undefined) updateData.catCategoryId = catCategoryId;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有可更新的字段" });
    }

    const [updated] = await db
      .update(catTagsTable)
      .set(updateData)
      .where(eq(catTagsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "标签不存在" });
    return res.json(updated);
  } catch (error: any) {
    logger.error({ error }, "Failed to update cat tag");
    return res.status(500).json({ error: "更新标签失败" });
  }
});

router.delete("/admin/cat-tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(catTagsTable)
      .where(eq(catTagsTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "标签不存在" });
    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete cat tag");
    return res.status(500).json({ error: "删除标签失败" });
  }
});

/* ─── Public: GET /quote-card/config?category=X ─────────────────────────── */
router.get("/quote-card/config", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    if (!category) return res.status(400).json({ error: "category 参数必填" });

    const dims = await db.select().from(quoteDimensionsTable)
      .where(and(eq(quoteDimensionsTable.category, category), eq(quoteDimensionsTable.isActive, true)))
      .orderBy(asc(quoteDimensionsTable.layer), asc(quoteDimensionsTable.sortOrder));

    if (dims.length === 0) return res.json({ category, base: [], adjustment: [], optional: [] });

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
      id: d.id, code: d.code, label: d.label, description: d.description, sortOrder: d.sortOrder,
      tiers: (tiersByDim.get(d.id) ?? []).map(t => ({
        id: t.id, tier: t.tier, tierLabel: t.tierLabel,
        basePrice: t.basePrice, coefficient: t.coefficient,
        description: t.description, sortOrder: t.sortOrder,
      })),
    });

    return res.json({
      category,
      base: dims.filter(d => d.layer === "base").map(mapDim),
      adjustment: dims.filter(d => d.layer === "adjustment").map(mapDim),
      optional: dims.filter(d => d.layer === "optional").map(mapDim),
    });
  } catch (err) {
    logger.error({ err }, "GET /quote-card/config error");
    return res.status(500).json({ error: "获取报价卡配置失败" });
  }
});

export default router;
