import { Router, type IRouter } from "express";
import { db, settlementAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): number | null {
  const authHeader = req.headers.authorization;
  const id = authHeader?.startsWith("Bearer ")
    ? parseInt(authHeader.slice(7), 10)
    : NaN;
  return isNaN(id) || id <= 0 ? null : id;
}

/* GET /api/opc/settlement-account — 获取当前 OPC 的结算账户 */
router.get("/opc/settlement-account", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "未授权，请先登录" });

  const rows = await db
    .select()
    .from(settlementAccountsTable)
    .where(eq(settlementAccountsTable.userId, userId))
    .limit(1);

  return res.json({ data: rows[0] ?? null });
});

/* PUT /api/opc/settlement-account — 创建或更新结算账户 */
router.put("/opc/settlement-account", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "未授权，请先登录" });

  const {
    companyName,
    creditCode,
    bankName,
    bankBranch,
    bankAccount,
    accountName,
    contactName,
    contactPhone,
  } = req.body as {
    companyName?: string;
    creditCode?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    accountName?: string;
    contactName?: string;
    contactPhone?: string;
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
    updatedAt: new Date(),
  };

  if (existing.length === 0) {
    const [row] = await db
      .insert(settlementAccountsTable)
      .values({ userId, ...payload, status: "pending" })
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
