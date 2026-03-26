import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, opcProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "请填写邮箱和密码" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "账号或密码错误" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "账号或密码错误" });
    }

    if (role && user.role !== role && user.role !== "admin") {
      const roleLabel = user.role === "opc" ? "OPC 超级个体" : "需求发布方";
      return res.status(403).json({
        error: `该账号已注册为【${roleLabel}】，请切换对应身份登录`,
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "该账号已被停用，请联系管理员" });
    }

    res.json({
      id:        user.id,
      nickname:  user.nickname,
      email:     user.email,
      avatar:    user.avatar,
      role:      user.role,
      status:    user.status,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { nickname, email, password, role } = req.body as {
      nickname: string;
      email: string;
      password: string;
      role: string;
    };

    if (!nickname || !email || !password || !role) {
      return res.status(400).json({ error: "请填写完整的注册信息" });
    }
    if (!["opc", "publisher"].includes(role)) {
      return res.status(400).json({ error: "无效的身份类型" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少 6 位" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "该邮箱已被注册，请直接登录" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      nickname: nickname.trim(),
      email: normalizedEmail,
      passwordHash,
      role: role as "opc" | "publisher",
    }).returning();

    /* ── Auto-create OPC profile row for OPC registrants ── */
    if (role === "opc") {
      await db.insert(opcProfilesTable).values({ userId: user.id });
    }

    res.status(201).json({
      id:        user.id,
      nickname:  user.nickname,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "注册失败，请稍后重试" });
  }
});

export default router;
