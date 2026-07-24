/**
 * ensureEsignAccount(userId) — silently registers or retrieves the e签宝 signer identity
 * for a user. Checks DB first; if missing, reads user's enterprise or personal info and
 * registers with e签宝, then stores the resulting IDs back on the users row.
 *
 * For OPC personal accounts: registration requires a verified real-name ID number
 * (身份证). If the user does not have one stored, registration is deferred and the
 * function returns null IDs with a reason rather than silently failing.
 */
import { db, usersTable, publisherProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { registerOrgAccount, registerPersonalAccount } from "./index";

export interface EsignIdentity {
  accountId: string | null;
  orgId: string | null;
  /** Reason registration was skipped (non-fatal); present when IDs are null */
  pendingReason?: string;
}

export async function ensureEsignAccount(userId: number, idNumber?: string): Promise<EsignIdentity> {
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

  // Already registered — return cached IDs
  if (user.esignAccountId || user.esignOrgId) {
    return { accountId: user.esignAccountId ?? null, orgId: user.esignOrgId ?? null };
  }

  /* ── Publisher (enterprise) ────────────── */
  if (user.role === "publisher") {
    const [profile] = await db
      .select({ creditCode: publisherProfilesTable.creditCode, contactPerson: publisherProfilesTable.contactPerson })
      .from(publisherProfilesTable)
      .where(eq(publisherProfilesTable.userId, userId))
      .limit(1);

    if (!profile?.creditCode) {
      return { accountId: null, orgId: null, pendingReason: "企业统一社会信用代码未填写，无法注册签署账号" };
    }

    try {
      const orgId = await registerOrgAccount({
        thirdPartyOrgId: `pub_${userId}`,
        orgName: profile.contactPerson ?? `发单方_${userId}`,
        creditCode: profile.creditCode,
      });
      await db.update(usersTable).set({ esignOrgId: orgId }).where(eq(usersTable.id, userId));
      logger.info({ userId, orgId }, "e签宝 org account registered for publisher");
      return { accountId: null, orgId };
    } catch (err: any) {
      logger.warn({ err, userId }, "e签宝 org registration failed (non-blocking)");
      return { accountId: null, orgId: null, pendingReason: `e签宝企业注册失败：${err?.message ?? "未知错误"}` };
    }
  }

  /* ── OPC (personal) ────────────── */
  if (user.role === "opc") {
    if (!user.name || !user.phone) {
      return { accountId: null, orgId: null, pendingReason: "OPC 姓名或手机号未填写，无法注册签署账号" };
    }

    // Personal e签宝 registration requires a government-issued ID number (身份证).
    // If the caller did not supply one, we defer registration rather than submitting
    // an empty idNumber which e签宝 will reject.
    if (!idNumber) {
      return {
        accountId: null, orgId: null,
        pendingReason: "OPC 实名注册需要身份证号码，请在发起签署时提供",
      };
    }

    try {
      const accountId = await registerPersonalAccount({
        thirdPartyUserId: `opc_${userId}`,
        name: user.name,
        idNumber,
        mobile: user.phone,
      });
      await db.update(usersTable).set({ esignAccountId: accountId }).where(eq(usersTable.id, userId));
      logger.info({ userId, accountId }, "e签宝 personal account registered for opc");
      return { accountId, orgId: null };
    } catch (err: any) {
      logger.warn({ err, userId }, "e签宝 personal registration failed (non-blocking)");
      return { accountId: null, orgId: null, pendingReason: `e签宝个人注册失败：${err?.message ?? "未知错误"}` };
    }
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
