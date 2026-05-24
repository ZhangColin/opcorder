import { pgTable, serial, varchar, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const catCategoriesTable = pgTable("cat_categories", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  description: text("description"),
  colorHex: varchar("color_hex", { length: 10 }),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCatCategorySchema = createInsertSchema(catCategoriesTable).omit({ id: true, createdAt: true });
export type InsertCatCategory = z.infer<typeof insertCatCategorySchema>;
export type CatCategory = typeof catCategoriesTable.$inferSelect;
