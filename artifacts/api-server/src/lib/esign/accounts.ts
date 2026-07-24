/**
 * ensureEsignAccount(userId) — silently registers or retrieves the e签宝 signer identity
 * for a user. Checks DB first; if missing, reads user's enterprise or personal info and
 * registers with e签宝, then stores the resulting IDs back on the users row.
 */
import { db, usersTable, publisherProfilesTable, opcProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { registerOrgAccount, registerPersonalAccount } from "./index";

export interface EsignIdentity {
  accountId: string | null;
  orgId: string | null;
}

export async function ensureEsignAccount(userId: number): Promise<EsignIdentity> {
  const [user] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      name: usersTable.nickname,
      phone: usersTable.phone,
      esignAccountId: usersTable.esignAccountId,
      esignOrgId: usersTable.esignOrgId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) throw new Error(`用户 ${userId} 不存在`);

  if (user.esignAccountId || user.esignOrgId) {
    return { accountId: user.esignAccountId ?? null, orgId: user.esignOrgId ?? null };
  }

  if (user.role === "publisher") {
    const [profile] = await db
      .select({ creditCode: publisherProfilesTable.creditCode, contactPerson: publisherProfilesTable.contactPerson })
      .from(publisherProfilesTable)
      .where(eq(publisherProfilesTable.userId, userId))
      .limit(1);

    if (profile?.creditCode) {
      try {
        const orgId = await registerOrgAccount({
          thirdPartyOrgId: `pub_${userId}`,
          orgName: profile.contactPerson ?? `发单方_${userId}`,
          creditCode: profile.creditCode,
        });
        await db.update(usersTable).set({ esignOrgId: orgId }).where(eq(usersTable.id, userId));
        logger.info({ userId, orgId }, "e签宝 org account registered for publisher");
        return { accountId: null, orgId };
      } catch (err) {
        logger.warn({ err, userId }, "e签宝 org registration failed (non-blocking)");
        return { accountId: null, orgId: null };
      }
    }
    return { accountId: null, orgId: null };
  }

  if (user.role === "opc") {
    if (user.name && user.phone) {
      try {
        const accountId = await registerPersonalAccount({
          thirdPartyUserId: `opc_${userId}`,
          name: user.name,
          idNumber: "",
          mobile: user.phone,
        });
        await db.update(usersTable).set({ esignAccountId: accountId }).where(eq(usersTable.id, userId));
        logger.info({ userId, accountId }, "e签宝 personal account registered for opc");
        return { accountId, orgId: null };
      } catch (err) {
        logger.warn({ err, userId }, "e签宝 personal registration failed (non-blocking)");
        return { accountId: null, orgId: null };
      }
    }
    return { accountId: null, orgId: null };
  }

  return { accountId: null, orgId: null };
}

/**
 * Call this when a publisher updates their enterprise certification info (creditCode).
 * Clears cached e签宝 IDs so the next signing attempt re-registers with fresh data.
 */
export async function clearEsignIds(userId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ esignAccountId: null, esignOrgId: null })
    .where(eq(usersTable.id, userId));
  logger.info({ userId }, "Cleared e签宝 IDs due to enterprise cert update");
}
