/**
 * Credit point engine — applies a credit rule to a user, writes a ledger entry,
 * and automatically promotes or demotes the user's credit level when thresholds
 * are crossed.
 *
 * Usage:
 *   await applyCredit(db, userId, "order_completed", { refId: orderId });
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

interface ApplyCreditResult {
  applied: boolean;
  delta: number;
  balanceAfter: number;
  levelChanged: boolean;
  oldLevelName: string | null;
  newLevelName: string | null;
  newLevelId: number | null;
}

/**
 * Apply a credit rule to a user and handle level changes.
 * If the action has no active rule, this is a no-op (returns applied:false).
 */
export async function applyCredit(
  userId: number,
  actionType: CreditActionType,
  options: ApplyCreditOptions = {},
  _db: AnyDb = defaultDb
): Promise<ApplyCreditResult> {
  const noOp: ApplyCreditResult = {
    applied: false,
    delta: 0,
    balanceAfter: 0,
    levelChanged: false,
    oldLevelName: null,
    newLevelName: null,
    newLevelId: null,
  };

  try {
    // 1. Look up the active rule (or use forceDelta for manual)
    let delta = options.forceDelta ?? 0;

    if (options.forceDelta === undefined) {
      const ruleRows = (await _db.execute(sql`
        SELECT points_delta FROM credit_rules
        WHERE action_type = ${actionType} AND is_active = true
        LIMIT 1
      `)).rows as Array<{ points_delta: number }>;

      if (ruleRows.length === 0) return noOp;
      delta = Number(ruleRows[0].points_delta);
    }

    if (delta === 0 && actionType !== "manual_adjustment") return noOp;

    // 2. Fetch current OPC profile (creditPoints + creditLevelId)
    const profileRows = (await _db.execute(sql`
      SELECT credit_points, credit_level_id FROM opc_profiles WHERE user_id = ${userId} LIMIT 1
    `)).rows as Array<{ credit_points: number; credit_level_id: number | null }>;

    if (profileRows.length === 0) return noOp;

    const currentPoints = Number(profileRows[0].credit_points ?? 0);
    const currentLevelId = profileRows[0].credit_level_id as number | null;
    const newPoints = Math.max(0, currentPoints + delta);

    // 3. Write transaction ledger entry
    await _db.execute(sql`
      INSERT INTO credit_transactions
        (user_id, delta, balance_after, action_type, ref_id, note, operator_id)
      VALUES
        (${userId}, ${delta}, ${newPoints}, ${actionType},
         ${options.refId ?? null}, ${options.note ?? null}, ${options.operatorId ?? null})
    `);

    // 4. Update user's credit_points
    await _db.execute(sql`
      UPDATE opc_profiles SET credit_points = ${newPoints} WHERE user_id = ${userId}
    `);

    // 5. Determine the best matching credit level
    const levelRows = (await _db.execute(sql`
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

    // Find old level name for notification
    let oldLevelName: string | null = null;
    if (currentLevelId !== null) {
      const oldLvl = levelRows.find(l => l.id === currentLevelId);
      oldLevelName = oldLvl?.name ?? null;
    }

    const levelChanged = newLevelId !== currentLevelId;

    if (levelChanged) {
      await _db.execute(sql`
        UPDATE opc_profiles SET credit_level_id = ${newLevelId} WHERE user_id = ${userId}
      `);

      // Send in-app notification
      const isUpgrade = (newLevelId !== null && currentLevelId === null) ||
        (newLevelId !== null && currentLevelId !== null && (() => {
          const oldIdx = levelRows.findIndex(l => l.id === currentLevelId);
          const newIdx = levelRows.findIndex(l => l.id === newLevelId);
          return newIdx < oldIdx; // levelRows sorted desc, so lower index = higher level
        })());

      const title = isUpgrade
        ? `恭喜！您已升级为「${newLevelName ?? ""}」信用等级`
        : `信用等级变更：您的等级调整为「${newLevelName ?? "未评级"}」`;
      const content = isUpgrade
        ? `当前积分 ${newPoints} 分，您已达到${newLevelName ?? ""}等级要求，继续保持良好服务品质！`
        : `当前积分 ${newPoints} 分，您的信用等级已调整为「${newLevelName ?? "未评级"}」，请注意维护信用记录。`;

      await _db.execute(sql`
        INSERT INTO notifications (user_id, type, title, content, related_type)
        VALUES (${userId}, 'system', ${title}, ${content}, 'credit')
      `);

      logger.info({ userId, actionType, delta, newPoints, oldLevelName, newLevelName }, "credit: level changed");
    }

    logger.info({ userId, actionType, delta, newPoints, levelChanged }, "credit: applied");

    return {
      applied: true,
      delta,
      balanceAfter: newPoints,
      levelChanged,
      oldLevelName,
      newLevelName,
      newLevelId,
    };
  } catch (err) {
    logger.error({ err, userId, actionType }, "credit: failed to apply credit");
    return noOp;
  }
}
