import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sensitiveWordsTable = pgTable("sensitive_words", {
  id: serial("id").primaryKey(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSensitiveWordSchema = createInsertSchema(sensitiveWordsTable).omit({ id: true, createdAt: true });
export type InsertSensitiveWord = z.infer<typeof insertSensitiveWordSchema>;
export type SensitiveWord = typeof sensitiveWordsTable.$inferSelect;
