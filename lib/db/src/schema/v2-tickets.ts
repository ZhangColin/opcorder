import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { v2ClientDemandsTable } from "./v2-client-demands";
import { v2OutsourceOrdersTable } from "./v2-outsource-orders";

export const v2TicketStatusEnum = pgEnum("v2_ticket_status", [
  "open",
  "closed",
]);

export const v2TicketsATable = pgTable("v2_tickets_a", {
  id: serial("id").primaryKey(),
  clientDemandId: integer("client_demand_id").notNull().references(() => v2ClientDemandsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: v2TicketStatusEnum("status").notNull().default("open"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  closedBy: integer("closed_by").references(() => usersTable.id),
  closedAt: timestamp("closed_at"),
  closedNote: text("closed_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_tickets_a_demand_idx").on(t.clientDemandId),
  index("v2_tickets_a_status_idx").on(t.status),
]);

export type V2TicketA = typeof v2TicketsATable.$inferSelect;
export type V2TicketAInsert = typeof v2TicketsATable.$inferInsert;

export const v2TicketsBTable = pgTable("v2_tickets_b", {
  id: serial("id").primaryKey(),
  outsourceOrderId: integer("outsource_order_id").notNull().references(() => v2OutsourceOrdersTable.id, { onDelete: "cascade" }),
  opcId: integer("opc_id").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: v2TicketStatusEnum("status").notNull().default("open"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  closedBy: integer("closed_by").references(() => usersTable.id),
  closedAt: timestamp("closed_at"),
  closedNote: text("closed_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("v2_tickets_b_order_idx").on(t.outsourceOrderId),
  index("v2_tickets_b_opc_idx").on(t.opcId),
  index("v2_tickets_b_status_idx").on(t.status),
]);

export type V2TicketB = typeof v2TicketsBTable.$inferSelect;
export type V2TicketBInsert = typeof v2TicketsBTable.$inferInsert;
