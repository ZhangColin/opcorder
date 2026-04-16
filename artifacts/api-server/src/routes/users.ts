import { logger } from "../lib/logger";
import { Router, type IRouter } from "express";
import { db, usersTable, opcProfilesTable, publisherProfilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetOpcLeaderboardQueryParams, UpdateOpcProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

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

router.get("/users/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "用户不存在" });
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

/* Public — OPC rankings shown on landing/public pages */
router.get("/users/opc-leaderboard", async (req, res) => {
  try {
    const { limit } = GetOpcLeaderboardQueryParams.parse(req.query);
    const profiles = await db
      .select({
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

router.get("/users/:userId", requireAuth, async (req, res) => {
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

router.get("/users/:userId/opc-profile", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await buildProfileResponse(userId);
    if (!profile) return res.status(404).json({ error: "OPC profile not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/users/:userId/opc-profile", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (req.user!.id !== userId) {
      return res.status(403).json({ error: "无权修改他人资料" });
    }

    const body = UpdateOpcProfileBody.parse(req.body);

    const [existing] = await db
      .select({ id: opcProfilesTable.id })
      .from(opcProfilesTable)
      .where(eq(opcProfilesTable.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(opcProfilesTable).values({ userId });
    }

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
    logger.error({ err: err }, "Update profile error:");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/users/:userId/publisher-profile", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await db.select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const [profile] = await db.select().from(publisherProfilesTable)
      .where(eq(publisherProfilesTable.userId, userId)).limit(1);

    res.json({
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      companyDesc: profile?.companyDesc ?? null,
      location: profile?.location ?? null,
      industry: profile?.industry ?? null,
      teamSize: profile?.teamSize ?? null,
      foundedYear: profile?.foundedYear ?? null,
      website: profile?.website ?? null,
      contactEmail: profile?.contactEmail ?? null,
      creditCode: profile?.creditCode ?? null,
      companyLogo: profile?.companyLogo ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch publisher profile" });
  }
});

router.patch("/users/:userId/publisher-profile", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (req.user!.id !== userId) {
      return res.status(403).json({ error: "无权修改他人资料" });
    }

    const { nickname, phone, companyDesc, location, industry, teamSize, foundedYear, website, contactEmail, creditCode, companyLogo } = req.body;

    if (nickname !== undefined || phone !== undefined) {
      const userUpdate: Record<string, unknown> = {};
      if (nickname !== undefined) userUpdate.nickname = nickname;
      if (phone !== undefined) userUpdate.phone = phone;
      await db.update(usersTable).set(userUpdate).where(eq(usersTable.id, userId));
    }

    const profileUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (companyDesc  !== undefined) profileUpdate.companyDesc  = companyDesc;
    if (location     !== undefined) profileUpdate.location     = location;
    if (industry     !== undefined) profileUpdate.industry     = industry;
    if (teamSize     !== undefined) profileUpdate.teamSize     = teamSize;
    if (foundedYear  !== undefined) profileUpdate.foundedYear  = foundedYear;
    if (website      !== undefined) profileUpdate.website      = website;
    if (contactEmail !== undefined) profileUpdate.contactEmail = contactEmail;
    if (creditCode   !== undefined) profileUpdate.creditCode   = creditCode;
    if (companyLogo  !== undefined) profileUpdate.companyLogo  = companyLogo;

    const [existing] = await db.select({ userId: publisherProfilesTable.userId })
      .from(publisherProfilesTable).where(eq(publisherProfilesTable.userId, userId)).limit(1);

    if (existing) {
      await db.update(publisherProfilesTable).set(profileUpdate).where(eq(publisherProfilesTable.userId, userId));
    } else {
      await db.insert(publisherProfilesTable).values({ userId, ...profileUpdate });
    }

    const [updatedUser] = await db.select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [updatedProfile] = await db.select().from(publisherProfilesTable)
      .where(eq(publisherProfilesTable.userId, userId)).limit(1);

    res.json({
      userId: updatedUser.id,
      nickname: updatedUser.nickname,
      email: updatedUser.email,
      phone: updatedUser.phone,
      companyDesc: updatedProfile?.companyDesc ?? null,
      location: updatedProfile?.location ?? null,
      industry: updatedProfile?.industry ?? null,
      teamSize: updatedProfile?.teamSize ?? null,
      foundedYear: updatedProfile?.foundedYear ?? null,
      website: updatedProfile?.website ?? null,
      contactEmail: updatedProfile?.contactEmail ?? null,
      creditCode: updatedProfile?.creditCode ?? null,
      companyLogo: updatedProfile?.companyLogo ?? null,
    });
  } catch (err) {
    logger.error({ err: err }, "Update publisher profile error:");
    res.status(500).json({ error: "Failed to update publisher profile" });
  }
});

export default router;
