import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, contractTemplatesTable, contractPlaceholderDefsTable,
} from "@workspace/db";
import { eq, and, desc, count, ilike, asc, isNull } from "drizzle-orm";
import { requireAdmin } from "../../middleware/adminAuth";
import { logger } from "../../lib/logger";
import { ObjectStorageService } from "../../lib/objectStorage";
import { Readable } from "stream";
import multer from "multer";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TurndownService = require("turndown") as new (opts?: any) => { turndown(html: string): string };

const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".pdf")
      || file.originalname.toLowerCase().endsWith(".docx")
      || file.originalname.toLowerCase().endsWith(".doc")) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 PDF / DOCX / DOC 文件"));
    }
  },
});

const router: IRouter = Router();

/* ─────────────────────────────────────────────────
   Placeholder definitions
   ───────────────────────────────────────────────── */

router.get("/contract-placeholder-defs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(contractPlaceholderDefsTable)
      .orderBy(asc(contractPlaceholderDefsTable.sortOrder), asc(contractPlaceholderDefsTable.id));
    return res.json({ items: rows });
  } catch (err) {
    logger.error({ err }, "GET /v2/contract-placeholder-defs failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contract-placeholder-defs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, label, description, group, sourceField, exampleValue, sortOrder } = req.body as {
      key: string; label: string; description?: string; group: string;
      sourceField?: string; exampleValue?: string; sortOrder?: number;
    };
    if (!key?.trim() || !label?.trim() || !group) {
      return res.status(400).json({ error: "key、label、group 不能为空" });
    }
    if (!/^\{\{.+\}\}$/.test(key.trim())) {
      return res.status(400).json({ error: "占位符 key 格式必须为 {{变量名}}" });
    }
    const [created] = await db.insert(contractPlaceholderDefsTable).values({
      key: key.trim(),
      label: label.trim(),
      description: description?.trim(),
      group: group as any,
      sourceField: sourceField?.trim(),
      exampleValue: exampleValue?.trim(),
      isBuiltin: false,
      sortOrder: sortOrder ?? 100,
    }).returning();
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(400).json({ error: "该 key 已存在" });
    logger.error({ err }, "POST /v2/contract-placeholder-defs failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.put("/contract-placeholder-defs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { label, description, sourceField, exampleValue, sortOrder } = req.body as {
      label?: string; description?: string; sourceField?: string; exampleValue?: string; sortOrder?: number;
    };
    const [existing] = await db.select().from(contractPlaceholderDefsTable).where(eq(contractPlaceholderDefsTable.id, id));
    if (!existing) return res.status(404).json({ error: "未找到" });
    const [updated] = await db
      .update(contractPlaceholderDefsTable)
      .set({
        ...(label !== undefined ? { label: label.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(sourceField !== undefined ? { sourceField: sourceField.trim() } : {}),
        ...(exampleValue !== undefined ? { exampleValue: exampleValue.trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      })
      .where(eq(contractPlaceholderDefsTable.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PUT /v2/contract-placeholder-defs/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.delete("/contract-placeholder-defs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(contractPlaceholderDefsTable).where(eq(contractPlaceholderDefsTable.id, id));
    if (!existing) return res.status(404).json({ error: "未找到" });
    if (existing.isBuiltin) return res.status(400).json({ error: "内置占位符不可删除" });
    await db.delete(contractPlaceholderDefsTable).where(eq(contractPlaceholderDefsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /v2/contract-placeholder-defs/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

/* ─────────────────────────────────────────────────
   Variable mapping validation helper
   ───────────────────────────────────────────────── */

/**
 * For standard contracts with an esignTemplateId, every {{placeholder}} found in
 * markdownContent must appear as a key in variableMapping. Returns missing keys or [].
 */
function validateVariableMapping(
  markdownContent: string | undefined,
  variableMapping: Record<string, string> | undefined,
): string[] {
  if (!markdownContent) return [];
  const placeholderRe = /\{\{[^{}]+\}\}/g;
  const found = [...markdownContent.matchAll(placeholderRe)].map(m => m[0]);
  const unique = [...new Set(found)];
  const mapping = variableMapping ?? {};
  return unique.filter(k => !mapping[k]);
}

/* ─────────────────────────────────────────────────
   Contract templates
   ───────────────────────────────────────────────── */

/**
 * GET /v2/contract-templates
 * When `grouped=true` is passed, returns items arranged by demandType.
 * Each group entry has { demandType, channelA, channelB } where channelA/B are
 * the single active template for that slot (or null if none).
 * Without `grouped`, returns flat paginated list (for search/filter UX).
 */
router.get("/contract-templates", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { channel, demandType, search, page = "1", limit = "100", isActive, grouped } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (channel) conditions.push(eq(contractTemplatesTable.channel, channel as any));
    if (demandType) conditions.push(eq(contractTemplatesTable.demandType, demandType));
    if (search) conditions.push(ilike(contractTemplatesTable.title, `%${search}%`));
    if (isActive !== undefined && isActive !== "") conditions.push(eq(contractTemplatesTable.isActive, isActive === "true"));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (grouped === "true") {
      const rows = await db
        .select()
        .from(contractTemplatesTable)
        .where(whereClause)
        .orderBy(asc(contractTemplatesTable.demandType), desc(contractTemplatesTable.updatedAt));

      type GroupRow = { demandType: string | null; channelA: any; channelB: any };
      const groupMap = new Map<string, GroupRow>();

      for (const row of rows) {
        const key = row.demandType ?? "__universal__";
        if (!groupMap.has(key)) {
          groupMap.set(key, { demandType: row.demandType, channelA: null, channelB: null });
        }
        const g = groupMap.get(key)!;
        if (row.channel === "a" && !g.channelA) g.channelA = row;
        if (row.channel === "b" && !g.channelB) g.channelB = row;
      }

      const groups = [...groupMap.values()];
      const universal = groups.find(g => g.demandType === null);
      const typed = groups.filter(g => g.demandType !== null).sort((a, b) => (a.demandType ?? "").localeCompare(b.demandType ?? ""));
      return res.json({ groups: [...typed, ...(universal ? [universal] : [])] });
    }

    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;
    const [totalRow] = await db.select({ count: count() }).from(contractTemplatesTable).where(whereClause);
    const rows = await db
      .select()
      .from(contractTemplatesTable)
      .where(whereClause)
      .orderBy(asc(contractTemplatesTable.demandType), asc(contractTemplatesTable.channel))
      .limit(lim)
      .offset(offset);

    return res.json({ total: Number(totalRow.count), page: pg, limit: lim, items: rows });
  } catch (err) {
    logger.error({ err }, "GET /v2/contract-templates failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

/** Auto-match: returns the best template for a given channel + demandType combination */
router.get("/contract-templates/applicable", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { channel, demandType } = req.query as { channel?: string; demandType?: string };
    if (!channel) return res.status(400).json({ error: "channel 参数必填" });

    const conditions: any[] = [
      eq(contractTemplatesTable.channel, channel as any),
      eq(contractTemplatesTable.isActive, true),
    ];

    let rows;
    if (demandType) {
      rows = await db
        .select()
        .from(contractTemplatesTable)
        .where(and(...conditions, eq(contractTemplatesTable.demandType, demandType)))
        .orderBy(desc(contractTemplatesTable.updatedAt))
        .limit(1);

      if (!rows.length) {
        rows = await db
          .select()
          .from(contractTemplatesTable)
          .where(and(...conditions, isNull(contractTemplatesTable.demandType)))
          .orderBy(desc(contractTemplatesTable.updatedAt))
          .limit(1);
      }
    } else {
      rows = await db
        .select()
        .from(contractTemplatesTable)
        .where(and(...conditions))
        .orderBy(desc(contractTemplatesTable.updatedAt))
        .limit(1);
    }

    if (!rows.length) return res.status(404).json({ error: "未找到适用模板" });
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /v2/contract-templates/applicable failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/contract-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [row] = await db.select().from(contractTemplatesTable).where(eq(contractTemplatesTable.id, id));
    if (!row) return res.status(404).json({ error: "未找到" });
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /v2/contract-templates/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

/** Check uniqueness: each (demandType, channel) slot may hold only one template. */
async function checkSlotUnique(channel: "a" | "b", demandType: string | null | undefined, excludeId?: number) {
  const normDt = demandType?.trim() || null;
  const conditions: any[] = [
    eq(contractTemplatesTable.channel, channel),
    normDt ? eq(contractTemplatesTable.demandType, normDt) : isNull(contractTemplatesTable.demandType),
  ];
  const rows = await db.select({ id: contractTemplatesTable.id }).from(contractTemplatesTable).where(and(...conditions));
  return rows.filter(r => r.id !== excludeId);
}

router.post("/contract-templates", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, demandType, channel, signType, isStandard, markdownContent, esignTemplateId, variableMapping } = req.body as {
      title: string; demandType?: string; channel: "a" | "b";
      signType?: "company" | "personal" | "both";
      isStandard?: boolean; markdownContent?: string;
      esignTemplateId?: string; variableMapping?: Record<string, string>;
    };
    if (!title?.trim() || !channel) {
      return res.status(400).json({ error: "标题和渠道不能为空" });
    }

    const conflicts = await checkSlotUnique(channel, demandType);
    if (conflicts.length > 0) {
      const slotLabel = channel === "a" ? "A（发单方）" : "B（OPC）";
      const dtLabel = demandType?.trim() || "通用";
      return res.status(409).json({ error: `需求类型「${dtLabel}」的 Channel ${slotLabel} 已有模板，每个槽位只能有一个模板` });
    }

    if (isStandard && esignTemplateId?.trim()) {
      const missing = validateVariableMapping(markdownContent, variableMapping);
      if (missing.length > 0) {
        return res.status(400).json({ error: `标准合同的变量映射不完整，缺少以下占位符的映射：${missing.join("、")}` });
      }
    }

    const [created] = await db.insert(contractTemplatesTable).values({
      title: title.trim(),
      demandType: demandType?.trim() || null,
      channel,
      signType: signType ?? "company",
      isStandard: isStandard ?? true,
      markdownContent: markdownContent?.trim(),
      esignTemplateId: esignTemplateId?.trim() || null,
      variableMapping: variableMapping ?? {},
      isActive: true,
    }).returning();
    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/contract-templates failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.put("/contract-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(contractTemplatesTable).where(eq(contractTemplatesTable.id, id));
    if (!existing) return res.status(404).json({ error: "未找到" });

    const { title, demandType, channel, signType, isStandard, markdownContent, esignTemplateId, variableMapping, isActive, originalFileUrl, originalFileName } = req.body as {
      title?: string; demandType?: string; channel?: "a" | "b";
      signType?: "company" | "personal" | "both";
      isStandard?: boolean; markdownContent?: string;
      esignTemplateId?: string; variableMapping?: Record<string, string>;
      isActive?: boolean; originalFileUrl?: string; originalFileName?: string;
    };

    const effectiveChannel = channel ?? existing.channel;
    const effectiveDemandType = demandType !== undefined ? demandType : existing.demandType;

    if (channel !== undefined || demandType !== undefined) {
      const conflicts = await checkSlotUnique(effectiveChannel, effectiveDemandType, id);
      if (conflicts.length > 0) {
        const slotLabel = effectiveChannel === "a" ? "A（发单方）" : "B（OPC）";
        const dtLabel = effectiveDemandType?.trim() || "通用";
        return res.status(409).json({ error: `需求类型「${dtLabel}」的 Channel ${slotLabel} 已有模板，每个槽位只能有一个模板` });
      }
    }

    const effectiveIsStandard = isStandard !== undefined ? isStandard : existing.isStandard;
    const effectiveEsignId = esignTemplateId !== undefined ? esignTemplateId?.trim() : existing.esignTemplateId;
    const effectiveMd = markdownContent !== undefined ? markdownContent.trim() : existing.markdownContent;
    const effectiveMapping = variableMapping !== undefined ? variableMapping : (existing.variableMapping as Record<string, string> | undefined);

    if (effectiveIsStandard && effectiveEsignId) {
      const missing = validateVariableMapping(effectiveMd ?? undefined, effectiveMapping);
      if (missing.length > 0) {
        return res.status(400).json({ error: `标准合同的变量映射不完整，缺少以下占位符的映射：${missing.join("、")}` });
      }
    }

    const [updated] = await db
      .update(contractTemplatesTable)
      .set({
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(demandType !== undefined ? { demandType: demandType?.trim() || null } : {}),
        ...(channel !== undefined ? { channel } : {}),
        ...(signType !== undefined ? { signType } : {}),
        ...(isStandard !== undefined ? { isStandard } : {}),
        ...(markdownContent !== undefined ? { markdownContent: markdownContent.trim() } : {}),
        ...(esignTemplateId !== undefined ? { esignTemplateId: esignTemplateId?.trim() || null } : {}),
        ...(variableMapping !== undefined ? { variableMapping } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(originalFileUrl !== undefined ? { originalFileUrl } : {}),
        ...(originalFileName !== undefined ? { originalFileName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contractTemplatesTable.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PUT /v2/contract-templates/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.delete("/contract-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [existing] = await db.select().from(contractTemplatesTable).where(eq(contractTemplatesTable.id, id));
    if (!existing) return res.status(404).json({ error: "未找到" });
    await db.delete(contractTemplatesTable).where(eq(contractTemplatesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /v2/contract-templates/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

/* ─────────────────────────────────────────────────
   Convert DOCX/PDF → Markdown
   ───────────────────────────────────────────────── */

router.post("/contract-templates/convert-to-markdown", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "未收到文件" });

    let markdownContent = "";

    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(file.buffer);
      markdownContent = data.text
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
      markdownContent = td.turndown(result.value).trim();
    }

    const readable = Readable.from(file.buffer);
    const { quarantineGCSPath, publishedGCSPath, publishedObjectPath } =
      await objectStorageService.streamToQuarantine(file.mimetype, readable);
    await objectStorageService.promoteFromQuarantine(quarantineGCSPath, publishedGCSPath);
    const BASE_URL = process.env["APP_BASE_URL"] ?? "";
    const originalFileUrl = `${BASE_URL}/api/storage${publishedObjectPath}`;

    return res.json({
      markdownContent,
      originalFileUrl,
      originalFileName: file.originalname,
    });
  } catch (err) {
    logger.error({ err }, "POST /v2/contract-templates/convert-to-markdown failed");
    return res.status(500).json({ error: "文件解析失败" });
  }
});

export default router;
