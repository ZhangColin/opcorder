import { pgTable, serial, integer, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const settlementStatusEnum = pgEnum("settlement_status", ["pending", "verified", "rejected"]);

export const settlementAccountsTable = pgTable("settlement_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  companyName: varchar("company_name", { length: 200 }),
  creditCode: varchar("credit_code", { length: 50 }),
  bankName: varchar("bank_name", { length: 100 }),
  bankBranch: varchar("bank_branch", { length: 200 }),
  bankAccount: varchar("bank_account", { length: 50 }),
  accountName: varchar("account_name", { length: 100 }),
  contactName: varchar("contact_name", { length: 50 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  businessLicenseUrl: text("business_license_url"),
  legalRepIdFrontUrl: text("legal_rep_id_front_url"),
  legalRepIdBackUrl: text("legal_rep_id_back_url"),
  ccbMerchantNo: varchar("ccb_merchant_no", { length: 50 }),
  rejectReason: text("reject_reason"),
  status: settlementStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SettlementAccount = typeof settlementAccountsTable.$inferSelect;
