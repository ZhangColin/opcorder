import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, index, numeric,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";
import { v2OutsourceOrdersTable } from "./v2-outsource-orders";

export const v2ContractChannelEnum = pgEnum("v2_contract_channel", [
  "a",
  "b",
]);

export const v2ContractStatusEnum = pgEnum("v2_contract_status", [
  "draft",
  "pending_publisher_confirm",
  "publisher_rejected",
  "pending_sign",
  "signed",
]);

export const v2ContractsTable = pgTable("v2_contracts", {
  id: serial("id").primaryKey(),
  contractNo: varchar("contract_no", { length: 50 }).notNull().unique(),
  channel: v2ContractChannelEnum("channel").notNull(),
  clientDemandId: integer("client_demand_id").references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  outsourceOrderId: integer("outsource_order_id").references(() => v2OutsourceOrdersTable.id, { onDelete: "cascade" }),
  status: v2ContractStatusEnum("status").notNull().default("draft"),
  content: text("content"),
  signedFileUrl: text("signed_file_url"),
  opcSignedFileUrl: text("opc_signed_file_url"),
  publisherConfirmedAt: timestamp("publisher_confirmed_at"),
  publisherRejectedAt: timestamp("publisher_rejected_at"),
  publisherRejectedReason: text("publisher_rejected_reason"),
  opcConfirmedAt: timestamp("opc_confirmed_at"),
  signedAt: timestamp("signed_at"),
  signedBy: integer("signed_by").references(() => usersTable.id),
  finalizedBy: integer("finalized_by").references(() => usersTable.id),
  finalizedAt: timestamp("finalized_at"),
  invoiceType: varchar("invoice_type", { length: 20 }).default("普通发票"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_contracts_client_demand_idx").on(t.clientDemandId),
  index("v2_contracts_outsource_order_idx").on(t.outsourceOrderId),
  index("v2_contracts_status_idx").on(t.status),
]);

export type V2Contract = typeof v2ContractsTable.$inferSelect;
export type V2ContractInsert = typeof v2ContractsTable.$inferInsert;
