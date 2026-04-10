import crypto from "crypto";

const BASE_URL = "https://payment.aieducenter.com";
const APP_ID = process.env.PAYMENT_APP_ID ?? "";
const API_SECRET = process.env.PAYMENT_API_SECRET ?? "";

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

function buildHeaders(body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyDigest = sha256Hex(body);

  const signParams: Record<string, string> = {
    appId: APP_ID,
    bodyDigest,
    nonce,
    timestamp,
  };
  const stringToSign = Object.keys(signParams)
    .sort()
    .map((k) => `${k}=${signParams[k]}`)
    .join("&");
  const signature = hmacSha256(stringToSign, API_SECRET);

  return {
    "Content-Type": "application/json",
    "X-App-Id": APP_ID,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Body-Digest": bodyDigest,
    "X-Sign": signature,
  };
}

export interface CreatePaymentParams {
  businessOrderNo: string;
  amount: number;
  subject: string;
  body?: string;
  notifyUrl: string;
}

export interface PaymentOrder {
  id: number;
  businessOrderNo: string;
  paymentOrderNo: string;
  status: string;
  amount: number;
  subject: string;
  qrCodeUrl: string;
  expiredAt: string;
  paidAt: string | null;
}

export async function createPaymentOrder(params: CreatePaymentParams): Promise<PaymentOrder> {
  const bodyStr = JSON.stringify({
    businessOrderNo: params.businessOrderNo,
    amount: params.amount,
    subject: params.subject,
    body: params.body ?? params.subject,
    businessName: "接单吧",
    notifyUrl: params.notifyUrl,
  });

  const resp = await fetch(`${BASE_URL}/api/v1/payments`, {
    method: "POST",
    headers: buildHeaders(bodyStr),
    body: bodyStr,
  });

  const json = await resp.json() as { code: number | string; message: string; data: PaymentOrder };
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`支付服务错误: ${json.message} (${json.code})`);
  }
  return json.data;
}

export async function queryPaymentStatus(paymentOrderNo: string): Promise<PaymentOrder> {
  const body = "";
  const resp = await fetch(`${BASE_URL}/api/v1/payments/${paymentOrderNo}/query`, {
    method: "POST",
    headers: buildHeaders(body),
    body,
  });

  const json = await resp.json() as { code: number | string; message: string; data: PaymentOrder };
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`支付查询错误: ${json.message} (${json.code})`);
  }
  return json.data;
}
