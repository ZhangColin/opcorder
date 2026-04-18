import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: number;
  role: string;
  isSuperAdmin?: boolean;
  adminPermissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "未登录，请先登录" });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as jwt.JwtPayload;
    const userId = typeof payload.sub === "string" ? parseInt(payload.sub, 10) : Number(payload.sub);
    if (!userId || isNaN(userId)) {
      res.status(401).json({ error: "无效的登录凭证" });
      return;
    }
    req.user = { id: userId, role: payload.role as string };
    next();
  } catch {
    res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}
