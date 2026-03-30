import { pgTable, serial, text, varchar, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["opc", "publisher", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "banned"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  nickname: varchar("nickname", { length: 100 }).notNull(),
  email: varchar("email", { length: 200 }),
  passwordHash: text("password_hash"),
  phone: varchar("phone", { length: 20 }),
  avatar: text("avatar"),
  title: varchar("title", { length: 100 }),
  role: userRoleEnum("role").notNull().default("opc"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("users_email_key").on(t.email),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
