import { pgTable, serial, integer, varchar, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { quoteDimensionsTable } from "./quote-dimensions";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quoteTiersTable = pgTable("quote_tiers", {
  id: serial("id").primaryKey(),
  dimensionId: integer("dimension_id").notNull().references(() => quoteDimensionsTable.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull(),
  tierLabel: text("tier_label").notNull(),
  basePrice: real("base_price").notNull().default(0),
  coefficient: real("coefficient"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(t) => [uniqueIndex("quote_tiers_dim_tier_idx").on(t.dimensionId, t.tier)]);

export const insertQuoteTierSchema = createInsertSchema(quoteTiersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteTier = z.infer<typeof insertQuoteTierSchema>;
export type QuoteTier = typeof quoteTiersTable.$inferSelect;
