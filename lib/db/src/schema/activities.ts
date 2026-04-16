import { pgTable, serial, integer, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 200 }),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityFieldsTable = pgTable("activity_fields", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activitiesTable.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull(),
  fieldType: varchar("field_type", { length: 20 }).notNull().default("text"),
  isRequired: boolean("is_required").notNull().default(false),
  options: jsonb("options").$type<string[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activitiesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 200 }),
  organization: varchar("organization", { length: 200 }),
  extraData: jsonb("extra_data").$type<Record<string, string | string[]>>().default({}),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const registrationTagsTable = pgTable("registration_tags", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().references(() => registrationsTable.id, { onDelete: "cascade" }),
  tag: varchar("tag", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivityFieldSchema = createInsertSchema(activityFieldsTable).omit({ id: true });
export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({ id: true, createdAt: true, adminNote: true });
export const insertRegistrationTagSchema = createInsertSchema(registrationTagsTable).omit({ id: true, createdAt: true });

export type Activity = typeof activitiesTable.$inferSelect;
export type ActivityField = typeof activityFieldsTable.$inferSelect;
export type Registration = typeof registrationsTable.$inferSelect;
export type RegistrationTag = typeof registrationTagsTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertActivityField = z.infer<typeof insertActivityFieldSchema>;
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
