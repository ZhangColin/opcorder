import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, jsonb, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2OutsourceDemandsTable } from "./v2-outsource-demands";

export const v2TenderStatusEnum = pgEnum("v2_tender_status", [
  "negotiating",
  "quoted",
  "won",
  "lost",
]);

export const v2TendersTable = pgTable("v2_tenders", {
  id: serial("id").primaryKey(),
  outsourceDemandId: integer("outsource_demand_id").notNull().references(() => v2OutsourceDemandsTable.id, { onDelete: "cascade" }),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  status: v2TenderStatusEnum("status").notNull().default("negotiating"),
  totalPrice: real("total_price"),
  priceBreakdown: jsonb("price_breakdown").$type<Array<{ item: string; amount: number; note?: string }>>().notNull().default([]),
  quotedAt: timestamp("quoted_at"),
  selectedBy: integer("selected_by").references(() => usersTable.id),
  selectedAt: timestamp("selected_at"),
  cancelledReason: text("cancelled_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_tenders_outsource_demand_idx").on(t.outsourceDemandId),
  index("v2_tenders_opc_idx").on(t.opcId),
  index("v2_tenders_status_idx").on(t.status),
]);

export type V2Tender = typeof v2TendersTable.$inferSelect;
export type V2TenderInsert = typeof v2TendersTable.$inferInsert;
