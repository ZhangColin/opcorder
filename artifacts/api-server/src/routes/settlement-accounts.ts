import { Router, type IRouter } from "express";
import { db, settlementAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  const {
    companyName,
    creditCode,
    bankName,
    bankBranch,
    bankAccount,
    accountName,
    contactName,
    contactPhone,
    businessLicenseUrl,
    legalRepIdFrontUrl,
    legalRepIdBackUrl,
  } = req.body as {
    companyName?: string;
    creditCode?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    accountName?: string;
    contactName?: string;
    contactPhone?: string;
    businessLicenseUrl?: string;
    legalRepIdFrontUrl?: string;
    legalRepIdBackUrl?: string;
  };

  const existing = await db
    .select()
    .from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, userId))
    .limit(1);

  const payload = {
    companyName: companyName ?? null,
    creditCode: creditCode ?? null,
    bankName: bankName ?? null,
    bankBranch: bankBranch ?? null,
    bankAccount: bankAccount ?? null,
    accountName: accountName ?? null,
    contactName: contactName ?? null,
    contactPhone: contactPhone ?? null,
    businessLicenseUrl: businessLicenseUrl ?? null,
    legalRepIdFrontUrl: legalRepIdFrontUrl ?? null,
    legalRepIdBackUrl: legalRepIdBackUrl ?? null,
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

export default router;
