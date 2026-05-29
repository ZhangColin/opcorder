import { pgTable, serial, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const subOrdersTable = pgTable("sub_orders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("order_no", { length: 50 }).notNull().references(() => ordersTable.orderNo),
  subOrderNo: varchar("sub_order_no", { length: 80 }).notNull().unique(),
  partyName: varchar("party_name", { length: 200 }),
  merchantNo: varchar("merchant_no", { length: 50 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("opc"),
  subRole: varchar("sub_role", { length: 30 }),
  releasableAt: timestamp("releasable_at"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SubOrder = typeof subOrdersTable.$inferSelect;
