import { Router, type IRouter } from "express";
import { db, usersTable, opcProfilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  GetOpcLeaderboardQueryParams,
  GetUserByIdResponse,
  GetOpcProfileResponse,
  UpdateOpcProfileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", async (_req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.role, "opc")).limit(1);
    if (!user) {
      return res.status(404).json({ error: "No user found" });
    }
    res.json({
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/users/opc-leaderboard", async (req, res) => {
  try {
    const { limit } = GetOpcLeaderboardQueryParams.parse(req.query);
    const profiles = await db
      .select({
        id: opcProfilesTable.id,
        userId: opcProfilesTable.userId,
        nickname: usersTable.nickname,
        avatar: usersTable.avatar,
        level: opcProfilesTable.level,
        bio: opcProfilesTable.bio,
        skillTags: opcProfilesTable.skillTags,
        industryTags: opcProfilesTable.industryTags,
        creditScore: opcProfilesTable.creditScore,
        totalOrders: opcProfilesTable.totalOrders,
        completionRate: opcProfilesTable.completionRate,
        avgRating: opcProfilesTable.avgRating,
        totalEarnings: opcProfilesTable.totalEarnings,
        activityScore: opcProfilesTable.activityScore,
      })
      .from(opcProfilesTable)
      .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
      .orderBy(desc(opcProfilesTable.activityScore))
      .limit(limit ?? 10);

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/users/:userId/opc-profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [profile] = await db
      .select({
        id: opcProfilesTable.id,
        userId: opcProfilesTable.userId,
        nickname: usersTable.nickname,
        avatar: usersTable.avatar,
        level: opcProfilesTable.level,
        bio: opcProfilesTable.bio,
        skillTags: opcProfilesTable.skillTags,
        industryTags: opcProfilesTable.industryTags,
        creditScore: opcProfilesTable.creditScore,
        totalOrders: opcProfilesTable.totalOrders,
        completionRate: opcProfilesTable.completionRate,
        avgRating: opcProfilesTable.avgRating,
        totalEarnings: opcProfilesTable.totalEarnings,
        activityScore: opcProfilesTable.activityScore,
      })
      .from(opcProfilesTable)
      .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
      .where(eq(opcProfilesTable.userId, userId));

    if (!profile) {
      return res.status(404).json({ error: "OPC profile not found" });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/users/:userId/opc-profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const body = UpdateOpcProfileBody.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.skillTags !== undefined) updateData.skillTags = body.skillTags;
    if (body.industryTags !== undefined) updateData.industryTags = body.industryTags;

    await db.update(opcProfilesTable).set(updateData).where(eq(opcProfilesTable.userId, userId));

    const [updated] = await db
      .select({
        id: opcProfilesTable.id,
        userId: opcProfilesTable.userId,
        nickname: usersTable.nickname,
        avatar: usersTable.avatar,
        level: opcProfilesTable.level,
        bio: opcProfilesTable.bio,
        skillTags: opcProfilesTable.skillTags,
        industryTags: opcProfilesTable.industryTags,
        creditScore: opcProfilesTable.creditScore,
        totalOrders: opcProfilesTable.totalOrders,
        completionRate: opcProfilesTable.completionRate,
        avgRating: opcProfilesTable.avgRating,
        totalEarnings: opcProfilesTable.totalEarnings,
        activityScore: opcProfilesTable.activityScore,
      })
      .from(opcProfilesTable)
      .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
      .where(eq(opcProfilesTable.userId, userId));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
