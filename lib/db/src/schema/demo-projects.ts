import { pgTable, serial, integer, text, varchar, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const demoProjectsTable = pgTable(
  "demo_projects",
  {
    id: serial("id").primaryKey(),
    demandId: integer("demand_id").notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("generating"),
    version: integer("version").notNull().default(1),
    files: jsonb("files").$type<Record<string, string>>(),
    entryFile: varchar("entry_file", { length: 200 }).notNull().default("src/App.tsx"),
    dependencies: jsonb("dependencies").$type<Record<string, string>>().notNull().default({}),
    skillSnapshot: text("skill_snapshot"),
    revisionLog: jsonb("revision_log").$type<Array<{ version: number; feedback: string; valid: boolean; timestamp: string }>>().notNull().default([]),
    errorMsg: text("error_msg"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export type DemoProject = typeof demoProjectsTable.$inferSelect;

export const demoProjectVersionsTable = pgTable("demo_project_versions", {
  id: serial("id").primaryKey(),
  demoProjectId: integer("demo_project_id").notNull().references(() => demoProjectsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  files: jsonb("files").$type<Record<string, string>>().notNull().default({}),
  dependencies: jsonb("dependencies").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DemoProjectVersion = typeof demoProjectVersionsTable.$inferSelect;
