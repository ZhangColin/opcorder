import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliverableStatusEnum = pgEnum("deliverable_status", ["submitted", "approved", "rejected"]);

export const deliverablesTable = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  milestoneId: integer("milestone_id"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 255 }),
  status: deliverableStatusEnum("status").notNull().default("submitted"),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertDeliverableSchema = createInsertSchema(deliverablesTable).omit({ id: true, submittedAt: true });
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;
export type Deliverable = typeof deliverablesTable.$inferSelect;
