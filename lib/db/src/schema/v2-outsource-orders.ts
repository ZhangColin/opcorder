import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2OutsourceDemandsTable } from "./v2-outsource-demands";
import { v2TendersTable } from "./v2-tenders";

export const v2OutsourceOrderStatusEnum = pgEnum("v2_outsource_order_status", [
  "pending_contract",
  "executing",
  "warranty",
  "completed",
  "cancelled",
]);

export const v2OutsourceOrdersTable = pgTable("v2_outsource_orders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("order_no", { length: 50 }).notNull().unique(),
  outsourceDemandId: integer("outsource_demand_id").notNull().references(() => v2OutsourceDemandsTable.id),
  tenderId: integer("tender_id").notNull().references(() => v2TendersTable.id),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  status: v2OutsourceOrderStatusEnum("status").notNull().default("pending_contract"),
  warrantyStartDate: timestamp("warranty_start_date"),
  warrantyEndDate: timestamp("warranty_end_date"),
  verifiedBy: integer("verified_by").references(() => usersTable.id),
  verifiedAt: timestamp("verified_at"),
  cancelledReason: text("cancelled_reason"),
  cancelledBy: integer("cancelled_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_outsource_orders_demand_idx").on(t.outsourceDemandId),
  index("v2_outsource_orders_tender_idx").on(t.tenderId),
  index("v2_outsource_orders_opc_idx").on(t.opcId),
  index("v2_outsource_orders_status_idx").on(t.status),
]);

export type V2OutsourceOrder = typeof v2OutsourceOrdersTable.$inferSelect;
export type V2OutsourceOrderInsert = typeof v2OutsourceOrdersTable.$inferInsert;
