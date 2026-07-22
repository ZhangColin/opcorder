import { pgTable, serial, text, varchar, boolean, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  sourceUrl: varchar("source_url", { length: 2000 }).notNull(),
  skillMd: text("skill_md").notNull().default(""),
  refFiles: jsonb("ref_files").$type<Record<string, string>>().notNull().default({}),
  version: varchar("version", { length: 200 }),
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Skill = typeof skillsTable.$inferSelect;

export const agentTaskSkillLinksTable = pgTable(
  "agent_task_skill_links",
  {
    id: serial("id").primaryKey(),
    taskType: varchar("task_type", { length: 100 }).notNull(),
    skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueTaskSkill: uniqueIndex("agent_task_skill_links_task_type_skill_id_key").on(t.taskType, t.skillId),
  })
);

export type AgentTaskSkillLink = typeof agentTaskSkillLinksTable.$inferSelect;
