import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// 模型开发 Notebook 环境
export const computeNotebooksTable = pgTable("compute_notebooks", {
  id:                  serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => usersTable.id),
  name:               varchar("name", { length: 200 }).notNull(),
  status:             varchar("status", { length: 30 }).notNull().default("creating"),
  envType:            varchar("env_type", { length: 100 }),
  image:              varchar("image", { length: 300 }),
  resourceSpec:       varchar("resource_spec", { length: 200 }),
  sshEnabled:         boolean("ssh_enabled").notNull().default(false),
  description:        text("description"),
  startedAt:          timestamp("started_at"),
  stoppedAt:          timestamp("stopped_at"),
  lastBilledAt:       timestamp("last_billed_at"),
  totalRuntimeSeconds: integer("total_runtime_seconds").notNull().default(0),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

// 模型训练任务
export const computeTrainingJobsTable = pgTable("compute_training_jobs", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id),
  name:        varchar("name", { length: 200 }).notNull(),
  status:      varchar("status", { length: 30 }).notNull().default("pending"),
  mode:        varchar("mode", { length: 30 }).notNull().default("custom"),
  image:       varchar("image", { length: 300 }),
  resourceSpec: varchar("resource_spec", { length: 200 }),
  command:     text("command"),
  datasetPath: varchar("dataset_path", { length: 500 }),
  outputPath:  varchar("output_path", { length: 500 }),
  description: text("description"),
  startedAt:   timestamp("started_at"),
  finishedAt:  timestamp("finished_at"),
  lastBilledAt: timestamp("last_billed_at"),
  plannedDurationSeconds: integer("planned_duration_seconds"),
  totalRuntimeSeconds: integer("total_runtime_seconds").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 推理服务
export const computeInferenceServicesTable = pgTable("compute_inference_services", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  name:            varchar("name", { length: 200 }).notNull(),
  serviceType:     varchar("service_type", { length: 30 }).notNull().default("custom"),
  status:          varchar("status", { length: 30 }).notNull().default("deploying"),
  modelSource:     varchar("model_source", { length: 500 }),
  image:           varchar("image", { length: 300 }),
  resourceSpec:    varchar("resource_spec", { length: 200 }),
  replicas:        integer("replicas").notNull().default(1),
  runningReplicas: integer("running_replicas").notNull().default(0),
  endpointUrl:     varchar("endpoint_url", { length: 500 }),
  description:     text("description"),
  startedAt:       timestamp("started_at"),
  lastBilledAt:    timestamp("last_billed_at"),
  totalRuntimeSeconds: integer("total_runtime_seconds").notNull().default(0),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

// 存储管理
export const computeStoragesTable = pgTable("compute_storages", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id),
  name:        varchar("name", { length: 200 }).notNull(),
  storageType: varchar("storage_type", { length: 30 }).notNull().default("file"),
  region:      varchar("region", { length: 100 }),
  capacityGb:  integer("capacity_gb").notNull().default(0),
  usedGb:      integer("used_gb").notNull().default(0),
  status:      varchar("status", { length: 30 }).notNull().default("running"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 计算资源专属实例
export const computeResourcesTable = pgTable("compute_resources", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  name:      varchar("name", { length: 200 }).notNull(),
  gpuModel:  varchar("gpu_model", { length: 100 }),
  gpuCount:  integer("gpu_count").notNull().default(0),
  cpuCores:  integer("cpu_cores").notNull().default(0),
  memoryGb:  integer("memory_gb").notNull().default(0),
  region:    varchar("region", { length: 100 }),
  status:    varchar("status", { length: 30 }).notNull().default("running"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Token 资源包
export const computeTokenResourcesTable = pgTable("compute_token_resources", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id),
  name:        varchar("name", { length: 200 }).notNull(),
  modelName:   varchar("model_name", { length: 200 }),
  totalTokens: integer("total_tokens").notNull().default(0),
  usedTokens:  integer("used_tokens").notNull().default(0),
  status:      varchar("status", { length: 30 }).notNull().default("running"),
  expiresAt:   timestamp("expires_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// API Keys
export const computeApiKeysTable = pgTable("compute_api_keys", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => usersTable.id),
  name:       varchar("name", { length: 200 }).notNull(),
  keyPrefix:  varchar("key_prefix", { length: 50 }).notNull(),
  keyHash:    varchar("key_hash", { length: 200 }).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

// 镜像管理
export const computeImagesTable = pgTable("compute_images", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id),
  name:        varchar("name", { length: 200 }).notNull(),
  tag:         varchar("tag", { length: 100 }),
  region:      varchar("region", { length: 100 }),
  sizeMb:      integer("size_mb").notNull().default(0),
  source:      varchar("source", { length: 30 }).notNull().default("custom"),
  description: text("description"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 订单
export const computeOrdersTable = pgTable("compute_orders", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  orderNo:   varchar("order_no", { length: 50 }).notNull(),
  itemType:  varchar("item_type", { length: 50 }),
  itemName:  varchar("item_name", { length: 200 }),
  amountFen: integer("amount_fen").notNull().default(0),
  status:    varchar("status", { length: 30 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 账单流水
export const computeBillsTable = pgTable("compute_bills", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => usersTable.id),
  billNo:    varchar("bill_no", { length: 50 }).notNull(),
  itemType:  varchar("item_type", { length: 50 }),
  amountFen: integer("amount_fen").notNull().default(0),
  direction: varchar("direction", { length: 20 }).notNull().default("expense"),
  billedAt:  timestamp("billed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 仓库条目（模型/数据集/镜像仓库共用）
export const computeRepoItemsTable = pgTable("compute_repo_items", {
  id:          serial("id").primaryKey(),
  ownerId:     integer("owner_id").notNull().references(() => usersTable.id),
  repoType:    varchar("repo_type", { length: 30 }).notNull(),
  name:        varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  visibility:  varchar("visibility", { length: 20 }).notNull().default("private"),
  sizeMb:      integer("size_mb").notNull().default(0),
  downloads:   integer("downloads").notNull().default(0),
  tags:        text("tags").array().notNull().default([]),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// 我的收藏
export const computeFavoritesTable = pgTable("compute_favorites", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => usersTable.id),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId:   integer("target_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export type ComputeNotebook = typeof computeNotebooksTable.$inferSelect;
export type ComputeTrainingJob = typeof computeTrainingJobsTable.$inferSelect;
export type ComputeInferenceService = typeof computeInferenceServicesTable.$inferSelect;
export type ComputeStorage = typeof computeStoragesTable.$inferSelect;
export type ComputeResource = typeof computeResourcesTable.$inferSelect;
export type ComputeTokenResource = typeof computeTokenResourcesTable.$inferSelect;
export type ComputeApiKey = typeof computeApiKeysTable.$inferSelect;
export type ComputeImage = typeof computeImagesTable.$inferSelect;
export type ComputeOrder = typeof computeOrdersTable.$inferSelect;
export type ComputeBill = typeof computeBillsTable.$inferSelect;
export type ComputeRepoItem = typeof computeRepoItemsTable.$inferSelect;
export type ComputeFavorite = typeof computeFavoritesTable.$inferSelect;
