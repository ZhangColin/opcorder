import {
  pgTable, pgEnum, serial, integer, text, varchar, boolean,
  timestamp, jsonb, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const v2ClientDemandStatusEnum = pgEnum("v2_client_demand_status", [
  "draft",
  "negotiating",
  "quoting",
  "pending_contract",
  "executing",
  "warranty",
  "completed",
  "closed",
]);

export const v2ClientDemandsTable = pgTable("v2_client_demands", {
  id: serial("id").primaryKey(),
  demandNo: varchar("demand_no", { length: 50 }).notNull().unique(),
  publisherId: integer("publisher_id").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 200 }).notNull(),
  demandType: varchar("demand_type", { length: 50 }),
  isUrgent: boolean("is_urgent").notNull().default(false),
  budgetMin: real("budget_min"),
  budgetMax: real("budget_max"),
  hopeDeliveryDate: timestamp("hope_delivery_date"),
  status: v2ClientDemandStatusEnum("status").notNull().default("draft"),
  warrantyEndDate: timestamp("warranty_end_date"),
  closedReason: text("closed_reason"),
  closedBy: integer("closed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_client_demands_publisher_idx").on(t.publisherId),
  index("v2_client_demands_status_idx").on(t.status),
]);

export type V2ClientDemand = typeof v2ClientDemandsTable.$inferSelect;
export type V2ClientDemandInsert = typeof v2ClientDemandsTable.$inferInsert;

export const v2ClientDemandVersionsTable = pgTable("v2_client_demand_versions", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull().default(1),
  detail: text("detail").notNull().default(""),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
  editedBy: integer("edited_by").references(() => usersTable.id),
  editComment: text("edit_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("v2_client_demand_versions_demand_idx").on(t.demandId),
]);

export type V2ClientDemandVersion = typeof v2ClientDemandVersionsTable.$inferSelect;
