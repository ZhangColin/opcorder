import { pgTable, serial, integer, text, varchar, real, boolean, timestamp, date, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandTypeEnum = pgEnum("demand_type", [
  "ai_education", "gov_training", "ai_research", "party_building",
  "livestream_media", "ai_tool_dev", "other"
]);

export const demandStatusEnum = pgEnum("demand_status", [
  "draft", "pending_review", "published", "matched",
  "in_progress", "pending_acceptance", "completed", "closed"
]);

export const demandModeEnum = pgEnum("demand_mode", ["open", "directed"]);

export const demandsTable = pgTable("demands", {
  id: serial("id").primaryKey(),
  demandNo: varchar("demand_no", { length: 20 }).notNull().unique(),
  title: varchar("title", { length: 50 }).notNull(),
  type: demandTypeEnum("type").notNull(),
  description: text("description").notNull(),
  skillTags: jsonb("skill_tags").$type<string[]>().notNull().default([]),
  opcLevel: varchar("opc_level", { length: 10 }).notNull().default("any"),
  budgetMin: real("budget_min").notNull(),
  budgetMax: real("budget_max").notNull(),
  deadline: date("deadline").notNull(),
  milestones: jsonb("milestones").$type<Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>>().default([]),
  attachments: jsonb("attachments").$type<Array<{ name: string; size: string; type: string; url: string }>>().default([]),
  mode: demandModeEnum("mode").notNull().default("open"),
  status: demandStatusEnum("status").notNull().default("draft"),
  isUrgent: boolean("is_urgent").notNull().default(false),
  bidDeadline: timestamp("bid_deadline"),
  publisherId: integer("publisher_id").notNull().references(() => usersTable.id),
  directedOpcIds: jsonb("directed_opc_ids").$type<number[]>().default([]),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDemandSchema = createInsertSchema(demandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type Demand = typeof demandsTable.$inferSelect;
