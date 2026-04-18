import { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth";
import { db, adminRolesTable, adminRoleAssignmentsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/** Extends req.user with RBAC fields populated by requireAdmin */
declare global {
  namespace Express {
    interface User {
      isSuperAdmin?: boolean;
      adminPermissions?: string[];
    }
  }
}

async function loadAdminPermissions(userId: number): Promise<string[]> {
  const assignments = await db
    .select({ roleId: adminRoleAssignmentsTable.roleId })
    .from(adminRoleAssignmentsTable)
    .where(eq(adminRoleAssignmentsTable.userId, userId));

  if (assignments.length === 0) return [];

  const roleIds = assignments.map((a) => a.roleId);
  const roles = await db
    .select({ permissions: adminRolesTable.permissions })
    .from(adminRolesTable)
    .where(inArray(adminRolesTable.id, roleIds));

  const merged = new Set<string>();
  for (const role of roles) {
    for (const p of role.permissions ?? []) merged.add(p);
  }
  return Array.from(merged);
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "需要管理员权限" });
    }

    try {
      // Look up isSuperAdmin from the DB (not stored in JWT)
      const [userRow] = await db
        .select({ isSuperAdmin: usersTable.isSuperAdmin })
        .from(usersTable)
        .where(eq(usersTable.id, req.user.id))
        .limit(1);

      const isSuperAdmin = userRow?.isSuperAdmin ?? false;
      req.user.isSuperAdmin = isSuperAdmin;

      if (isSuperAdmin) {
        req.user.adminPermissions = ["*"];
        return next();
      }

      const permissions = await loadAdminPermissions(req.user.id);
      req.user.adminPermissions = permissions;
      next();
    } catch {
      next();
    }
  });
}

/**
 * Middleware factory — checks that the authenticated admin has a specific permission key.
 * Super admins (adminPermissions === ["*"]) always pass.
 * Must be used AFTER requireAdmin.
 */
export function requirePermission(key: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms = req.user?.adminPermissions ?? [];
    if (perms.includes("*") || perms.includes(key)) return next();
    return res.status(403).json({ error: "权限不足", required: key });
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ error: "需要超级管理员权限" });
    return;
  }
  next();
}
