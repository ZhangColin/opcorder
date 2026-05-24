import { pgTable, serial, varchar, integer, boolean, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditActionTypeEnum = pgEnum("credit_action_type", [
  "order_completed",
  "five_star_review",
  "bad_review",
  "order_disputed",
  "manual_adjustment",
]);

export const creditRulesTable = pgTable("credit_rules", {
  id: serial("id").primaryKey(),
  actionType: creditActionTypeEnum("action_type").notNull().unique(),
  pointsDelta: integer("points_delta").notNull().default(0),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCreditRuleSchema = createInsertSchema(creditRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditRule = z.infer<typeof insertCreditRuleSchema>;
export type CreditRule = typeof creditRulesTable.$inferSelect;
