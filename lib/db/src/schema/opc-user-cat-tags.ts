import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { catTagsTable } from "./cat-tags";

export const opcUserCatTagsTable = pgTable("opc_user_cat_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  catTagId: integer("cat_tag_id").notNull().references(() => catTagsTable.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  sourcePortfolioId: integer("source_portfolio_id"),
}, (table) => [
  unique("opc_user_cat_tags_user_tag_unique").on(table.userId, table.catTagId),
]);

export type OpcUserCatTag = typeof opcUserCatTagsTable.$inferSelect;
