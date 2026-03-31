import { pgTable, serial, integer, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfoliosTable = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 200 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  coverImage: text("cover_image"),
  description: text("description").notNull(),
  projectUrl: text("project_url"),
  orderId: integer("order_id"),
  rating: real("rating"),
  clientFeedback: text("client_feedback"),
  applyLevel: varchar("apply_level", { length: 1 }),
  levelApplyStatus: varchar("level_apply_status", { length: 20 }),
  levelApplyNote: text("level_apply_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortfolioSchema = createInsertSchema(portfoliosTable).omit({ id: true, createdAt: true, reviewedAt: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfoliosTable.$inferSelect;
