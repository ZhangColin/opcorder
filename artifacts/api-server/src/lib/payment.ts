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

/**
 * PaymentOrderResponse — matches the payment provider's API exactly.
 *
 * status is an INTEGER:
 *   1 = 待支付 (pending)
 *   2 = 已支付 (paid)       ← terminal
 *   3 = 支付失败 (failed)    ← terminal
 *   4 = 已取消 (cancelled)  ← terminal
 *   5 = 已过期 (expired)    ← terminal
 */
export interface PaymentOrder {
  id: number;
  businessOrderNo: string;
  paymentOrderNo: string;
  businessSystemName: string | null;
  businessName: string | null;
  status: number;
  statusName: string;
  amount: number;
  subject: string;
  body: string | null;
  paymentChannelName: string | null;
  qrCodeUrl: string;
  clientIp: string | null;
  createdAt: string;
  expiredAt: string;
  paidAt: string | null;
  bankOrderNo: string | null;
  thirdPartyOrderNo: string | null;
}

export const PAYMENT_STATUS = {
  PENDING: 1,
  PAID: 2,
  FAILED: 3,
  CANCELLED: 4,
  EXPIRED: 5,
} as const;

export const TERMINAL_STATUSES = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.CANCELLED,
  PAYMENT_STATUS.EXPIRED,
];

export interface CreatePaymentParams {
  businessOrderNo: string;
  amount: number;
  subject: string;
  body?: string;
  businessName: string;
  notifyUrl: string;
}

export async function createPaymentOrder(params: CreatePaymentParams): Promise<PaymentOrder> {
  const bodyStr = JSON.stringify({
    businessOrderNo: params.businessOrderNo,
    amount: params.amount,
    subject: params.subject,
    body: params.body ?? params.subject,
    businessName: params.businessName,
    notifyUrl: params.notifyUrl,
  });

  const resp = await fetch(`${BASE_URL}/api/v1/payments`, {
    method: "POST",
    headers: buildHeaders(bodyStr),
    body: bodyStr,
  });

  const json = await resp.json() as { code: number | string; message: string; data: PaymentOrder };
  console.log(`[createPaymentOrder] httpStatus=${resp.status} code=${json.code} message=${json.message} paymentOrderNo=${json.data?.paymentOrderNo} status=${json.data?.status}`);
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
  console.log(`[queryPaymentStatus] orderNo=${paymentOrderNo} httpStatus=${resp.status} code=${json.code} message=${json.message} status=${json.data?.status}(${json.data?.statusName}) paidAt=${json.data?.paidAt}`);
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`支付查询错误: ${json.message} (${json.code})`);
  }
  return json.data;
}

export interface RefundResult {
  refundOrderNo: string;
  status: string;
  amount: number;
}

export interface CreateRefundParams {
  paymentOrderNo: string;
  amount: number;
  reason: string;
  businessOrderNo: string;
}

export async function createRefund(params: CreateRefundParams): Promise<RefundResult> {
  const bodyStr = JSON.stringify({
    paymentOrderNo: params.paymentOrderNo,
    amount: params.amount,
    reason: params.reason,
    businessOrderNo: params.businessOrderNo,
  });

  const resp = await fetch(`${BASE_URL}/api/v1/refunds`, {
    method: "POST",
    headers: buildHeaders(bodyStr),
    body: bodyStr,
  });

  const json = await resp.json() as { code: number | string; message: string; data: RefundResult };
  console.log(`[createRefund] paymentOrderNo=${params.paymentOrderNo} httpStatus=${resp.status} code=${json.code} message=${json.message}`);
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`退款申请失败: ${json.message} (${json.code})`);
  }
  return json.data;
}
