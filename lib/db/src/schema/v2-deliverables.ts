import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";
import { v2OutsourceOrdersTable } from "./v2-outsource-orders";

export const v2DeliverableStatusEnum = pgEnum("v2_deliverable_status", [
  "pending",
  "confirmed",
  "revision",
  "approved",
]);

export const v2DeliverablesATable = pgTable("v2_deliverables_a", {
  id: serial("id").primaryKey(),
  clientDemandId: integer("client_demand_id").notNull().references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  url: text("url"),
  content: text("content"),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
  status: v2DeliverableStatusEnum("status").notNull().default("pending"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  confirmedBy: integer("confirmed_by").references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at"),
  rejectedBy: integer("rejected_by").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at"),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_deliverables_a_demand_idx").on(t.clientDemandId),
  index("v2_deliverables_a_status_idx").on(t.status),
]);

export type V2DeliverableA = typeof v2DeliverablesATable.$inferSelect;
export type V2DeliverableAInsert = typeof v2DeliverablesATable.$inferInsert;

export const v2DeliverablesBTable = pgTable("v2_deliverables_b", {
  id: serial("id").primaryKey(),
  outsourceOrderId: integer("outsource_order_id").notNull().references(() => v2OutsourceOrdersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content"),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
  status: v2DeliverableStatusEnum("status").notNull().default("pending"),
  submittedBy: integer("submitted_by").notNull().references(() => usersTable.id),
  approvedBy: integer("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at"),
  rejectedReason: text("rejected_reason"),
  submissionCount: integer("submission_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_deliverables_b_order_idx").on(t.outsourceOrderId),
  index("v2_deliverables_b_status_idx").on(t.status),
]);

export type V2DeliverableB = typeof v2DeliverablesBTable.$inferSelect;
export type V2DeliverableBInsert = typeof v2DeliverablesBTable.$inferInsert;
