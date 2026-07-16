import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const platformInfoTable = pgTable("platform_info", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 200 }),
  creditCode: varchar("credit_code", { length: 50 }),
  taxId: varchar("tax_id", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 50 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  contactAddress: varchar("contact_address", { length: 300 }),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccount: varchar("bank_account", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformInfo = typeof platformInfoTable.$inferSelect;
