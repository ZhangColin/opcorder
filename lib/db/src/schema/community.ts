import { pgTable, serial, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const communityAnnouncementCategoriesTable = pgTable("community_announcement_categories", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const communityAnnouncementsTable = pgTable("community_announcements", {
  id:          serial("id").primaryKey(),
  categoryId:  integer("category_id").references(() => communityAnnouncementCategoriesTable.id, { onDelete: "set null" }),
  title:       varchar("title", { length: 300 }).notNull(),
  content:     text("content").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder:   integer("sort_order").notNull().default(0),
  publishedAt: timestamp("published_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export type CommunityAnnouncementCategory = typeof communityAnnouncementCategoriesTable.$inferSelect;
export type CommunityAnnouncement = typeof communityAnnouncementsTable.$inferSelect;
