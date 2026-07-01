import { pgTable, serial, integer, text, jsonb, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { contestsTable } from "./contests";
import { contestTracksTable } from "./contest-tracks";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestRegistrationStatusEnum = pgEnum("contest_registration_status", [
  "registered",
  "test_submitted",
  "test_passed",
  "test_failed",
  "assignment_submitted",
  "assignment_passed",
  "assignment_failed",
]);

export const contestGradeEnum = pgEnum("contest_grade", ["A", "B", "C", "fail"]);

export const contestRegistrationsTable = pgTable("contest_registrations", {
  id: serial("id").primaryKey(),
  contestId: integer("contest_id").notNull().references(() => contestsTable.id),
  trackId: integer("track_id").notNull().references(() => contestTracksTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: contestRegistrationStatusEnum("status").notNull().default("registered"),

  testSubmittedAt: timestamp("test_submitted_at"),
  testContent: text("test_content"),
  testAttachments: jsonb("test_attachments").notNull().default([]),
  testUrls: jsonb("test_urls").notNull().default([]),
  testGrade: contestGradeEnum("test_grade"),

  assignmentSubmittedAt: timestamp("assignment_submitted_at"),
  assignmentContent: text("assignment_content"),
  assignmentAttachments: jsonb("assignment_attachments").notNull().default([]),
  assignmentUrls: jsonb("assignment_urls").notNull().default([]),
  assignmentGrade: contestGradeEnum("assignment_grade"),

  gradeNote: varchar("grade_note", { length: 500 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContestRegistrationSchema = createInsertSchema(contestRegistrationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  testSubmittedAt: true, testContent: true, testAttachments: true, testUrls: true, testGrade: true,
  assignmentSubmittedAt: true, assignmentContent: true, assignmentAttachments: true, assignmentUrls: true, assignmentGrade: true,
  gradeNote: true,
});
export type InsertContestRegistration = z.infer<typeof insertContestRegistrationSchema>;
export type ContestRegistration = typeof contestRegistrationsTable.$inferSelect;
