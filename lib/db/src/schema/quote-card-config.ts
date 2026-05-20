import { pgTable, serial, varchar, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Platform-level pricing configuration for the structured quote card.
 * Each row represents one dimension-tier combination (e.g. D1 / S tier).
 *
 * Dimension codes: D1–D5 (deliverable dimensions), C1–C4 (capability dimensions)
 * Tier codes: S | M | L | XL
 */
export const quoteCardConfigTable = pgTable(
  "quote_card_configs",
  {
    id: serial("id").primaryKey(),
    dimensionCode: varchar("dimension_code", { length: 10 }).notNull(),
    dimensionLabel: text("dimension_label").notNull(),
    tier: varchar("tier", { length: 10 }).notNull(),
    tierLabel: text("tier_label").notNull(),
    basePrice: real("base_price").notNull().default(0),
    coefficient: real("coefficient"),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quote_card_configs_dimension_tier_idx").on(table.dimensionCode, table.tier),
  ]
);

export const insertQuoteCardConfigSchema = createInsertSchema(quoteCardConfigTable).omit({ id: true, updatedAt: true });
export type InsertQuoteCardConfig = z.infer<typeof insertQuoteCardConfigSchema>;
export type QuoteCardConfig = typeof quoteCardConfigTable.$inferSelect;
