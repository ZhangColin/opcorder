import { pgTable, serial, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id:        serial("id").primaryKey(),
  title:     varchar("title", { length: 300 }).notNull(),
  fileUrl:   text("file_url"),
  fileName:  varchar("file_name", { length: 300 }),
  fileType:  varchar("file_type", { length: 100 }),
  isPinned:  boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
