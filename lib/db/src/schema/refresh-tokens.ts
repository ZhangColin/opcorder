import { pgTable, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const refreshTokensTable = pgTable("refresh_tokens", {
  userId:    integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("refresh_tokens_token_hash_idx").on(t.tokenHash),
]);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
