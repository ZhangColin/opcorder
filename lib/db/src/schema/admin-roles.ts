import { pgTable, serial, varchar, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ADMIN_PERMISSION_KEYS = [
  "dashboard",
  "cockpit",
  "users",
  "demands",
  "payments",
  "orders",
  "disputes",
  "finance",
  "ecosystem",
  "training",
  "levelcert",
  "content",
  "sensitivewords",
  "activities",
  "settings",
  "screen",
  "operation",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const adminRolesTable = pgTable("admin_roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminRoleAssignmentsTable = pgTable("admin_role_assignments", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => adminRolesTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId] }),
]);

export type AdminRole = typeof adminRolesTable.$inferSelect;
export type AdminRoleAssignment = typeof adminRoleAssignmentsTable.$inferSelect;
