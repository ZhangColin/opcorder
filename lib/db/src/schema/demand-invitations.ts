import { pgTable, serial, integer, varchar, timestamp, unique, index } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandInvitationsTable = pgTable("demand_invitations", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id, { onDelete: "cascade" }),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  trackLevel: varchar("track_level", { length: 1 }).notNull(),
  source: varchar("source", { length: 20 }).notNull().default("auto"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  emailedAt: timestamp("emailed_at"),
}, (t) => [
  unique("demand_invitations_demand_opc_uniq").on(t.demandId, t.opcId),
  index("demand_invitations_demand_idx").on(t.demandId),
  index("demand_invitations_opc_idx").on(t.opcId),
]);

export const insertDemandInvitationSchema = createInsertSchema(demandInvitationsTable).omit({ id: true, invitedAt: true });
export type InsertDemandInvitation = z.infer<typeof insertDemandInvitationSchema>;
export type DemandInvitation = typeof demandInvitationsTable.$inferSelect;
