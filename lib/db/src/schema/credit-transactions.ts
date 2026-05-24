import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  delta: integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  refId: integer("ref_id"),
  note: text("note"),
  operatorId: integer("operator_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
