import { pgTable, serial, integer, text, varchar, real, timestamp, date, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment", "in_progress", "pending_acceptance", "completed", "closed", "disputed"
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("order_no", { length: 20 }).notNull().unique(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  publisherId: integer("publisher_id").notNull().references(() => usersTable.id),
  amount: real("amount").notNull(),
  opcShare: real("opc_share").notNull(),
  publisherShare: real("publisher_share").notNull(),
  platformFee: real("platform_fee").notNull(),
  status: orderStatusEnum("status").notNull(),
  milestones: jsonb("milestones").$type<Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>>().default([]),
  rating: real("rating"),
  reviewComment: text("review_comment"),
  opcRating: real("opc_rating"),
  opcReviewComment: text("opc_review_comment"),
  deadline: date("deadline"),
  /** Payment method used for the order deposit (online or offline). */
  paymentMethod: varchar("payment_method", { length: 20 }),
  /** Receipt URL for offline payment proof. */
  paymentReceiptUrl: text("payment_receipt_url"),
  /** Note accompanying the payment. */
  paymentNote: text("payment_note"),
  /** Payment order number from the online payment provider. */
  paymentOrderNo: varchar("payment_order_no", { length: 100 }),
  /** Timestamp when payment was confirmed and order became in_progress. */
  paidAt: timestamp("paid_at"),
  /** Rejection reason set by admin when rejecting an offline payment receipt. */
  paymentRejectReason: text("payment_reject_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
