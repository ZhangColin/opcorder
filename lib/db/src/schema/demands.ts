import { pgTable, serial, integer, text, varchar, real, boolean, timestamp, date, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { catCategoriesTable } from "./cat-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandTypeEnum = pgEnum("demand_type", [
  // Current canonical values
  "education", "software", "marketing", "content", "other",
  // Legacy values: kept in schema so Replit's publish diff only needs ADD VALUE,
  // never an ALTER COLUMN (which would fail while old rows still exist).
  // runtime migrations.ts converts these to the new values above.
  // Remove only after all production rows have been migrated.
  "ai_education", "gov_training", "ai_research",
  "party_building", "livestream_media", "ai_tool_dev",
]);

export const demandStatusEnum = pgEnum("demand_status", [
  "draft", "pending_review", "pending_payment", "published", "matched",
  "in_progress", "pending_acceptance", "completed", "closed",
  "refund_pending", "refunding", "refunded"
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
  /** @deprecated Use budgetMin / budgetMax instead. Kept for backward compatibility. */
  budget: real("budget").notNull().default(0),
  /** Minimum budget (price range lower bound). Replaces the legacy budget field. */
  budgetMin: real("budget_min").notNull().default(0),
  /** Maximum budget (price range upper bound). */
  budgetMax: real("budget_max").notNull().default(0),
  deadline: date("deadline").notNull(),
  milestones: jsonb("milestones").$type<Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>>().default([]),
  attachments: jsonb("attachments").$type<Array<{ name: string; size: string; type: string; url: string }>>().default([]),
  mode: demandModeEnum("mode").notNull().default("open"),
  status: demandStatusEnum("status").notNull().default("draft"),
  isUrgent: boolean("is_urgent").notNull().default(false),
  bidDeadline: timestamp("bid_deadline"),
  publisherId: integer("publisher_id").notNull().references(() => usersTable.id),
  directedOpcIds: jsonb("directed_opc_ids").$type<number[]>().default([]),
  summary: text("summary"),
  catCategoryId: integer("cat_category_id").references(() => catCategoriesTable.id),
  requiredTrackLevel: varchar("required_track_level", { length: 5 }).notNull().default("any"),
  rejectionReason: text("rejection_reason"),
  /** Platform commission rate applied to this demand (0–1). Default 10%. */
  commissionRate: real("commission_rate").notNull().default(0.10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDemandSchema = createInsertSchema(demandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type Demand = typeof demandsTable.$inferSelect;
