import { Router, type IRouter } from "express";
import { db, skillsTable, agentTaskSkillLinksTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth";
import { fetchSkillFromUrl } from "../lib/skillFetcher";
import { KNOWN_TASK_TYPES } from "../lib/skillRegistry";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use("/admin/skills", requireAdmin);
router.use("/admin/agent-task-types", requireAdmin);

/* ─── POST /api/admin/skills/fetch-preview ─────────────────────────────── */
router.post("/admin/skills/fetch-preview", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "请提供 skill 仓库地址" });
  }
  try {
    const preview = await fetchSkillFromUrl(url.trim());
    return res.json({ data: preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, url }, "skill fetch-preview failed");
    return res.status(422).json({ error: `获取 Skill 失败：${msg}` });
  }
});

/* ─── POST /api/admin/skills ─────────────────────────────────────────────── */
router.post("/admin/skills", async (req, res) => {
  const { url, name: overrideName } = req.body as { url?: string; name?: string };
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "请提供 skill 仓库地址" });
  }
  try {
    const fetched = await fetchSkillFromUrl(url.trim());
    const [row] = await db
      .insert(skillsTable)
      .values({
        name: (overrideName?.trim() || fetched.name),
        description: fetched.description,
        sourceUrl: url.trim(),
        skillMd: fetched.skillMd,
        refFiles: fetched.refFiles,
        version: fetched.version,
        lastSyncedAt: new Date(),
        isActive: true,
      })
      .returning();
    return res.status(201).json({ data: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "skill install failed");
    return res.status(422).json({ error: `安装 Skill 失败：${msg}` });
  }
});

/* ─── GET /api/admin/skills ──────────────────────────────────────────────── */
router.get("/admin/skills", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: skillsTable.id,
        name: skillsTable.name,
        description: skillsTable.description,
        sourceUrl: skillsTable.sourceUrl,
        version: skillsTable.version,
        lastSyncedAt: skillsTable.lastSyncedAt,
        isActive: skillsTable.isActive,
        createdAt: skillsTable.createdAt,
      })
      .from(skillsTable)
      .orderBy(skillsTable.createdAt);
    return res.json({ data: rows });
  } catch (err) {
    logger.error({ err }, "list skills failed");
    return res.status(500).json({ error: "获取 Skill 列表失败" });
  }
});

/* ─── GET /api/admin/skills/:id ─────────────────────────────────────────── */
router.get("/admin/skills/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "无效 ID" });
  try {
    const [row] = await db.select().from(skillsTable).where(eq(skillsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Skill 不存在" });
    return res.json({ data: row });
  } catch (err) {
    logger.error({ err }, "get skill detail failed");
    return res.status(500).json({ error: "获取 Skill 详情失败" });
  }
});

/* ─── POST /api/admin/skills/:id/sync ────────────────────────────────────── */
router.post("/admin/skills/:id/sync", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "无效 ID" });
  try {
    const [existing] = await db.select().from(skillsTable).where(eq(skillsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Skill 不存在" });
    const fetched = await fetchSkillFromUrl(existing.sourceUrl);
    const [updated] = await db
      .update(skillsTable)
      .set({
        name: fetched.name,
        description: fetched.description,
        skillMd: fetched.skillMd,
        refFiles: fetched.refFiles,
        version: fetched.version,
        lastSyncedAt: new Date(),
      })
      .where(eq(skillsTable.id, id))
      .returning();
    return res.json({ data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "skill sync failed");
    return res.status(422).json({ error: `同步 Skill 失败：${msg}` });
  }
});

/* ─── PATCH /api/admin/skills/:id ────────────────────────────────────────── */
router.patch("/admin/skills/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "无效 ID" });
  const { isActive, name } = req.body as { isActive?: boolean; name?: string };
  const patch: Record<string, unknown> = {};
  if (typeof isActive === "boolean") patch.isActive = isActive;
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "无有效更新字段" });
  try {
    const [updated] = await db.update(skillsTable).set(patch).where(eq(skillsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Skill 不存在" });
    return res.json({ data: updated });
  } catch (err) {
    logger.error({ err }, "patch skill failed");
    return res.status(500).json({ error: "更新 Skill 失败" });
  }
});

/* ─── DELETE /api/admin/skills/:id ───────────────────────────────────────── */
router.delete("/admin/skills/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "无效 ID" });
  try {
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(agentTaskSkillLinksTable)
      .where(eq(agentTaskSkillLinksTable.skillId, id));
    if (Number(cnt) > 0) {
      return res.status(409).json({ error: "该 Skill 已被任务模板引用，请先从模板中移除后再删除" });
    }
    const [deleted] = await db.delete(skillsTable).where(eq(skillsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Skill 不存在" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete skill failed");
    return res.status(500).json({ error: "删除 Skill 失败" });
  }
});

/* ─── GET /api/admin/agent-task-types ────────────────────────────────────── */
router.get("/admin/agent-task-types", async (_req, res) => {
  return res.json({ data: KNOWN_TASK_TYPES });
});

/* ─── GET /api/admin/agent-task-types/:taskType/skills ───────────────────── */
router.get("/admin/agent-task-types/:taskType/skills", async (req, res) => {
  const { taskType } = req.params;
  try {
    const rows = await db
      .select({
        id: agentTaskSkillLinksTable.id,
        skillId: agentTaskSkillLinksTable.skillId,
        sortOrder: agentTaskSkillLinksTable.sortOrder,
        name: skillsTable.name,
        description: skillsTable.description,
        isActive: skillsTable.isActive,
        skillMd: skillsTable.skillMd,
        refFiles: skillsTable.refFiles,
      })
      .from(agentTaskSkillLinksTable)
      .innerJoin(skillsTable, eq(agentTaskSkillLinksTable.skillId, skillsTable.id))
      .where(eq(agentTaskSkillLinksTable.taskType, taskType))
      .orderBy(agentTaskSkillLinksTable.sortOrder);
    return res.json({ data: rows });
  } catch (err) {
    logger.error({ err }, "get task skills failed");
    return res.status(500).json({ error: "获取任务 Skill 列表失败" });
  }
});

/* ─── PUT /api/admin/agent-task-types/:taskType/skills ───────────────────── */
router.put("/admin/agent-task-types/:taskType/skills", async (req, res) => {
  const { taskType } = req.params;
  const { skills } = req.body as { skills?: Array<{ skillId: number; sortOrder: number }> };

  if (!KNOWN_TASK_TYPES.some(tt => tt.taskType === taskType)) {
    return res.status(400).json({ error: `未知任务类型：${taskType}` });
  }
  if (!Array.isArray(skills)) return res.status(400).json({ error: "skills 字段必须是数组" });

  if (skills.length > 0) {
    const ids = skills.map(s => s.skillId);
    const found = await db
      .select({ id: skillsTable.id })
      .from(skillsTable)
      .where(inArray(skillsTable.id, ids));
    const foundIds = new Set(found.map(r => r.id));
    const missing = ids.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Skill ID 不存在：${missing.join(", ")}` });
    }
  }

  try {
    let resultRows: typeof skills = [];
    await db.transaction(async (tx) => {
      await tx.delete(agentTaskSkillLinksTable).where(eq(agentTaskSkillLinksTable.taskType, taskType));
      if (skills.length > 0) {
        await tx.insert(agentTaskSkillLinksTable).values(
          skills.map((s) => ({
            taskType,
            skillId: s.skillId,
            sortOrder: s.sortOrder ?? 0,
          }))
        );
      }
    });

    const rows = await db
      .select({
        id: agentTaskSkillLinksTable.id,
        skillId: agentTaskSkillLinksTable.skillId,
        sortOrder: agentTaskSkillLinksTable.sortOrder,
        name: skillsTable.name,
        description: skillsTable.description,
        isActive: skillsTable.isActive,
        skillMd: skillsTable.skillMd,
        refFiles: skillsTable.refFiles,
      })
      .from(agentTaskSkillLinksTable)
      .innerJoin(skillsTable, eq(agentTaskSkillLinksTable.skillId, skillsTable.id))
      .where(eq(agentTaskSkillLinksTable.taskType, taskType))
      .orderBy(agentTaskSkillLinksTable.sortOrder);
    return res.json({ data: rows });
  } catch (err) {
    logger.error({ err }, "put task skills failed");
    return res.status(500).json({ error: "更新任务 Skill 列表失败" });
  }
});

export default router;
