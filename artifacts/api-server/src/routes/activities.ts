import { Router, type IRouter } from "express";
import { db, activitiesTable, activityFieldsTable, registrationsTable, registrationTagsTable } from "@workspace/db";
import { eq, desc, count, and, ilike, or, inArray, sql } from "drizzle-orm";
import { requireAdmin, requirePermission } from "../middleware/adminAuth";

const router: IRouter = Router();

function paginate(query: Record<string, string | string[] | undefined>, defaultSize = 20) {
  const page = Math.max(1, parseInt(String(query.page ?? 1)) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? defaultSize)) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/* ─── Public: get activity info (no auth) ─────────────── */

router.get("/activities/:id/public", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "无效的活动ID" });

    const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!activity) return res.status(404).json({ error: "活动不存在" });
    if (activity.status !== "active") return res.status(404).json({ error: "活动未开放报名" });

    const fields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, id))
      .orderBy(activityFieldsTable.sortOrder);

    res.json({ ...activity, fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取活动信息失败" });
  }
});

/* ─── Public: submit registration (no auth) ──────────── */

router.post("/activities/:id/register", async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    if (!activityId) return res.status(400).json({ error: "无效的活动ID" });

    const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, activityId)).limit(1);
    if (!activity) return res.status(404).json({ error: "活动不存在" });
    if (activity.status !== "active") return res.status(400).json({ error: "活动当前未开放报名" });

    const fields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, activityId))
      .orderBy(activityFieldsTable.sortOrder);

    const { name, phone, email, organization, extraData } = req.body as {
      name: string;
      phone?: string;
      email?: string;
      organization?: string;
      extraData?: Record<string, string | string[]>;
    };

    if (!name?.trim()) return res.status(400).json({ error: "姓名不能为空" });

    const extra = extraData ?? {};
    for (const field of fields) {
      if (!field.isRequired) continue;
      const val = extra[field.label];
      const isEmpty = val === undefined || val === null || val === "" ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        return res.status(400).json({ error: `"${field.label}"为必填项` });
      }
    }

    const [registration] = await db.insert(registrationsTable).values({
      activityId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      organization: organization?.trim() || null,
      extraData: extraData ?? {},
    }).returning();

    res.status(201).json({ id: registration.id, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "提交报名失败" });
  }
});

/* ─── Admin routes (require admin auth + activities permission) ──────────── */

router.use("/admin/activities", requireAdmin, requirePermission("activities"));
router.use("/admin/registrations", requireAdmin, requirePermission("activities"));

/* List activities */
router.get("/admin/activities", async (req, res) => {
  try {
    const { q, status } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query);

    const conditions = [];
    if (q) conditions.push(ilike(activitiesTable.title, `%${q}%`));
    // status filter maps directly to DB status column: draft/active/ended
    if (status === "draft" || status === "active" || status === "ended") {
      conditions.push(eq(activitiesTable.status, status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(activitiesTable).where(where);

    const activities = await db.select().from(activitiesTable)
      .where(where)
      .orderBy(desc(activitiesTable.createdAt))
      .limit(pageSize).offset(offset);

    const withCounts = await Promise.all(activities.map(async (a) => {
      const [{ cnt }] = await db.select({ cnt: count() })
        .from(registrationsTable)
        .where(eq(registrationsTable.activityId, a.id));
      return { ...a, registrationCount: Number(cnt) };
    }));

    res.json({ data: withCounts, total: Number(total), page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取活动列表失败" });
  }
});

/* Get single activity with fields */
router.get("/admin/activities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!activity) return res.status(404).json({ error: "活动不存在" });

    const fields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, id))
      .orderBy(activityFieldsTable.sortOrder);

    res.json({ ...activity, fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取活动详情失败" });
  }
});

/* Create activity */
router.post("/admin/activities", async (req, res) => {
  try {
    const { title, description, location, startTime, endTime, fields } = req.body as {
      title: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      fields?: Array<{ label: string; fieldType: string; isRequired: boolean; options?: string[]; sortOrder?: number }>;
    };

    if (!title?.trim()) return res.status(400).json({ error: "活动名称不能为空" });

    const [activity] = await db.insert(activitiesTable).values({
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      status: "draft",
    }).returning();

    if (fields && fields.length > 0) {
      await db.insert(activityFieldsTable).values(
        fields.map((f, i) => ({
          activityId: activity.id,
          label: f.label.trim(),
          fieldType: f.fieldType || "text",
          isRequired: f.isRequired ?? false,
          options: f.options ?? [],
          sortOrder: f.sortOrder ?? i,
        }))
      );
    }

    const savedFields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, activity.id))
      .orderBy(activityFieldsTable.sortOrder);

    res.status(201).json({ ...activity, fields: savedFields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "创建活动失败" });
  }
});

/* Update activity */
router.put("/admin/activities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, location, startTime, endTime, fields } = req.body as {
      title?: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      fields?: Array<{ label: string; fieldType: string; isRequired: boolean; options?: string[]; sortOrder?: number }>;
    };

    const [existing] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "活动不存在" });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

    const [updated] = await db.update(activitiesTable).set(updateData as Partial<typeof activitiesTable.$inferInsert>).where(eq(activitiesTable.id, id)).returning();

    if (fields !== undefined) {
      await db.delete(activityFieldsTable).where(eq(activityFieldsTable.activityId, id));
      if (fields.length > 0) {
        await db.insert(activityFieldsTable).values(
          fields.map((f, i) => ({
            activityId: id,
            label: f.label.trim(),
            fieldType: f.fieldType || "text",
            isRequired: f.isRequired ?? false,
            options: f.options ?? [],
            sortOrder: f.sortOrder ?? i,
          }))
        );
      }
    }

    const savedFields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, id))
      .orderBy(activityFieldsTable.sortOrder);

    res.json({ ...updated, fields: savedFields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新活动失败" });
  }
});

/* Delete activity */
router.delete("/admin/activities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(activitiesTable).where(eq(activitiesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "删除活动失败" });
  }
});

/* Publish activity: draft → active */
router.patch("/admin/activities/:id/publish", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ status: activitiesTable.status })
      .from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "活动不存在" });
    if (existing.status !== "draft") return res.status(400).json({ error: "只有草稿状态的活动才能发布" });

    const [updated] = await db.update(activitiesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(activitiesTable.id, id))
      .returning({ status: activitiesTable.status });

    res.json({ status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "发布活动失败" });
  }
});

/* Unpublish activity: active → draft */
router.patch("/admin/activities/:id/unpublish", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ status: activitiesTable.status })
      .from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "活动不存在" });
    if (existing.status !== "active") return res.status(400).json({ error: "只有进行中的活动才能退回草稿" });

    const [updated] = await db.update(activitiesTable)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(activitiesTable.id, id))
      .returning({ status: activitiesTable.status });

    res.json({ status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "退回草稿失败" });
  }
});

/* End activity: active → ended */
router.patch("/admin/activities/:id/end", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ status: activitiesTable.status })
      .from(activitiesTable).where(eq(activitiesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "活动不存在" });
    if (existing.status !== "active") return res.status(400).json({ error: "只有进行中的活动才能结束" });

    const [updated] = await db.update(activitiesTable)
      .set({ status: "ended", updatedAt: new Date() })
      .where(eq(activitiesTable.id, id))
      .returning({ status: activitiesTable.status });

    res.json({ status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "结束活动失败" });
  }
});

/* ─── Admin: registrations ───────────────────────── */

/* List registrations for an activity */
router.get("/admin/activities/:id/registrations", async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    const { q } = req.query as Record<string, string>;
    const { page, pageSize, offset } = paginate(req.query);

    // Build WHERE: always filter by activityId, optionally by q (name/phone/email fuzzy OR tag fuzzy)
    let baseWhere = eq(registrationsTable.activityId, activityId);
    let where;
    if (q) {
      // Find reg IDs with matching tags for this activity
      const tagMatches = await db.select({ registrationId: registrationTagsTable.registrationId })
        .from(registrationTagsTable)
        .where(and(
          ilike(registrationTagsTable.tag, `%${q}%`),
          sql`${registrationTagsTable.registrationId} IN (SELECT id FROM registrations WHERE activity_id = ${activityId})`,
        ));
      const tagRegIds = tagMatches.map(r => r.registrationId);

      const textMatch = or(
        ilike(registrationsTable.name, `%${q}%`),
        ilike(registrationsTable.phone, `%${q}%`),
        ilike(registrationsTable.email, `%${q}%`),
        ...(tagRegIds.length > 0 ? [inArray(registrationsTable.id, tagRegIds)] : []),
      );
      where = and(baseWhere, textMatch);
    } else {
      where = baseWhere;
    }

    const [{ total }] = await db.select({ total: count() }).from(registrationsTable).where(where);

    const registrations = await db.select().from(registrationsTable)
      .where(where)
      .orderBy(desc(registrationsTable.createdAt))
      .limit(pageSize).offset(offset);

    const withTags = await Promise.all(registrations.map(async (r) => {
      const tags = await db.select({ tag: registrationTagsTable.tag })
        .from(registrationTagsTable)
        .where(eq(registrationTagsTable.registrationId, r.id));
      return { ...r, tags: tags.map(t => t.tag) };
    }));

    res.json({ data: withTags, total: Number(total), page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取报名列表失败" });
  }
});

/* Export registrations as CSV */
router.get("/admin/activities/:id/registrations/export", async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    const { q } = req.query as Record<string, string>;

    const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, activityId)).limit(1);
    if (!activity) return res.status(404).json({ error: "活动不存在" });

    const fields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, activityId))
      .orderBy(activityFieldsTable.sortOrder);

    // Build WHERE (same logic as list)
    let baseWhere = eq(registrationsTable.activityId, activityId);
    let where;
    if (q) {
      const tagMatches = await db.select({ registrationId: registrationTagsTable.registrationId })
        .from(registrationTagsTable)
        .where(and(
          ilike(registrationTagsTable.tag, `%${q}%`),
          sql`${registrationTagsTable.registrationId} IN (SELECT id FROM registrations WHERE activity_id = ${activityId})`,
        ));
      const tagRegIds = tagMatches.map(r => r.registrationId);
      const textMatch = or(
        ilike(registrationsTable.name, `%${q}%`),
        ilike(registrationsTable.phone, `%${q}%`),
        ilike(registrationsTable.email, `%${q}%`),
        ...(tagRegIds.length > 0 ? [inArray(registrationsTable.id, tagRegIds)] : []),
      );
      where = and(baseWhere, textMatch);
    } else {
      where = baseWhere;
    }

    const registrations = await db.select().from(registrationsTable)
      .where(where)
      .orderBy(desc(registrationsTable.createdAt));

    const withTags = await Promise.all(registrations.map(async (r) => {
      const tags = await db.select({ tag: registrationTagsTable.tag })
        .from(registrationTagsTable)
        .where(eq(registrationTagsTable.registrationId, r.id));
      return { ...r, tags: tags.map(t => t.tag).join("|") };
    }));

    // Build CSV
    function csvCell(v: unknown): string {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const extraLabels = fields.map(f => f.label);
    const headers = ["ID", "姓名", "手机号", "邮箱", "单位/公司", ...extraLabels, "标签", "管理员备注", "报名时间"];

    const rows = withTags.map(r => {
      const extra = (r.extraData ?? {}) as Record<string, string | string[]>;
      const extraCells = extraLabels.map(label => {
        const val = extra[label];
        return Array.isArray(val) ? val.join("|") : (val ?? "");
      });
      return [
        r.id, r.name, r.phone ?? "", r.email ?? "", r.organization ?? "",
        ...extraCells,
        r.tags, r.adminNote ?? "",
        new Date(r.createdAt).toLocaleString("zh-CN"),
      ].map(csvCell).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = encodeURIComponent(`${activity.title}-报名名单.csv`);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send("\uFEFF" + csv); // BOM for Excel compatibility
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "导出失败" });
  }
});

/* Get single registration */
router.get("/admin/registrations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [reg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, id)).limit(1);
    if (!reg) return res.status(404).json({ error: "报名记录不存在" });

    const tags = await db.select({ tag: registrationTagsTable.tag })
      .from(registrationTagsTable)
      .where(eq(registrationTagsTable.registrationId, id));

    const fields = await db.select().from(activityFieldsTable)
      .where(eq(activityFieldsTable.activityId, reg.activityId))
      .orderBy(activityFieldsTable.sortOrder);

    res.json({ ...reg, tags: tags.map(t => t.tag), fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取报名详情失败" });
  }
});

/* Update admin note */
router.patch("/admin/registrations/:id/note", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { note } = req.body as { note: string };

    await db.update(registrationsTable)
      .set({ adminNote: note ?? null })
      .where(eq(registrationsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新备注失败" });
  }
});

/* Add tag */
router.post("/admin/registrations/:id/tags", async (req, res) => {
  try {
    const registrationId = Number(req.params.id);
    const { tag } = req.body as { tag: string };

    if (!tag?.trim()) return res.status(400).json({ error: "标签不能为空" });

    const existing = await db.select().from(registrationTagsTable)
      .where(and(
        eq(registrationTagsTable.registrationId, registrationId),
        eq(registrationTagsTable.tag, tag.trim()),
      )).limit(1);

    if (existing.length === 0) {
      await db.insert(registrationTagsTable).values({
        registrationId,
        tag: tag.trim(),
      });
    }

    const tags = await db.select({ tag: registrationTagsTable.tag })
      .from(registrationTagsTable)
      .where(eq(registrationTagsTable.registrationId, registrationId));

    res.json({ tags: tags.map(t => t.tag) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "添加标签失败" });
  }
});

/* Delete tag */
router.delete("/admin/registrations/:id/tags/:tag", async (req, res) => {
  try {
    const registrationId = Number(req.params.id);
    const tag = decodeURIComponent(req.params.tag);

    await db.delete(registrationTagsTable).where(
      and(
        eq(registrationTagsTable.registrationId, registrationId),
        eq(registrationTagsTable.tag, tag),
      )
    );

    const tags = await db.select({ tag: registrationTagsTable.tag })
      .from(registrationTagsTable)
      .where(eq(registrationTagsTable.registrationId, registrationId));

    res.json({ tags: tags.map(t => t.tag) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "删除标签失败" });
  }
});

/* Get all tags used in an activity's registrations (for filter dropdown) */
router.get("/admin/activities/:id/tags", async (req, res) => {
  try {
    const activityId = Number(req.params.id);
    const tags = await db.execute(sql`
      SELECT DISTINCT rt.tag FROM registration_tags rt
      INNER JOIN registrations r ON r.id = rt.registration_id
      WHERE r.activity_id = ${activityId}
      ORDER BY rt.tag
    `);
    res.json({ tags: (tags.rows as { tag: string }[]).map(r => r.tag) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取标签列表失败" });
  }
});

export default router;
