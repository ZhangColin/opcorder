import { pgTable, serial, integer, text, varchar, real, timestamp, date, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", [
  "in_progress", "pending_acceptance", "completed", "closed", "disputed"
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
  status: orderStatusEnum("status").notNull().default("in_progress"),
  milestones: jsonb("milestones").$type<Array<{ name: string; deadline: string; deliverableDesc?: string; status?: string }>>().default([]),
  rating: real("rating"),
  reviewComment: text("review_comment"),
  opcRating: real("opc_rating"),
  opcReviewComment: text("opc_review_comment"),
  deadline: date("deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
