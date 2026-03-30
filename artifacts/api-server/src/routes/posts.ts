import { Router, type IRouter } from "express";
import { db, postsTable, postLikesTable, postCommentsTable, usersTable, opcProfilesTable, publisherProfilesTable } from "@workspace/db";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";
import {
  ListPostsQueryParams,
  CreatePostBody,
  TogglePostLikeBody,
  CreatePostCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPost(
  post: typeof postsTable.$inferSelect,
  authorName: string,
  authorRole: string,
  authorAvatar: string | null = null,
  likedByMe = false,
) {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName,
    authorRole,
    authorAvatar,
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

function resolveAvatar(role: string | null, opcAvatar: string | null, publisherLogo: string | null): string | null {
  if (role === "opc") return opcAvatar ?? null;
  if (role === "publisher") return publisherLogo ?? null;
  return null;
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
        role: usersTable.role,
        opcAvatar: opcProfilesTable.avatar,
        publisherLogo: publisherProfilesTable.companyLogo,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(postsTable.authorId, opcProfilesTable.userId))
      .leftJoin(publisherProfilesTable, eq(postsTable.authorId, publisherProfilesTable.userId))
      .where(searchCondition)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(postsTable)
      .where(searchCondition);

    res.json({
      items: posts.map(({ post, nickname, role, opcAvatar, publisherLogo }) =>
        formatPost(post, nickname ?? "匿名用户", role ?? "opc", resolveAvatar(role, opcAvatar, publisherLogo))
      ),
      total: Number(countResult[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("List posts error:", err);
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
        role: usersTable.role,
        opcAvatar: opcProfilesTable.avatar,
        publisherLogo: publisherProfilesTable.companyLogo,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(postsTable.authorId, opcProfilesTable.userId))
      .leftJoin(publisherProfilesTable, eq(postsTable.authorId, publisherProfilesTable.userId))
      .where(eq(postsTable.id, postId));

    if (!row) return res.status(404).json({ error: "Post not found" });

    await db.update(postsTable)
      .set({ viewsCount: sql`${postsTable.viewsCount} + 1` })
      .where(eq(postsTable.id, postId));

    res.json(formatPost(row.post, row.nickname ?? "匿名用户", row.role ?? "opc", resolveAvatar(row.role, row.opcAvatar, row.publisherLogo)));
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
      .select({ nickname: usersTable.nickname, role: usersTable.role, opcAvatar: opcProfilesTable.avatar, publisherLogo: publisherProfilesTable.companyLogo })
      .from(usersTable)
      .leftJoin(opcProfilesTable, eq(usersTable.id, opcProfilesTable.userId))
      .leftJoin(publisherProfilesTable, eq(usersTable.id, publisherProfilesTable.userId))
      .where(eq(usersTable.id, body.authorId));

    res.status(201).json(formatPost(post, userRow?.nickname ?? "匿名用户", userRow?.role ?? "opc", resolveAvatar(userRow?.role ?? null, userRow?.opcAvatar ?? null, userRow?.publisherLogo ?? null)));
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
        .set({ likesCount: sql`GREATEST(0, ${postsTable.likesCount} - 1)` })
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
        role: usersTable.role,
        opcAvatar: opcProfilesTable.avatar,
        publisherLogo: publisherProfilesTable.companyLogo,
      })
      .from(postCommentsTable)
      .leftJoin(usersTable, eq(postCommentsTable.authorId, usersTable.id))
      .leftJoin(opcProfilesTable, eq(postCommentsTable.authorId, opcProfilesTable.userId))
      .leftJoin(publisherProfilesTable, eq(postCommentsTable.authorId, publisherProfilesTable.userId))
      .where(eq(postCommentsTable.postId, postId))
      .orderBy(desc(postCommentsTable.createdAt));

    res.json(comments.map(({ comment, nickname, role, opcAvatar, publisherLogo }) => ({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: nickname ?? "匿名用户",
      authorRole: role ?? "opc",
      authorAvatar: resolveAvatar(role, opcAvatar, publisherLogo),
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

    const [userRow] = await db
      .select({ nickname: usersTable.nickname, role: usersTable.role, opcAvatar: opcProfilesTable.avatar, publisherLogo: publisherProfilesTable.companyLogo })
      .from(usersTable)
      .leftJoin(opcProfilesTable, eq(usersTable.id, opcProfilesTable.userId))
      .leftJoin(publisherProfilesTable, eq(usersTable.id, publisherProfilesTable.userId))
      .where(eq(usersTable.id, body.authorId));

    res.status(201).json({
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorName: userRow?.nickname ?? "匿名用户",
      authorRole: userRow?.role ?? "opc",
      authorAvatar: resolveAvatar(userRow?.role ?? null, userRow?.opcAvatar ?? null, userRow?.publisherLogo ?? null),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to create comment" });
  }
});

export default router;
