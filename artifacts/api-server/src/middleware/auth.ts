import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: number;
  role: string;
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "未登录，请先登录" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    const userId = typeof payload.sub === "string" ? parseInt(payload.sub, 10) : Number(payload.sub);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: "无效的登录凭证" });
    }
    req.user = { id: userId, role: payload.role as string };
    next();
  } catch {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}
