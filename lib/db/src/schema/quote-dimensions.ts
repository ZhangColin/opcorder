import { pgTable, serial, varchar, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { catCategoriesTable } from "./cat-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const QUOTE_CATEGORIES = ["software", "education", "marketing", "content", "other"] as const;
export type QuoteCategory = typeof QUOTE_CATEGORIES[number];

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  software: "软件开发",
  education: "教育培训",
  marketing: "营销",
  content: "内容设计",
  other: "其他",
};

export const DEMAND_CATEGORY_MAP: Record<string, QuoteCategory | null> = {
  education: "education",
  software: "software",
  marketing: "marketing",
  content: "content",
  other: null,
};

export const quoteDimensionsTable = pgTable("quote_dimensions", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 20 }).notNull(),
  catCategoryId: integer("cat_category_id").references(() => catCategoriesTable.id),
  layer: varchar("layer", { length: 10 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(t) => [uniqueIndex("quote_dims_cat_layer_code_idx").on(t.category, t.layer, t.code)]);

export const insertQuoteDimensionSchema = createInsertSchema(quoteDimensionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteDimension = z.infer<typeof insertQuoteDimensionSchema>;
export type QuoteDimension = typeof quoteDimensionsTable.$inferSelect;
