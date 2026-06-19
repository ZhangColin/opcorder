import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const v2DiscussionParentTypeEnum = pgEnum("v2_discussion_parent_type", [
  "client_demand",
  "outsource_demand",
  "tender",
  "deliverable_a",
  "deliverable_b",
  "ticket_a",
  "ticket_b",
]);

export const v2DiscussionPostsTable = pgTable("v2_discussion_posts", {
  id: serial("id").primaryKey(),
  parentType: v2DiscussionParentTypeEnum("parent_type").notNull(),
  parentId: integer("parent_id").notNull(),
  parentPostId: integer("parent_post_id"),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull().default(""),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
  isSystemMessage: integer("is_system_message").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_discussion_posts_parent_idx").on(t.parentType, t.parentId),
  index("v2_discussion_posts_author_idx").on(t.authorId),
  index("v2_discussion_posts_parent_post_idx").on(t.parentPostId),
]);

export type V2DiscussionPost = typeof v2DiscussionPostsTable.$inferSelect;
export type V2DiscussionPostInsert = typeof v2DiscussionPostsTable.$inferInsert;
