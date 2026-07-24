/**
 * Sandbox simulation: generate a valid e签宝-style webhook callback and POST it
 * to the local API server.  Run with:
 *
 *   pnpm tsx artifacts/api-server/scripts/test-esign-webhook.ts
 *
 * Expected result: HTTP 200 {"message":"ok (no flowId)"}  (or similar)
 * A 401 means the signature algorithm or headers are still wrong.
 *
 * Signature construction (per open.esign.cn/doc/opendoc/notify3/pmy852):
 *   data   = timestamp + sortedQueryValues + rawBody
 *   result = HMAC-SHA256(data, APP_SECRET).hexdigest()
 */

import crypto from "crypto";

const APP_SECRET = process.env["ESIGN_APP_SECRET"] ?? "";
const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}`;

if (!APP_SECRET) {
  console.warn("⚠  ESIGN_APP_SECRET not set — will test dev bypass (signature not checked in dev)");
}

function buildSignature(timestamp: string, body: string, queryValues = ""): string {
  const data = timestamp + queryValues + body;
  return crypto.createHmac("sha256", APP_SECRET).update(data, "utf8").digest("hex");
}

async function runTest(label: string, headers: Record<string, string>, body: string): Promise<void> {
  console.log(`\n── ${label}`);
  const res = await fetch(`${BASE}/api/webhooks/esign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const text = await res.text();
  const status = res.status;
  const icon = status === 200 ? "✅" : status === 401 ? "❌" : "⚠";
  console.log(`   ${icon}  HTTP ${status}  ${text.slice(0, 120)}`);
}

const timestamp = String(Date.now());
const validBody = JSON.stringify({ eventType: "SIGN_FLOW_FINISH", flowId: "test-flow-sandbox-001" });
const validSig = buildSignature(timestamp, validBody);

const staleTimestamp = String(Date.now() - 11 * 60 * 1000); // 11 min ago
const staleSig = buildSignature(staleTimestamp, validBody);

(async () => {
  console.log("e签宝 webhook sandbox simulation");
  console.log("==================================");

  await runTest(
    "Valid signature → expect 200",
    {
      "X-Tsign-Open-TIMESTAMP": timestamp,
      "X-Tsign-Open-SIGNATURE": validSig,
      "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
    },
    validBody,
  );

  await runTest(
    "Wrong/missing signature → expect 401 in prod, 200 in dev",
    {
      "X-Tsign-Open-TIMESTAMP": timestamp,
      "X-Tsign-Open-SIGNATURE": "badbadbadbad",
      "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
    },
    validBody,
  );

  await runTest(
    "Old header names (legacy) → expect 401 in prod, 200 in dev",
    {
      "X-timstamp": timestamp,
      "X-signature": `appId:${validSig}`,
    },
    validBody,
  );

  await runTest(
    "Stale timestamp (replay attack) → expect 401 in prod, 200 in dev",
    {
      "X-Tsign-Open-TIMESTAMP": staleTimestamp,
      "X-Tsign-Open-SIGNATURE": staleSig,
      "X-Tsign-Open-SIGNATURE-ALGORITHM": "hmac-sha256",
    },
    validBody,
  );

  if (!APP_SECRET) {
    console.log("\nℹ  Tests run in dev mode — all requests bypass signature check.");
    console.log("   Set ESIGN_APP_SECRET to run full validation.");
  }
})();
