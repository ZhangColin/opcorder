import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { contestsTable } from "./contests";
import { catCategoriesTable } from "./cat-categories";
import { contestQuestionsTable } from "./contest-questions";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestTracksTable = pgTable("contest_tracks", {
  id: serial("id").primaryKey(),
  contestId: integer("contest_id").notNull().references(() => contestsTable.id, { onDelete: "cascade" }),
  catCategoryId: integer("cat_category_id").notNull().references(() => catCategoriesTable.id),
  testQuestionId: integer("test_question_id").references(() => contestQuestionsTable.id),
  aQuestionId: integer("a_question_id").references(() => contestQuestionsTable.id),
  bQuestionId: integer("b_question_id").references(() => contestQuestionsTable.id),
  cQuestionId: integer("c_question_id").references(() => contestQuestionsTable.id),
  testDurationHours: integer("test_duration_hours").notNull().default(72),
  aDurationHours: integer("a_duration_hours").notNull().default(72),
  bDurationHours: integer("b_duration_hours").notNull().default(72),
  cDurationHours: integer("c_duration_hours").notNull().default(72),
  quotaTotal: integer("quota_total").notNull().default(0),
  quotaUsed: integer("quota_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContestTrackSchema = createInsertSchema(contestTracksTable).omit({ id: true, createdAt: true, quotaUsed: true });
export type InsertContestTrack = z.infer<typeof insertContestTrackSchema>;
export type ContestTrack = typeof contestTracksTable.$inferSelect;
