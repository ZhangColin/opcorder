import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, boolean, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2OutsourceOrdersTable } from "./v2-outsource-orders";
import { v2ContractsTable } from "./v2-contracts";

export const v2SettlementPlanStatusEnum = pgEnum("v2_settlement_plan_status", [
  "pending",
  "payable",
  "paid",
]);

export const v2SettlementPlansTable = pgTable("v2_settlement_plans", {
  id: serial("id").primaryKey(),
  outsourceOrderId: integer("outsource_order_id").notNull().references(() => v2OutsourceOrdersTable.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => v2ContractsTable.id, { onDelete: "set null" }),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  itemNo: integer("item_no").notNull().default(1),
  description: varchar("description", { length: 200 }),
  amount: real("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: v2SettlementPlanStatusEnum("status").notNull().default("pending"),
  isLastItem: boolean("is_last_item").notNull().default(false),
  paymentVoucherUrl: text("payment_voucher_url"),
  paymentNote: text("payment_note"),
  paidBy: integer("paid_by").references(() => usersTable.id),
  paidAt: timestamp("paid_at"),
  bankAccountSnapshot: text("bank_account_snapshot"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_settlement_plans_order_idx").on(t.outsourceOrderId),
  index("v2_settlement_plans_opc_idx").on(t.opcId),
  index("v2_settlement_plans_status_idx").on(t.status),
  index("v2_settlement_plans_due_date_idx").on(t.dueDate),
]);

export type V2SettlementPlan = typeof v2SettlementPlansTable.$inferSelect;
export type V2SettlementPlanInsert = typeof v2SettlementPlansTable.$inferInsert;
