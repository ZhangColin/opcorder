import { Router, type IRouter } from "express";
import { db, postsTable, postLikesTable, postCommentsTable, usersTable, opcProfilesTable } from "@workspace/db";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";
import {
  ListPostsQueryParams,
  CreatePostBody,
  TogglePostLikeBody,
  CreatePostCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPost(post: typeof postsTable.$inferSelect, authorName: string, authorLevel: string, likedByMe = false) {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName,
    authorLevel,
    title: post.title,
    content: post.content,
    tags: post.tags,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    viewsCount: post.viewsCount,
    likedByMe,
    createdAt: post.createdAt.toISOString(),
  };
}

router.get("/posts", async (req, res) => {
  try {
    const params = ListPostsQueryParams.parse(req.query);
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const orderBy = params.sort === "hot" ? desc(postsTable.likesCount) : desc(postsTable.createdAt);

    const searchCondition = search
      ? or(ilike(postsTable.title, `%${search}%`), ilike(postsTable.content, `%${search}%`))
      : undefined;

    const posts = await db
      .select({
        post: postsTable,
        nickname: usersTable.nickname,
        level: opcProfilesTable.level,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(postsTable.authorId, opcProfilesTable.userId))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(postsTable)
      .where(searchCondition);

    res.json({
      items: posts.map(({ post, nickname, level }) =>
        formatPost(post, nickname ?? "匿名用户", level ?? "C")
      ),
      total: Number(countResult[0]?.count ?? 0),
    });
  } catch {
    res.status(500).json({ error: "Failed to list posts" });
  }
});

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid postId" });

    const [row] = await db
      .select({
        post: postsTable,
        nickname: usersTable.nickname,
        level: opcProfilesTable.level,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(postsTable.authorId, opcProfilesTable.userId))
      .where(eq(postsTable.id, postId));

    if (!row) return res.status(404).json({ error: "Post not found" });

    await db.update(postsTable)
      .set({ viewsCount: sql`${postsTable.viewsCount} + 1` })
      .where(eq(postsTable.id, postId));

    res.json(formatPost(row.post, row.nickname ?? "匿名用户", row.level ?? "C"));
  } catch {
    res.status(500).json({ error: "Failed to get post" });
  }
});

router.post("/posts", async (req, res) => {
  try {
    const body = CreatePostBody.parse(req.body);

    const [post] = await db.insert(postsTable).values({
      authorId: body.authorId,
      title: body.title,
      content: body.content,
      tags: body.tags ?? [],
    }).returning();

    const [userRow] = await db
      .select({ nickname: usersTable.nickname, level: opcProfilesTable.level })
      .from(usersTable)
      .leftJoin(opcProfilesTable, eq(usersTable.id, opcProfilesTable.userId))
      .where(eq(usersTable.id, body.authorId));

    res.status(201).json(formatPost(post, userRow?.nickname ?? "匿名用户", userRow?.level ?? "C"));
  } catch {
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.post("/posts/:postId/like", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const body = TogglePostLikeBody.parse(req.body);

    const existing = await db.select().from(postLikesTable)
      .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, body.userId)));

    let liked: boolean;

    if (existing.length > 0) {
      await db.delete(postLikesTable)
        .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, body.userId)));
      await db.update(postsTable)
        .set({ likesCount: sql`${postsTable.likesCount} - 1` })
        .where(eq(postsTable.id, postId));
      liked = false;
    } else {
      await db.insert(postLikesTable).values({ postId, userId: body.userId });
      await db.update(postsTable)
        .set({ likesCount: sql`${postsTable.likesCount} + 1` })
        .where(eq(postsTable.id, postId));
      liked = true;
    }

    const [updated] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    res.json({ liked, likesCount: updated?.likesCount ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const comments = await db
      .select({
        comment: postCommentsTable,
        nickname: usersTable.nickname,
      })
      .from(postCommentsTable)
      .leftJoin(usersTable, eq(postCommentsTable.authorId, usersTable.id))
      .where(eq(postCommentsTable.postId, postId))
      .orderBy(desc(postCommentsTable.createdAt));

    res.json(comments.map(({ comment, nickname }) => ({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: nickname ?? "匿名用户",
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Failed to list comments" });
  }
});

router.post("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const body = CreatePostCommentBody.parse(req.body);

    const [comment] = await db.insert(postCommentsTable).values({
      postId,
      authorId: body.authorId,
      content: body.content,
    }).returning();

    await db.update(postsTable)
      .set({ commentsCount: sql`${postsTable.commentsCount} + 1` })
      .where(eq(postsTable.id, postId));

    const [userRow] = await db.select({ nickname: usersTable.nickname })
      .from(usersTable).where(eq(usersTable.id, body.authorId));

    res.status(201).json({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: userRow?.nickname ?? "匿名用户",
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to create comment" });
  }
});

export default router;
