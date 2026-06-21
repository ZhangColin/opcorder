import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, boolean, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";
import { v2ContractsTable } from "./v2-contracts";

export const v2PaymentPlanStatusEnum = pgEnum("v2_payment_plan_status", [
  "pending",
  "awaiting_review",
  "paid",
]);

export const v2PaymentPlansTable = pgTable("v2_payment_plans", {
  id: serial("id").primaryKey(),
  clientDemandId: integer("client_demand_id").notNull().references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => v2ContractsTable.id, { onDelete: "set null" }),
  itemNo: integer("item_no").notNull().default(1),
  description: varchar("description", { length: 200 }),
  amount: real("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: v2PaymentPlanStatusEnum("status").notNull().default("pending"),
  voucherUrl: text("voucher_url"),
  voucherNote: text("voucher_note"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  paidAt: timestamp("paid_at"),
  isLastItem: boolean("is_last_item").notNull().default(false),
  paymentOrderNo: text("payment_order_no"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_payment_plans_client_demand_idx").on(t.clientDemandId),
  index("v2_payment_plans_status_idx").on(t.status),
  index("v2_payment_plans_due_date_idx").on(t.dueDate),
]);

export type V2PaymentPlan = typeof v2PaymentPlansTable.$inferSelect;
export type V2PaymentPlanInsert = typeof v2PaymentPlansTable.$inferInsert;
