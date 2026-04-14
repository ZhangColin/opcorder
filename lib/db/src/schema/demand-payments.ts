import { pgTable, serial, integer, text, real, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandPaymentMethodEnum = pgEnum("demand_payment_method", ["online", "offline"]);

export const demandPaymentStatusEnum = pgEnum("demand_payment_status", ["pending", "confirmed", "rejected", "refund_pending", "refunding", "refunded"]);

export const demandPaymentsTable = pgTable("demand_payments", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id),
  amount: real("amount").notNull(),
  method: demandPaymentMethodEnum("method").notNull().default("offline"),
  status: demandPaymentStatusEnum("status").notNull().default("pending"),
  paymentOrderNo: varchar("payment_order_no", { length: 100 }),
  receiptUrl: text("receipt_url"),
  paymentNote: text("payment_note"),
  rejectReason: text("reject_reason"),
  confirmedBy: integer("confirmed_by").references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at"),
  refundOrderNo: varchar("refund_order_no", { length: 100 }),
  refundedAt: timestamp("refunded_at"),
  refundReason: text("refund_reason"),
  refundRequestedAt: timestamp("refund_requested_at"),
  refundRejectReason: text("refund_reject_reason"),
  refundReceiptUrl: text("refund_receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDemandPaymentSchema = createInsertSchema(demandPaymentsTable).omit({ id: true, createdAt: true });
export type InsertDemandPayment = z.infer<typeof insertDemandPaymentSchema>;
export type DemandPayment = typeof demandPaymentsTable.$inferSelect;
