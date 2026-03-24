import { pgTable, serial, integer, text, varchar, real, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opcLevelEnum = pgEnum("opc_level", ["C", "B", "A"]);

export const opcProfilesTable = pgTable("opc_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  level: opcLevelEnum("level").notNull().default("C"),
  bio: text("bio"),
  skillTags: jsonb("skill_tags").$type<string[]>().notNull().default([]),
  industryTags: jsonb("industry_tags").$type<string[]>().notNull().default([]),
  creditScore: real("credit_score").notNull().default(4.0),
  totalOrders: integer("total_orders").notNull().default(0),
  completionRate: real("completion_rate").notNull().default(0),
  avgRating: real("avg_rating").notNull().default(0),
  totalEarnings: real("total_earnings").notNull().default(0),
  activityScore: real("activity_score").notNull().default(0),
  title: varchar("title", { length: 200 }),
  location: varchar("location", { length: 100 }),
  website: text("website"),
  yearsExp: integer("years_exp").default(0),
  wechat: varchar("wechat", { length: 100 }),
});

export const insertOpcProfileSchema = createInsertSchema(opcProfilesTable).omit({ id: true });
export type InsertOpcProfile = z.infer<typeof insertOpcProfileSchema>;
export type OpcProfile = typeof opcProfilesTable.$inferSelect;
