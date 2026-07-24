import { pgTable, serial, integer, text, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationTypeEnum = pgEnum("notification_type", [
  "bid_received", "bid_accepted", "bid_rejected", "order_created",
  "delivery_submitted", "delivery_accepted", "delivery_rejected",
  "directed_invite", "system", "order_completed", "dispute_raised",
  // V2 Channel A (Publisher ↔ Platform)
  "v2_demand_submitted",
  "v2_demand_detail_updated",
  "v2_quote_initiated",
  "v2_quote_confirmed",
  "v2_quote_commented",
  "v2_contract_finalized",
  "v2_contract_confirmed",
  "v2_contract_rejected",
  "v2_contract_signed",
  "v2_contract_esign_pending",
  "v2_payment_voucher_uploaded",
  "v2_payment_approved",
  "v2_delivery_a_created",
  "v2_delivery_a_confirmed",
  "v2_delivery_a_rejected",
  "v2_warranty_started",
  "v2_demand_verified",
  "v2_ticket_a_created",
  "v2_ticket_a_closed",
  // V2 Channel B (Platform ↔ OPC)
  "v2_demand_invited",
  "v2_outsource_detail_updated",
  "v2_tender_won",
  "v2_tender_lost",
  "v2_tender_cancelled",
  "v2_delivery_b_submitted",
  "v2_delivery_b_approved",
  "v2_delivery_b_rejected",
  "v2_settlement_paid",
  "v2_ticket_b_created",
  "v2_ticket_b_closed",
  "v2_opc_confirmed_contract",
  "v2_contract_officially_signed",
  // Channel A extra
  "v2_payment_online_paid",
  // Shared
  "v2_discussion_replied",
  // Contest
  "contest_test_graded",
  "contest_assignment_graded",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  respondedAction: varchar("responded_action", { length: 20 }),
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
