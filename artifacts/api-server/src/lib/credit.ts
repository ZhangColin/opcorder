/**
 * Credit point engine — applies a credit rule to a user, writes a ledger entry,
 * and automatically promotes or demotes the user's credit level when thresholds
 * are crossed.
 *
 * Design notes:
 * - All writes happen inside a single DB transaction with a row-level lock
 *   (SELECT … FOR UPDATE) so concurrent calls serialize and never race.
 * - The function throws on any DB error; callers that want fire-and-forget
 *   behavior must attach their own .catch().
 * - Action types (order_completed, five_star_review, …) are intentionally
 *   fixed at the code level because each maps to specific business logic.
 *   Only points_delta / description / is_active are configurable via admin UI.
 *
 * Usage:
 *   // blocking (admin / manual):
 *   const result = await applyCredit(userId, "order_completed", { refId: orderId });
 *
 *   // fire-and-forget (order event side-effect):
 *   applyCredit(userId, "order_completed", { refId }).catch(() => {});
 */
import { db as defaultDb } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

type AnyDb = typeof defaultDb;

export type CreditActionType =
  | "order_completed"
  | "five_star_review"
  | "bad_review"
  | "order_disputed"
  | "manual_adjustment";

interface ApplyCreditOptions {
  refId?: number;
  note?: string;
  operatorId?: number;
  /** Fixed delta to apply, overrides the rule value. Used by manual adjustments. */
  forceDelta?: number;
}

export interface ApplyCreditResult {
  applied: boolean;
  delta: number;
  balanceAfter: number;
  levelChanged: boolean;
  oldLevelName: string | null;
  newLevelName: string | null;
  newLevelId: number | null;
}

const noOp: ApplyCreditResult = {
  applied: false,
  delta: 0,
  balanceAfter: 0,
  levelChanged: false,
  oldLevelName: null,
  newLevelName: null,
  newLevelId: null,
};

/**
 * Apply a credit rule to a user and handle level changes atomically.
 *
 * Throws on DB error — wrap in .catch() for fire-and-forget callers.
 * Returns noOp (applied:false) only when the rule is disabled or delta=0.
 */
export async function applyCredit(
  userId: number,
  actionType: CreditActionType,
  options: ApplyCreditOptions = {},
  _db: AnyDb = defaultDb
): Promise<ApplyCreditResult> {
  // Step 1: resolve delta from rule table (read-only, outside transaction).
  // This is a point-in-time read of admin config — no user data involved yet.
  let delta = options.forceDelta;

  if (delta === undefined) {
    const ruleRows = (await _db.execute(sql`
      SELECT points_delta FROM credit_rules
      WHERE action_type = ${actionType} AND is_active = true
      LIMIT 1
    `)).rows as Array<{ points_delta: number }>;

    if (ruleRows.length === 0) return noOp;
    delta = Number(ruleRows[0].points_delta);
  }

  // Skip zero-delta events unless it's an explicit manual_adjustment
  if (delta === 0 && actionType !== "manual_adjustment") return noOp;

  const resolvedDelta = delta;

  // Step 2: everything that touches user state runs inside a transaction
  // with a row-level lock so concurrent events serialize correctly.
  return await _db.transaction(async (tx) => {
    // Lock the OPC profile row for the duration of this transaction
    const profileRows = (await tx.execute(sql`
      SELECT credit_points, credit_level_id
      FROM opc_profiles
      WHERE user_id = ${userId}
      FOR UPDATE
    `)).rows as Array<{ credit_points: number; credit_level_id: number | null }>;

    if (profileRows.length === 0) return noOp;

    const currentPoints = Number(profileRows[0].credit_points ?? 0);
    const currentLevelId = profileRows[0].credit_level_id as number | null;
    const newPoints = Math.max(0, currentPoints + resolvedDelta);

    // Write ledger entry
    await tx.execute(sql`
      INSERT INTO credit_transactions
        (user_id, delta, balance_after, action_type, ref_id, note, operator_id)
      VALUES
        (${userId}, ${resolvedDelta}, ${newPoints}, ${actionType},
         ${options.refId ?? null}, ${options.note ?? null}, ${options.operatorId ?? null})
    `);

    // Update balance
    await tx.execute(sql`
      UPDATE opc_profiles SET credit_points = ${newPoints} WHERE user_id = ${userId}
    `);

    // Determine which credit level applies to the new balance
    const levelRows = (await tx.execute(sql`
      SELECT id, name, min_points FROM credit_levels
      WHERE is_active = true
      ORDER BY min_points DESC
    `)).rows as Array<{ id: number; name: string; min_points: number }>;

    let newLevelId: number | null = null;
    let newLevelName: string | null = null;
    for (const lvl of levelRows) {
      if (newPoints >= Number(lvl.min_points)) {
        newLevelId = lvl.id;
        newLevelName = lvl.name;
        break;
      }
    }

    const oldLevelName = currentLevelId !== null
      ? (levelRows.find(l => l.id === currentLevelId)?.name ?? null)
      : null;

    const levelChanged = newLevelId !== currentLevelId;

    if (levelChanged) {
      await tx.execute(sql`
        UPDATE opc_profiles SET credit_level_id = ${newLevelId} WHERE user_id = ${userId}
      `);

      // Determine upgrade vs downgrade direction (levelRows sorted desc, lower index = higher level)
      const oldIdx = currentLevelId !== null ? levelRows.findIndex(l => l.id === currentLevelId) : Infinity;
      const newIdx = newLevelId !== null ? levelRows.findIndex(l => l.id === newLevelId) : Infinity;
      const isUpgrade = newIdx < oldIdx;

      const title = isUpgrade
        ? `恭喜！您已升级为「${newLevelName ?? ""}」信用等级`
        : `信用等级变更：您的等级调整为「${newLevelName ?? "未评级"}」`;
      const content = isUpgrade
        ? `当前积分 ${newPoints} 分，您已达到${newLevelName ?? ""}等级要求，继续保持良好服务品质！`
        : `当前积分 ${newPoints} 分，您的信用等级已调整为「${newLevelName ?? "未评级"}」，请注意维护信用记录。`;

      await tx.execute(sql`
        INSERT INTO notifications (user_id, type, title, content, related_type)
        VALUES (${userId}, 'system', ${title}, ${content}, 'credit')
      `);

      logger.info(
        { userId, actionType, resolvedDelta, newPoints, oldLevelName, newLevelName },
        "credit: level changed"
      );
    }

    logger.info({ userId, actionType, resolvedDelta, newPoints, levelChanged }, "credit: applied");

    return {
      applied: true,
      delta: resolvedDelta,
      balanceAfter: newPoints,
      levelChanged,
      oldLevelName,
      newLevelName,
      newLevelId,
    };
  });
}
