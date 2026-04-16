import { pgTable, serial, varchar, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: varchar("level", { length: 10 }).notNull().default("info"),
  category: varchar("category", { length: 50 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  operatorId: integer("operator_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SystemLog = typeof systemLogsTable.$inferSelect;
export type InsertSystemLog = typeof systemLogsTable.$inferInsert;
