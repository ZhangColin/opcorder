import { pgTable, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publisherProfilesTable = pgTable("publisher_profiles", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id),
  companyDesc: text("company_desc"),
  location: varchar("location", { length: 200 }),
  industry: varchar("industry", { length: 200 }),
  teamSize: varchar("team_size", { length: 50 }),
  foundedYear: varchar("founded_year", { length: 10 }),
  website: varchar("website", { length: 500 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  creditCode: varchar("credit_code", { length: 100 }),
  companyLogo: text("company_logo"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPublisherProfileSchema = createInsertSchema(publisherProfilesTable).omit({ updatedAt: true });
export type InsertPublisherProfile = z.infer<typeof insertPublisherProfileSchema>;
export type PublisherProfile = typeof publisherProfilesTable.$inferSelect;
