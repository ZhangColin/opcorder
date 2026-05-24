import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { catCategoriesTable } from "./cat-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const catTagsTable = pgTable("cat_tags", {
  id: serial("id").primaryKey(),
  catCategoryId: integer("cat_category_id").notNull().references(() => catCategoriesTable.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCatTagSchema = createInsertSchema(catTagsTable).omit({ id: true, createdAt: true });
export type InsertCatTag = z.infer<typeof insertCatTagSchema>;
export type CatTag = typeof catTagsTable.$inferSelect;
