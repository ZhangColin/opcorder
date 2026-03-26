import { Router, type IRouter } from "express";
import { db, usersTable, opcProfilesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { GetOpcLeaderboardQueryParams, UpdateOpcProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildProfileResponse(userId: number) {
  const [profile] = await db
    .select({
      id:             opcProfilesTable.id,
      userId:         opcProfilesTable.userId,
      nickname:       usersTable.nickname,
      avatar:         usersTable.avatar,
      phone:          usersTable.phone,
      level:          opcProfilesTable.level,
      bio:            opcProfilesTable.bio,
      skillTags:      opcProfilesTable.skillTags,
      industryTags:   opcProfilesTable.industryTags,
      creditScore:    opcProfilesTable.creditScore,
      totalOrders:    opcProfilesTable.totalOrders,
      completionRate: opcProfilesTable.completionRate,
      avgRating:      opcProfilesTable.avgRating,
      totalEarnings:  opcProfilesTable.totalEarnings,
      activityScore:  opcProfilesTable.activityScore,
      title:          opcProfilesTable.title,
      location:       opcProfilesTable.location,
      website:        opcProfilesTable.website,
      yearsExp:       opcProfilesTable.yearsExp,
      wechat:         opcProfilesTable.wechat,
    })
    .from(opcProfilesTable)
    .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
    .where(eq(opcProfilesTable.userId, userId));
  return profile;
}

router.get("/users/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId     = authHeader?.startsWith("Bearer ")
      ? parseInt(authHeader.slice(7), 10)
      : NaN;

    let user;
    if (!isNaN(userId) && userId > 0) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    } else {
      [user] = await db.select().from(usersTable).where(eq(usersTable.role, "opc")).orderBy(asc(usersTable.id)).limit(1);
    }

    if (!user) return res.status(404).json({ error: "No user found" });
    res.json({
      id:        user.id,
      nickname:  user.nickname,
      email:     user.email,
      phone:     user.phone,
      avatar:    user.avatar,
      role:      user.role,
      status:    user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/users/opc-leaderboard", async (req, res) => {
  try {
    const { limit } = GetOpcLeaderboardQueryParams.parse(req.query);
    const profiles = await db
      .select({
        id:             opcProfilesTable.id,
        userId:         opcProfilesTable.userId,
        nickname:       usersTable.nickname,
        avatar:         usersTable.avatar,
        level:          opcProfilesTable.level,
        bio:            opcProfilesTable.bio,
        skillTags:      opcProfilesTable.skillTags,
        industryTags:   opcProfilesTable.industryTags,
        creditScore:    opcProfilesTable.creditScore,
        totalOrders:    opcProfilesTable.totalOrders,
        completionRate: opcProfilesTable.completionRate,
        avgRating:      opcProfilesTable.avgRating,
        totalEarnings:  opcProfilesTable.totalEarnings,
        activityScore:  opcProfilesTable.activityScore,
        title:          opcProfilesTable.title,
      })
      .from(opcProfilesTable)
      .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
      .orderBy(desc(opcProfilesTable.activityScore))
      .limit(limit ?? 10);
    res.json(profiles);
  } catch {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      id:        user.id,
      nickname:  user.nickname,
      phone:     user.phone,
      avatar:    user.avatar,
      role:      user.role,
      status:    user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/users/:userId/opc-profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await buildProfileResponse(userId);
    if (!profile) return res.status(404).json({ error: "OPC profile not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/users/:userId/opc-profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const body = UpdateOpcProfileBody.parse(req.body);

    /* ── Ensure OPC profile row exists (create if missing) ── */
    const [existing] = await db
      .select({ id: opcProfilesTable.id })
      .from(opcProfilesTable)
      .where(eq(opcProfilesTable.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(opcProfilesTable).values({ userId });
    }

    /* ── Update opc_profiles fields ── */
    const profileUpdate: Record<string, unknown> = {};
    if (body.bio          !== undefined) profileUpdate.bio          = body.bio;
    if (body.skillTags    !== undefined) profileUpdate.skillTags    = body.skillTags;
    if (body.industryTags !== undefined) profileUpdate.industryTags = body.industryTags;
    if (body.title        !== undefined) profileUpdate.title        = body.title;
    if (body.location     !== undefined) profileUpdate.location     = body.location;
    if (body.website      !== undefined) profileUpdate.website      = body.website;
    if (body.yearsExp     !== undefined) profileUpdate.yearsExp     = body.yearsExp;
    if (body.wechat       !== undefined) profileUpdate.wechat       = body.wechat;

    if (Object.keys(profileUpdate).length > 0) {
      await db.update(opcProfilesTable).set(profileUpdate).where(eq(opcProfilesTable.userId, userId));
    }

    /* ── Update users fields (nickname, avatar, phone) ── */
    const userUpdate: Record<string, unknown> = {};
    if (body.nickname !== undefined) userUpdate.nickname = body.nickname;
    if (body.avatar   !== undefined) userUpdate.avatar   = body.avatar;
    if (body.phone    !== undefined) userUpdate.phone    = body.phone;

    if (Object.keys(userUpdate).length > 0) {
      await db.update(usersTable).set(userUpdate).where(eq(usersTable.id, userId));
    }

    const updated = await buildProfileResponse(userId);
    if (!updated) return res.status(404).json({ error: "Profile not found after update" });
    res.json(updated);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
