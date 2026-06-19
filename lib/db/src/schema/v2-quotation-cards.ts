import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, jsonb, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";
import { v2TendersTable } from "./v2-tenders";

export const v2QuotationCardParentTypeEnum = pgEnum("v2_quotation_card_parent_type", [
  "client_demand",
  "tender",
]);

export const v2QuotationCardsTable = pgTable("v2_quotation_cards", {
  id: serial("id").primaryKey(),
  parentType: v2QuotationCardParentTypeEnum("parent_type").notNull(),
  clientDemandId: integer("client_demand_id").references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  tenderId: integer("tender_id").references(() => v2TendersTable.id, { onDelete: "cascade" }),
  totalPrice: real("total_price").notNull().default(0),
  breakdown: jsonb("breakdown").$type<Array<{ item: string; amount: number; note?: string }>>().notNull().default([]),
  note: text("note"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_quotation_cards_client_demand_idx").on(t.clientDemandId),
  index("v2_quotation_cards_tender_idx").on(t.tenderId),
]);

export type V2QuotationCard = typeof v2QuotationCardsTable.$inferSelect;
export type V2QuotationCardInsert = typeof v2QuotationCardsTable.$inferInsert;
