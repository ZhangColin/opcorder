/**
 * e签宝账号辅助函数
 *
 * V3 API 不再需要预注册：签署方信息直接嵌入流程创建请求中。
 * 本文件仅保留 clearEsignIds（在发单方更新企业资质后清除旧缓存ID）。
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

/**
 * 清除用户缓存的 e签宝 ID（V1 遗留字段）。
 * 保留此函数以兼容 users.ts 中的调用。
 */
export async function clearEsignIds(userId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ esignAccountId: null, esignOrgId: null })
    .where(eq(usersTable.id, userId));
  logger.info({ userId }, "Cleared e签宝 IDs (V1 legacy)");
}
