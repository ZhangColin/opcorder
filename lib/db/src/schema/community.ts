import { pgTable, serial, text, varchar, boolean, timestamp, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

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
  communityId: integer("community_id").references(() => communitiesTable.id, { onDelete: "set null" }),
  title:       varchar("title", { length: 300 }).notNull(),
  coverUrl:    text("cover_url"),
  content:     text("content").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder:   integer("sort_order").notNull().default(0),
  publishedAt: timestamp("published_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const communitiesTable = pgTable("communities", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 200 }).notNull(),
  address:     text("address"),
  description: text("description"),
  logoUrl:     text("logo_url"),
  qrCodeUrl:   text("qr_code_url"),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const communityAdminsTable = pgTable("community_admins", {
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  userId:      integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] })]);

export const communityConsultationsTable = pgTable("community_consultations", {
  id:          serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  name:        varchar("name", { length: 100 }).notNull(),
  phone:       varchar("phone", { length: 30 }).notNull(),
  email:       varchar("email", { length: 255 }).notNull(),
  content:     text("content").notNull(),
  status:      varchar("status", { length: 20 }).notNull().default("pending"),
  tags:        text("tags").array().notNull().default([]),
  replyNote:   text("reply_note"),
  repliedAt:   timestamp("replied_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("community_consultations_community_id_idx").on(t.communityId),
  index("community_consultations_created_at_idx").on(t.createdAt),
  index("community_consultations_status_idx").on(t.status),
]);

export type Community = typeof communitiesTable.$inferSelect;
export type CommunityAdmin = typeof communityAdminsTable.$inferSelect;
export type CommunityAnnouncementCategory = typeof communityAnnouncementCategoriesTable.$inferSelect;
export type CommunityAnnouncement = typeof communityAnnouncementsTable.$inferSelect;
export type CommunityConsultation = typeof communityConsultationsTable.$inferSelect;
