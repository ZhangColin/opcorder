import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const userId = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!userId || isNaN(Number(userId))) {
    return res.status(401).json({ error: "未登录" });
  }

  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, Number(userId)))
    .limit(1);

  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "需要管理员权限" });
  }

  next();
}
