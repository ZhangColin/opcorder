import { pgTable, serial, integer, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { demandsTable } from "./demands";

export const llmProvidersTable = pgTable("llm_providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  apiKey: text("api_key").notNull(),
  defaultModel: varchar("default_model", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
  remark: text("remark"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LlmProvider = typeof llmProvidersTable.$inferSelect;

export const agentConfigsTable = pgTable("agent_configs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  sceneKey: varchar("scene_key", { length: 50 }).notNull().unique(),
  systemPrompt: text("system_prompt").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  model: varchar("model", { length: 100 }).notNull().default("deepseek-chat"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentConfig = typeof agentConfigsTable.$inferSelect;

export const agentConfigPromptVersionsTable = pgTable("agent_config_prompt_versions", {
  id: serial("id").primaryKey(),
  agentConfigId: integer("agent_config_id").notNull().references(() => agentConfigsTable.id, { onDelete: "cascade" }),
  systemPrompt: text("system_prompt").notNull(),
  remark: varchar("remark", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentConfigPromptVersion = typeof agentConfigPromptVersionsTable.$inferSelect;

export const agentConversationsTable = pgTable("agent_conversations", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").references(() => demandsTable.id, { onDelete: "set null" }),
  sessionKey: varchar("session_key", { length: 100 }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  linkedClientDemandId: integer("linked_client_demand_id"),
  messages: jsonb("messages").$type<Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    toolCallId?: string;
    toolName?: string;
    toolCalls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    timestamp: string;
  }>>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AgentConversation = typeof agentConversationsTable.$inferSelect;
