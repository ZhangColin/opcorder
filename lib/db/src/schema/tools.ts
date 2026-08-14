import { pgTable, serial, integer, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// 智能体
export const toolAgentsTable = pgTable("tool_agents", {
  id:                serial("id").primaryKey(),
  ownerId:           integer("owner_id").notNull().references(() => usersTable.id),
  name:              varchar("name", { length: 200 }).notNull(),
  appType:           varchar("app_type", { length: 30 }).notNull().default("agent"),
  description:       text("description"),
  iconUrl:           varchar("icon_url", { length: 500 }),
  tags:              text("tags").array().notNull().default([]),
  category:          varchar("category", { length: 100 }),
  shareStatus:       varchar("share_status", { length: 30 }).notNull().default("private"),
  priceFenPerMonth:  integer("price_fen_per_month").notNull().default(0),
  publishedAt:       timestamp("published_at"),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});

// 知识库
export const toolKnowledgeBasesTable = pgTable("tool_knowledge_bases", {
  id:          serial("id").primaryKey(),
  ownerId:     integer("owner_id").notNull().references(() => usersTable.id),
  name:        varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  tags:        text("tags").array().notNull().default([]),
  sizeMb:      integer("size_mb").notNull().default(0),
  docCount:    integer("doc_count").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 自定义工具
export const toolCustomToolsTable = pgTable("tool_custom_tools", {
  id:        serial("id").primaryKey(),
  ownerId:   integer("owner_id").notNull().references(() => usersTable.id),
  name:      varchar("name", { length: 200 }).notNull(),
  kind:      varchar("kind", { length: 30 }).notNull().default("custom"),
  config:    jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  enabled:   boolean("enabled").notNull().default(true),
  refCount:  integer("ref_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 智能体收藏
export const toolAgentFavoritesTable = pgTable("tool_agent_favorites", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  agentId:   integer("agent_id").notNull().references(() => toolAgentsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 订阅
export const toolSubscriptionsTable = pgTable("tool_subscriptions", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull().references(() => usersTable.id),
  agentId:          integer("agent_id").notNull().references(() => toolAgentsTable.id),
  amountFen:        integer("amount_fen").notNull().default(0),
  // pending_payment | active | cancelled | expired
  status:           varchar("status", { length: 30 }).notNull().default("active"),
  businessOrderNo:  varchar("business_order_no", { length: 100 }),
  paymentOrderNo:   varchar("payment_order_no", { length: 100 }),
  paidAt:           timestamp("paid_at"),
  startsAt:         timestamp("starts_at"),
  expiresAt:        timestamp("expires_at"),
  cancelledAt:      timestamp("cancelled_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

// 订阅支付流水（不可变:每笔成功支付一行,续订/重订不覆盖历史）
export const toolSubscriptionPaymentsTable = pgTable("tool_subscription_payments", {
  id:              serial("id").primaryKey(),
  subscriptionId:  integer("subscription_id").notNull().references(() => toolSubscriptionsTable.id),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  agentId:         integer("agent_id").notNull().references(() => toolAgentsTable.id),
  amountFen:       integer("amount_fen").notNull().default(0),
  businessOrderNo: varchar("business_order_no", { length: 100 }),
  paymentOrderNo:  varchar("payment_order_no", { length: 100 }),
  paidAt:          timestamp("paid_at").notNull(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

// 收益
export const toolEarningsTable = pgTable("tool_earnings", {
  id:          serial("id").primaryKey(),
  ownerId:     integer("owner_id").notNull().references(() => usersTable.id),
  agentId:     integer("agent_id").notNull().references(() => toolAgentsTable.id),
  subscriberId: integer("subscriber_id").references(() => usersTable.id),
  amountFen:   integer("amount_fen").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 工具市场插件
export const toolPluginsTable = pgTable("tool_plugins", {
  id:           serial("id").primaryKey(),
  name:         varchar("name", { length: 200 }).notNull(),
  author:       varchar("author", { length: 200 }),
  description:  text("description"),
  installCount: integer("install_count").notNull().default(0),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

// 智能体使用会话（使用历史）:messages 为 [{role:'user'|'assistant', content, at}] 数组
export const toolAgentConversationsTable = pgTable("tool_agent_conversations", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  agentId:   integer("agent_id").notNull().references(() => toolAgentsTable.id),
  title:     varchar("title", { length: 200 }).notNull().default("新对话"),
  messages:  jsonb("messages").$type<{ role: "user" | "assistant"; content: string; at: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 插件安装记录
export const toolPluginInstallsTable = pgTable("tool_plugin_installs", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  pluginId:  integer("plugin_id").notNull().references(() => toolPluginsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ToolAgent = typeof toolAgentsTable.$inferSelect;
export type ToolKnowledgeBase = typeof toolKnowledgeBasesTable.$inferSelect;
export type ToolCustomTool = typeof toolCustomToolsTable.$inferSelect;
export type ToolAgentFavorite = typeof toolAgentFavoritesTable.$inferSelect;
export type ToolSubscription = typeof toolSubscriptionsTable.$inferSelect;
export type ToolSubscriptionPayment = typeof toolSubscriptionPaymentsTable.$inferSelect;
export type ToolEarning = typeof toolEarningsTable.$inferSelect;
export type ToolPlugin = typeof toolPluginsTable.$inferSelect;
export type ToolPluginInstall = typeof toolPluginInstallsTable.$inferSelect;
export type ToolAgentConversation = typeof toolAgentConversationsTable.$inferSelect;
