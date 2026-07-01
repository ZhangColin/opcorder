import { pgTable, serial, integer, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { catCategoriesTable } from "./cat-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestQuestionsTable = pgTable("contest_questions", {
  id: serial("id").primaryKey(),
  catCategoryId: integer("cat_category_id").notNull().references(() => catCategoriesTable.id),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull().default(""),
  attachments: jsonb("attachments").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContestQuestionSchema = createInsertSchema(contestQuestionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContestQuestion = z.infer<typeof insertContestQuestionSchema>;
export type ContestQuestion = typeof contestQuestionsTable.$inferSelect;
