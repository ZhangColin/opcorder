import { db, notificationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

type V2NotifType =
  | "v2_demand_submitted" | "v2_demand_detail_updated" | "v2_quote_initiated"
  | "v2_quote_confirmed" | "v2_quote_commented" | "v2_contract_finalized"
  | "v2_contract_confirmed" | "v2_contract_rejected" | "v2_contract_signed"
  | "v2_payment_voucher_uploaded" | "v2_payment_approved" | "v2_delivery_a_created"
  | "v2_delivery_a_confirmed" | "v2_delivery_a_rejected" | "v2_warranty_started"
  | "v2_demand_verified" | "v2_ticket_a_created" | "v2_ticket_a_closed"
  | "v2_outsource_detail_updated" | "v2_tender_won" | "v2_tender_lost"
  | "v2_tender_cancelled" | "v2_delivery_b_submitted" | "v2_delivery_b_approved"
  | "v2_delivery_b_rejected" | "v2_settlement_paid" | "v2_ticket_b_created"
  | "v2_ticket_b_closed" | "v2_discussion_replied" | "v2_payment_online_paid"
  | "v2_contract_esign_pending";

export async function notify(
  userId: number,
  type: V2NotifType,
  title: string,
  content: string,
  relatedId?: number,
  relatedType?: string,
) {
  try {
    await db.insert(notificationsTable).values({
      userId,
      type,
      title,
      content,
      relatedId,
      relatedType,
    });
  } catch (err) {
    logger.warn({ err, userId, type }, "v2 notify insert failed");
  }
}

async function seqNo(tableName: string, noCol: string, prefix: string): Promise<string> {
  const now = new Date();
  const ymd =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;
  const pat = `${prefix}-${ymd}-%`;
  const result = await db.execute(
    sql.raw(`SELECT ${noCol} FROM ${tableName} WHERE ${noCol} LIKE '${pat}' ORDER BY ${noCol} DESC LIMIT 1`)
  );
  const rows = result.rows as Record<string, string>[];
  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0][noCol] ?? "";
    const parts = last.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}-${ymd}-${String(seq).padStart(4, "0")}`;
}

export async function genClientDemandNo() {
  return seqNo("v2_client_demands", "demand_no", "V2A");
}
export async function genOutsourceDemandNo() {
  return seqNo("v2_outsource_demands", "demand_no", "V2B");
}
export async function genOutsourceOrderNo() {
  return seqNo("v2_outsource_orders", "order_no", "V2O");
}
export async function genContractNo(channel: "a" | "b") {
  const prefix = channel === "a" ? "V2CA" : "V2CB";
  return seqNo("v2_contracts", "contract_no", prefix);
}
