import {
  pgTable, pgEnum, serial, integer, text, varchar, boolean,
  timestamp, jsonb, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";

export const v2OutsourceDemandStatusEnum = pgEnum("v2_outsource_demand_status", [
  "draft",
  "negotiating",
  "executing",
  "warranty",
  "completed",
  "closed",
]);

export const v2OutsourceDemandModeEnum = pgEnum("v2_outsource_demand_mode", [
  "public",
  "invited",
]);

export const v2OutsourceDemandsTable = pgTable("v2_outsource_demands", {
  id: serial("id").primaryKey(),
  demandNo: varchar("demand_no", { length: 50 }).notNull().unique(),
  clientDemandId: integer("client_demand_id").references(() => v2ClientDemandsTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 200 }).notNull(),
  demandType: varchar("demand_type", { length: 50 }),
  isUrgent: boolean("is_urgent").notNull().default(false),
  mode: v2OutsourceDemandModeEnum("mode").notNull().default("public"),
  expectedPriceMin: real("expected_price_min"),
  expectedPriceMax: real("expected_price_max"),
  milestones: jsonb("milestones").$type<Array<{ name: string; deadline?: string; description?: string }>>().notNull().default([]),
  status: v2OutsourceDemandStatusEnum("status").notNull().default("negotiating"),
  closedReason: text("closed_reason"),
  closedBy: integer("closed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_outsource_demands_client_demand_idx").on(t.clientDemandId),
  index("v2_outsource_demands_status_idx").on(t.status),
  index("v2_outsource_demands_mode_idx").on(t.mode),
]);

export type V2OutsourceDemand = typeof v2OutsourceDemandsTable.$inferSelect;
export type V2OutsourceDemandInsert = typeof v2OutsourceDemandsTable.$inferInsert;

export const v2OutsourceDemandVersionsTable = pgTable("v2_outsource_demand_versions", {
  id: serial("id").primaryKey(),
  outsourceDemandId: integer("outsource_demand_id").notNull().references(() => v2OutsourceDemandsTable.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull().default(1),
  detail: text("detail").notNull().default(""),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
  editedBy: integer("edited_by").references(() => usersTable.id),
  editComment: text("edit_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("v2_outsource_demand_versions_demand_idx").on(t.outsourceDemandId),
]);

export type V2OutsourceDemandVersion = typeof v2OutsourceDemandVersionsTable.$inferSelect;
