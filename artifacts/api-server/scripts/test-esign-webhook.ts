/**
 * e签宝 webhook end-to-end smoke test
 * ────────────────────────────────────
 * Run from the repo root:
 *
 *   pnpm tsx artifacts/api-server/scripts/test-esign-webhook.ts
 *
 * What it does:
 *  1. Inserts a synthetic v2_contracts row (channel a, status esign_pending).
 *  2. Builds a valid HMAC-SHA256 signed callback payload (identical to what
 *     e签宝 would send).
 *  3. POSTs it to POST /api/webhooks/esign.
 *  4. Queries the DB to confirm the row is now status = "signed".
 *  5. Removes the synthetic row.
 *
 * Exit code 0 = all assertions passed.
 * Exit code 1 = at least one assertion failed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MANUAL CURL EQUIVALENT
 * ────────────────────────────────────────────────────────────────────────────
 * To send a single signed callback by hand (replace APP_SECRET and FLOW_ID):
 *
 *   APP_SECRET="your_app_secret"
 *   FLOW_ID="your_real_esign_flow_id"
 *   TS=$(date +%s%3N)           # millisecond timestamp
 *   BODY='{"eventType":"SIGN_FLOW_FINISH","flowId":"'"$FLOW_ID"'"}'
 *   SIG=$(printf '%s' "${TS}${BODY}" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $2}')
 *
 *   curl -s -X POST https://<your-domain>/api/webhooks/esign \
 *     -H "Content-Type: application/json" \
 *     -H "X-Tsign-Open-TIMESTAMP: $TS" \
 *     -H "X-Tsign-Open-SIGNATURE: $SIG" \
 *     -H "X-Tsign-Open-SIGNATURE-ALGORITHM: hmac-sha256" \
 *     -d "$BODY"
 *
 * Expected response: {"message":"ok"}
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Signature construction (per open.esign.cn/doc/opendoc/notify3/pmy852):
 *   data   = timestamp + sortedQueryValues + rawBody
 *   result = HMAC-SHA256(data, APP_SECRET).hexdigest()
 */

import crypto from "crypto";
import { db, v2ContractsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const APP_SECRET = process.env["ESIGN_APP_SECRET"] ?? "";
const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}`;

const TEST_FLOW_ID = `test-e2e-${Date.now()}`;
const TEST_CONTRACT_NO = `TEST-${Date.now()}`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅  ${message}`);
    passed++;
  } else {
    console.error(`  ❌  ${message}`);
    failed++;
  }
}

function buildSignature(timestamp: string, body: string, queryValues = ""): string {
  const data = timestamp + queryValues + body;
  return crypto.createHmac("sha256", APP_SECRET).update(data, "utf8").digest("hex");
}

async function postWebhook(
  label: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; json: unknown }> {
  console.log(`\n── ${label}`);
  const res = await fetch(`${BASE}/api/webhooks/esign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const json = await res.json().catch(() => ({}));
  const icon = res.status === 200 ? "✅" : "⚠";
  console.log(`  ${icon}  HTTP ${res.status}  ${JSON.stringify(json).slice(0, 120)}`);
  return { status: res.status, json };
}

async function seedTestContract(): Promise<number> {
  const [row] = await db
    .insert(v2ContractsTable)
    .values({
      contractNo: TEST_CONTRACT_NO,
      channel: "a",
      status: "esign_pending",
      esignFlowId: TEST_FLOW_ID,
    })
    .returning({ id: v2ContractsTable.id });
  return row.id;
}

async function cleanupTestContract(id: number): Promise<void> {
  await db.delete(v2ContractsTable).where(eq(v2ContractsTable.id, id));
}

(async () => {
  console.log("e签宝 webhook end-to-end smoke test");
  console.log("=====================================");

  if (!APP_SECRET) {
    console.warn("⚠  ESIGN_APP_SECRET not set — signature verification is bypassed in dev.");
    console.warn("   Set ESIGN_APP_SECRET to run the full signature-validation path.\n");
  }

  let contractId: number | null = null;

  try {
    // ── 1. Seed a synthetic contract ──────────────────────────────────────
    console.log(`\n── Seeding test contract (flowId: ${TEST_FLOW_ID})`);
    contractId = await seedTestContract();
    console.log(`  ✅  Inserted v2_contracts id=${contractId}, status=esign_pending`);

    // ── 2. Happy-path: valid signature + SIGN_FLOW_FINISH ─────────────────
    const timestamp = String(Date.now());
    const body = JSON.stringify({ eventType: "SIGN_FLOW_FINISH", flowId: TEST_FLOW_ID });
    const sig = buildSignature(timestamp, body);

    const { status } = await postWebhook(
      "Valid signature + SIGN_FLOW_FINISH → expect HTTP 200",
      {
        "X-Tsign-Open-TIMESTAMP": timestamp,
        "X-Tsign-Open-SIGNATURE": sig,
        "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
      },
      body,
    );
    assert(status === 200, `HTTP 200 received (got ${status})`);

    // ── 3. DB assertion: contract.status === "signed" ─────────────────────
    console.log(`\n── DB assertion: contract id=${contractId}`);
    const [updated] = await db
      .select({ status: v2ContractsTable.status, signedAt: v2ContractsTable.signedAt })
      .from(v2ContractsTable)
      .where(eq(v2ContractsTable.id, contractId))
      .limit(1);

    assert(updated?.status === "signed", `contract.status = "signed" (got "${updated?.status}")`);
    assert(updated?.signedAt !== null, "contract.signedAt is set");

    // ── 4. Idempotency: sending the same callback again must not error ─────
    const ts2 = String(Date.now());
    const sig2 = buildSignature(ts2, body);
    const { status: status2 } = await postWebhook(
      "Duplicate callback (already signed) → expect HTTP 200 idempotent",
      {
        "X-Tsign-Open-TIMESTAMP": ts2,
        "X-Tsign-Open-SIGNATURE": sig2,
        "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
      },
      body,
    );
    assert(status2 === 200, `Idempotent HTTP 200 received (got ${status2})`);

    // ── 5. Invalid signature → must reject in prod, pass in dev ───────────
    const ts3 = String(Date.now());
    const badBody = JSON.stringify({ eventType: "SIGN_FLOW_FINISH", flowId: TEST_FLOW_ID });
    const { status: status3 } = await postWebhook(
      "Bad signature → expect 401 (prod) or 200 (dev bypass)",
      {
        "X-Tsign-Open-TIMESTAMP": ts3,
        "X-Tsign-Open-SIGNATURE": "000000deadbeef",
        "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
      },
      badBody,
    );
    if (APP_SECRET) {
      assert(status3 === 401, `Bad signature rejected with 401 (got ${status3})`);
    } else {
      assert(status3 === 200, `Dev bypass: bad signature allowed with 200 (got ${status3})`);
    }

    // ── 6. Stale timestamp → replay-attack guard ───────────────────────────
    if (APP_SECRET) {
      const staleTs = String(Date.now() - 11 * 60 * 1000);
      const staleBody = JSON.stringify({ eventType: "SIGN_FLOW_FINISH", flowId: TEST_FLOW_ID });
      const staleSig = buildSignature(staleTs, staleBody);
      const { status: status4 } = await postWebhook(
        "Stale timestamp (11 min ago) → expect 401 replay-attack guard",
        {
          "X-Tsign-Open-TIMESTAMP": staleTs,
          "X-Tsign-Open-SIGNATURE": staleSig,
          "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
        },
        staleBody,
      );
      assert(status4 === 401, `Stale timestamp rejected with 401 (got ${status4})`);
    } else {
      console.log("\n  ℹ  Skipping stale-timestamp test (no APP_SECRET — dev bypass is on).");
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    if (contractId !== null) {
      await cleanupTestContract(contractId).catch(() => {});
      console.log(`\n── Cleaned up test contract id=${contractId}`);
    }
    await db.$client.end().catch(() => {});
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=====================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("❌ Some assertions failed. Check logs above.");
    process.exit(1);
  } else {
    console.log("✅ All assertions passed.");
    process.exit(0);
  }
})();
