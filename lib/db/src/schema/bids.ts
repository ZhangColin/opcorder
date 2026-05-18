import { pgTable, serial, integer, text, real, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface QuoteCardSnapshotRow {
  code: string;
  label: string;
  tier: string;
  tierLabel: string;
  price?: number;
  coefficient?: number;
}

export interface QuoteCardSnapshot {
  category: string;
  baseLayers: QuoteCardSnapshotRow[];
  adjustLayers: QuoteCardSnapshotRow[];
  baseTotal: number;
  factorProduct: number;
  finalPrice: number;
}

export const bidStatusEnum = pgEnum("bid_status", ["pending", "accepted", "rejected", "withdrawn"]);

export const bidsTable = pgTable("bids", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  /** Text proposal / cover letter. Optional when quoteCardData is provided. */
  proposal: text("proposal").notNull().default(""),
  estimatedDays: integer("estimated_days").notNull(),
  portfolioLinks: jsonb("portfolio_links").$type<string[]>().default([]),
  /** Structured quote card dimension selections (dimensionCode → tier). */
  quoteCardData: jsonb("quote_card_data").$type<Record<string, string>>().default({}),
  /** Full immutable snapshot of the quote card at submission time (for historical display). */
  quoteCardSnapshot: jsonb("quote_card_snapshot").$type<QuoteCardSnapshot | null>().default(null),
  /** Final quoted price derived from quote card selections (yuan). */
  quotedPrice: real("quoted_price"),
  status: bidStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
