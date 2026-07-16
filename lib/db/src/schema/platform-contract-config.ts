import { pgTable, serial, varchar, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const contractPartyEnum = pgEnum("contract_party_type", ["publisher", "opc"]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["专用发票", "普通发票"]);

export const platformContractConfigTable = pgTable("platform_contract_config", {
  id: serial("id").primaryKey(),
  partyType: contractPartyEnum("party_type").notNull().unique(),
  invoiceType: invoiceTypeEnum("invoice_type").notNull().default("普通发票"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformContractConfig = typeof platformContractConfigTable.$inferSelect;
