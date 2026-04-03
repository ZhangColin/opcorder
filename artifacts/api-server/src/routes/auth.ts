import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { db, usersTable, opcProfilesTable, refreshTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const resend = new Resend(process.env.RESEND_API_KEY);

const router: IRouter = Router();

const JWT_EXPIRY_SECONDS = 2 * 60 * 60;
const REFRESH_TOKEN_DAYS = 7;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

function signAccessToken(userId: number, role: string): string {
  return jwt.sign(
    { sub: String(userId), role },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: JWT_EXPIRY_SECONDS }
  );
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function upsertRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
  await db
    .insert(refreshTokensTable)
    .values({ userId, tokenHash, expiresAt })
    .onConflictDoUpdate({
      target: refreshTokensTable.userId,
      set: { tokenHash, expiresAt, createdAt: new Date() },
    });
}

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

    const accessToken = signAccessToken(user.id, user.role);
    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await upsertRefreshToken(user.id, hashToken(rawRefreshToken), expiresAt);

    res.json({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id:        user.id,
        nickname:  user.nickname,
        email:     user.email,
        avatar:    user.avatar,
        role:      user.role,
        status:    user.status,
        createdAt: user.createdAt.toISOString(),
      },
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

router.post("/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ error: "缺少 refreshToken" });
    }

    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    const [row] = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.expiresAt < now) {
      return res.status(401).json({ error: "登录已过期，请重新登录" });
    }

    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role, status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.id, row.userId))
      .limit(1);

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "账号已停用，请联系管理员" });
    }

    const accessToken = signAccessToken(user.id, user.role);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "刷新失败，请重新登录" });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token) {
      try {
        /* Accept expired tokens but still verify the signature — prevents forged tokens
           from revoking other users' sessions. */
        const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], ignoreExpiration: true }) as jwt.JwtPayload;
        const userId = typeof payload.sub === "string" ? parseInt(payload.sub, 10) : Number(payload.sub);
        if (userId && !isNaN(userId)) {
          await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, userId));
        }
      } catch { /* invalid signature — nothing to revoke */ }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "登出失败" });
  }
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "请填写完整信息" });
    if (newPassword.length < 6) return res.status(400).json({ error: "新密码至少 6 位" });

    const [user] = await db
      .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || !user.passwordHash) return res.status(404).json({ error: "用户不存在" });

    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) return res.status(400).json({ error: "旧密码不正确，请重新输入" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "修改失败，请稍后重试" });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "请填写邮箱地址" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [user] = await db
      .select({ id: usersTable.id, nickname: usersTable.nickname, email: usersTable.email, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "该邮箱未注册，请检查邮箱地址是否正确" });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ error: "该账号未设置密码，请联系管理员" });
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const newHash = await bcrypt.hash(tempPassword, 10);

    await db.update(usersTable)
      .set({ passwordHash: newHash })
      .where(eq(usersTable.id, user.id));

    const { error: sendError } = await resend.emails.send({
      from: "接单吧 <noreply@aieducenter.com>",
      to: normalizedEmail,
      subject: "【接单吧】您的临时密码",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9f9fc;">
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
              <div style="background: #0047ab; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-weight: 900; font-size: 18px;">接</span>
              </div>
              <span style="font-weight: 900; font-size: 20px; color: #0047ab;">接单吧</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #1a1c1e; margin: 0 0 8px;">您好，${user.nickname}</h2>
            <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
              我们已为您重置了登录密码，请使用以下临时密码登录，并在登录后及时修改密码。
            </p>
            <div style="background: #f0f4ff; border: 2px dashed #0047ab; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">临时密码</p>
              <p style="font-size: 28px; font-weight: 900; color: #0047ab; letter-spacing: 4px; margin: 0;">${tempPassword}</p>
            </div>
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
              如果您没有申请重置密码，请忽略此邮件，您的账号依然安全。<br/>
              此邮件由系统自动发送，请勿回复。
            </p>
          </div>
          <p style="text-align: center; color: #c4c4c4; font-size: 12px; margin: 16px 0 0;">© 2026 接单吧 · OPC撮合交易平台</p>
        </div>
      `,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return res.status(500).json({ error: "邮件发送失败，请稍后重试" });
    }

    res.json({ success: true, message: "临时密码已发送至您的邮箱，请查收" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

export default router;
