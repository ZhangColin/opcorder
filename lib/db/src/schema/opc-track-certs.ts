import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { catCategoriesTable } from "./cat-categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opcTrackCertsTable = pgTable("opc_track_certs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  catCategoryId: integer("cat_category_id").notNull().references(() => catCategoriesTable.id),
  level: varchar("level", { length: 1 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  certifiedAt: timestamp("certified_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("opc_track_certs_user_category_unique").on(table.userId, table.catCategoryId),
]);

export const insertOpcTrackCertSchema = createInsertSchema(opcTrackCertsTable).omit({ id: true, createdAt: true });
export type InsertOpcTrackCert = z.infer<typeof insertOpcTrackCertSchema>;
export type OpcTrackCert = typeof opcTrackCertsTable.$inferSelect;
