import { Router, type IRouter, type Request, type Response } from "express";
import { db, v2DiscussionPostsTable, usersTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { notify } from "./utils";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/discussions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { parentType, parentId, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;

    if (!parentType || !parentId) return res.status(400).json({ error: "parentType 和 parentId 必填" });

    const conditions: any[] = [
      eq(v2DiscussionPostsTable.parentType, parentType as any),
      eq(v2DiscussionPostsTable.parentId, parseInt(parentId)),
    ];

    const [totalRow] = await db.select({ count: count() }).from(v2DiscussionPostsTable).where(and(...conditions));
    const rows = await db
      .select({
        id: v2DiscussionPostsTable.id,
        parentType: v2DiscussionPostsTable.parentType,
        parentId: v2DiscussionPostsTable.parentId,
        replyToId: v2DiscussionPostsTable.replyToId,
        content: v2DiscussionPostsTable.content,
        attachments: v2DiscussionPostsTable.attachments,
        isInternal: v2DiscussionPostsTable.isInternal,
        authorId: v2DiscussionPostsTable.authorId,
        authorNickname: usersTable.nickname,
        authorRole: usersTable.role,
        createdAt: v2DiscussionPostsTable.createdAt,
      })
      .from(v2DiscussionPostsTable)
      .leftJoin(usersTable, eq(v2DiscussionPostsTable.authorId, usersTable.id))
      .where(and(...conditions))
      .orderBy(v2DiscussionPostsTable.createdAt)
      .limit(lim)
      .offset(offset);

    const visible = role === "admin"
      ? rows
      : rows.filter(r => !r.isInternal || r.authorId === userId);

    return res.json({ total: Number(totalRow.count), page: pg, limit: lim, items: visible });
  } catch (err) {
    logger.error({ err }, "GET /v2/discussions failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/discussions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { parentType, parentId, replyToId, content, attachments, isInternal } = req.body as {
      parentType: string; parentId: number; replyToId?: number;
      content: string; attachments?: any[]; isInternal?: boolean;
    };

    if (!parentType || !parentId || !content?.trim()) {
      return res.status(400).json({ error: "parentType、parentId、content 必填" });
    }

    if (role === "publisher" && parentType === "v2_outsource_demand") {
      return res.status(403).json({ error: "发单方无权在外包需求讨论区发帖" });
    }
    if (role === "opc" && parentType === "v2_client_demand") {
      return res.status(403).json({ error: "OPC 无权在客户需求讨论区发帖" });
    }

    const internal = role === "admin" ? (!!isInternal) : false;

    const [created] = await db.insert(v2DiscussionPostsTable).values({
      parentType: parentType as any,
      parentId,
      replyToId,
      content: content.trim(),
      attachments: attachments ?? [],
      isInternal: internal,
      authorId: userId,
    }).returning();

    if (replyToId) {
      const [original] = await db.select({ authorId: v2DiscussionPostsTable.authorId })
        .from(v2DiscussionPostsTable).where(eq(v2DiscussionPostsTable.id, replyToId)).limit(1);
      if (original && original.authorId !== userId) {
        await notify(original.authorId, "v2_discussion_replied", "有人回复了您的讨论",
          `您在讨论区的帖子收到了新回复。`, parentId, parentType as any);
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/discussions failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.delete("/discussions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [post] = await db.select().from(v2DiscussionPostsTable).where(eq(v2DiscussionPostsTable.id, id)).limit(1);
    if (!post) return res.status(404).json({ error: "讨论帖不存在" });
    if (role !== "admin" && post.authorId !== userId) return res.status(403).json({ error: "无权删除" });

    await db.delete(v2DiscussionPostsTable).where(eq(v2DiscussionPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /v2/discussions/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
