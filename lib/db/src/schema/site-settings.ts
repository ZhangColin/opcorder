import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const siteSettingsTable = pgTable("site_settings", {
  id:        serial("id").primaryKey(),
  key:       varchar("key", { length: 100 }).notNull().unique(),
  value:     text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SiteSetting = typeof siteSettingsTable.$inferSelect;
