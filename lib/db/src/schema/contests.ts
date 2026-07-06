import { pgTable, serial, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestStatusEnum = pgEnum("contest_status", ["draft", "published", "ended"]);

export const contestsTable = pgTable("contests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  details: text("details").notNull().default(""),
  announcementAt: timestamp("announcement_at").notNull(),
  registrationAt: timestamp("registration_at").notNull(),
  registrationEndAt: timestamp("registration_end_at"),
  publicAt: timestamp("public_at").notNull(),
  benefitAt: timestamp("benefit_at").notNull(),
  deadlineAt: timestamp("deadline_at").notNull(),
  announcementTitle: text("announcement_title"),
  announcementDetails: text("announcement_details"),
  status: contestStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContestSchema = createInsertSchema(contestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContest = z.infer<typeof insertContestSchema>;
export type Contest = typeof contestsTable.$inferSelect;
