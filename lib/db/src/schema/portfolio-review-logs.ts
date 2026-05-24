import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { portfoliosTable } from "./portfolios";
import { usersTable } from "./users";

export const portfolioReviewLogsTable = pgTable("portfolio_review_logs", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfoliosTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  result: varchar("result", { length: 20 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PortfolioReviewLog = typeof portfolioReviewLogsTable.$inferSelect;
