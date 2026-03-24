import { pgTable, serial, integer, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bidStatusEnum = pgEnum("bid_status", ["pending", "accepted", "rejected"]);

export const bidsTable = pgTable("bids", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  proposal: text("proposal").notNull(),
  estimatedDays: integer("estimated_days").notNull(),
  portfolioLinks: jsonb("portfolio_links").$type<string[]>().default([]),
  status: bidStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
