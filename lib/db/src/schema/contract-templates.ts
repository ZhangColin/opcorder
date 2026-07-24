import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, boolean, jsonb, index,
} from "drizzle-orm/pg-core";

export const contractTemplateChannelEnum = pgEnum("contract_template_channel", ["a", "b"]);
export const contractTemplateSignTypeEnum = pgEnum("contract_template_sign_type", ["company", "personal", "both"]);

export const contractTemplatesTable = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  demandType: varchar("demand_type", { length: 50 }),
  channel: contractTemplateChannelEnum("channel").notNull(),
  signType: contractTemplateSignTypeEnum("sign_type").notNull().default("company"),
  isStandard: boolean("is_standard").notNull().default(true),
  originalFileUrl: text("original_file_url"),
  originalFileName: varchar("original_file_name", { length: 300 }),
  markdownContent: text("markdown_content"),
  esignTemplateId: varchar("esign_template_id", { length: 100 }),
  variableMapping: jsonb("variable_mapping").$type<Record<string, string>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("contract_templates_demand_type_idx").on(t.demandType),
  index("contract_templates_channel_idx").on(t.channel),
]);

export type ContractTemplate = typeof contractTemplatesTable.$inferSelect;
export type ContractTemplateInsert = typeof contractTemplatesTable.$inferInsert;
