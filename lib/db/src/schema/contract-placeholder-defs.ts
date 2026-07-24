import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, boolean, index,
} from "drizzle-orm/pg-core";

export const placeholderGroupEnum = pgEnum("placeholder_group", [
  "demand",
  "order",
  "payment",
  "milestone",
  "platform",
  "party_a",
  "party_b",
]);

export const contractPlaceholderDefsTable = pgTable("contract_placeholder_defs", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
  group: placeholderGroupEnum("group").notNull(),
  sourceField: varchar("source_field", { length: 200 }),
  exampleValue: varchar("example_value", { length: 200 }),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("contract_placeholder_defs_group_idx").on(t.group),
]);

export type ContractPlaceholderDef = typeof contractPlaceholderDefsTable.$inferSelect;
export type ContractPlaceholderDefInsert = typeof contractPlaceholderDefsTable.$inferInsert;
