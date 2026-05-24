import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditLevelsTable = pgTable("credit_levels", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  minPoints: integer("min_points").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  color: varchar("color", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreditLevelSchema = createInsertSchema(creditLevelsTable).omit({ id: true, createdAt: true });
export type InsertCreditLevel = z.infer<typeof insertCreditLevelSchema>;
export type CreditLevel = typeof creditLevelsTable.$inferSelect;
