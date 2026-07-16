import { Router, type IRouter } from "express";
import { db, settlementAccountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

/* GET /api/opc/settlement-account — 获取当前 OPC 的结算账户 */
router.get("/opc/settlement-account", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const rows = await db
    .select()
    .from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, userId))
    .limit(1);

  return res.json({ data: rows[0] ?? null });
});

/* PUT /api/opc/settlement-account — 创建或更新结算账户 */
router.put("/opc/settlement-account", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  req.log.info({ body: req.body }, "[settlement-account PUT] received body");

  const {
    companyName,
    creditCode,
    contactPerson,
    contactPhone,
    contactAddress,
    bankName,
    bankBranch,
    bankAccount,
    accountName,
    businessLicenseUrl,
    legalRepIdFrontUrl,
    legalRepIdBackUrl,
    ccbMerchantNo,
  } = req.body as {
    companyName?: string;
    creditCode?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactAddress?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    accountName?: string;
    businessLicenseUrl?: string;
    legalRepIdFrontUrl?: string;
    legalRepIdBackUrl?: string;
    ccbMerchantNo?: string;
  };

  const existing = await db
    .select()
    .from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, userId))
    .limit(1);

  const payload = {
    companyName: companyName ?? null,
    creditCode: creditCode ?? null,
    contactPerson: contactPerson ?? null,
    contactPhone: contactPhone ?? null,
    contactAddress: contactAddress ?? null,
    bankName: bankName ?? null,
    bankBranch: bankBranch ?? null,
    bankAccount: bankAccount ?? null,
    accountName: accountName ?? null,
    businessLicenseUrl: businessLicenseUrl ?? null,
    legalRepIdFrontUrl: legalRepIdFrontUrl ?? null,
    legalRepIdBackUrl: legalRepIdBackUrl ?? null,
    ccbMerchantNo: ccbMerchantNo ?? null,
    status: "pending" as const,
    rejectReason: null,
    updatedAt: new Date(),
  };

  if (existing.length === 0) {
    const [row] = await db
      .insert(settlementAccountsTable)
      .values({ userId, ...payload })
      .returning();
    return res.json({ data: row });
  } else {
    const [row] = await db
      .update(settlementAccountsTable)
      .set(payload)
      .where(eq(settlementAccountsTable.userId, userId))
      .returning();
    return res.json({ data: row });
  }
});

/* GET /api/opc/sub-orders — 获取当前 OPC 所有订单的子订单（含分账状态） */
router.get("/opc/sub-orders", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const rows = await db.execute(sql`
    SELECT s.id, s.order_no, s.sub_order_no, s.party_name, s.merchant_no,
           s.amount, s.role, s.sub_role,
           s.releasable_at, s.settled_at, s.created_at
    FROM sub_orders s
    INNER JOIN orders o ON s.order_no = o.order_no
    WHERE o.opc_id = ${userId}
    ORDER BY s.id
  `);
  return res.json(rows.rows);
});

export default router;
