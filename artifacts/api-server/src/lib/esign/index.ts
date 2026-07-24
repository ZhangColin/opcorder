/**
 * e签宝 Open API SDK wrapper
 *
 * Docs: https://open.esign.cn/doc/opendoc
 *
 * Authentication: every request carries X-timstamp + X-signature headers.
 * Signature = Base64( HMAC-SHA256( method\ncontent-md5\ncontent-type\ntimestamp\n/path, AppSecret ) )
 */
import crypto from "crypto";
import { logger } from "../logger";

const IS_PROD = process.env["NODE_ENV"] === "production";

const APP_ID     = IS_PROD
  ? (process.env["ESIGN_APP_ID"]      ?? "")
  : (process.env["ESIGN_TEST_APP_ID"] ?? process.env["ESIGN_APP_ID"] ?? "");
const APP_SECRET = IS_PROD
  ? (process.env["ESIGN_APP_SECRET"]      ?? "")
  : (process.env["ESIGN_TEST_APP_SECRET"] ?? process.env["ESIGN_APP_SECRET"] ?? "");
const ORG_ID     = IS_PROD
  ? (process.env["ESIGN_ORG_ID"]      ?? "")
  : (process.env["ESIGN_TEST_ORG_ID"] ?? process.env["ESIGN_ORG_ID"] ?? "");
const BASE_URL   = process.env["ESIGN_BASE_URL"] ?? (IS_PROD ? "https://openapi.esign.cn" : "https://smlopenapi.esign.cn");

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

function sign(method: HttpMethod, path: string, contentMd5: string, contentType: string): { timestamp: string; signature: string } {
  const timestamp = String(Date.now());
  const stringToSign = [method, contentMd5, contentType, timestamp, path].join("\n");
  const signature = crypto.createHmac("sha256", APP_SECRET).update(stringToSign).digest("base64");
  return { timestamp, signature };
}

async function esignRequest<T>(method: HttpMethod, path: string, body?: object): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : "";
  const contentType = body ? "application/json; charset=UTF-8" : "";
  const contentMd5 = bodyStr
    ? crypto.createHash("md5").update(bodyStr).digest("base64")
    : "";

  const { timestamp, signature } = sign(method, path, contentMd5, contentType);

  const headers: Record<string, string> = {
    "X-timstamp": timestamp,
    "X-signature": `${APP_ID}:${signature}`,
    "Accept": "application/json",
  };
  if (body) {
    headers["Content-Type"] = contentType;
    headers["Content-MD5"] = contentMd5;
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const json = await res.json() as { code: number; message: string; data: T };

  if (json.code !== 0) {
    logger.warn({ path, code: json.code, message: json.message }, "e签宝 API error");
    throw new Error(`e签宝 错误 ${json.code}: ${json.message}`);
  }

  return json.data;
}

/* ─── Organization account (企业签约方) ─── */
export interface EsignOrgData {
  orgId: string;
}

export async function registerOrgAccount(params: {
  thirdPartyOrgId: string;
  orgName: string;
  creditCode: string;
}): Promise<string> {
  const data = await esignRequest<EsignOrgData>("POST", "/v1/organizations/createByThirdParty", {
    thirdPartyOrgId: params.thirdPartyOrgId,
    name: params.orgName,
    idType: "CRED_ORG_USCC",
    idNumber: params.creditCode,
  });
  return data.orgId;
}

/* ─── Personal account (个人签约方) ─── */
export interface EsignPersonalData {
  accountId: string;
}

export async function registerPersonalAccount(params: {
  thirdPartyUserId: string;
  name: string;
  idNumber: string;
  mobile: string;
}): Promise<string> {
  const data = await esignRequest<EsignPersonalData>("POST", "/v1/accounts/createByThirdParty", {
    thirdPartyUserId: params.thirdPartyUserId,
    name: params.name,
    idType: "CRED_PSN_CH_IDCARD",
    idNumber: params.idNumber,
    mobile: params.mobile,
  });
  return data.accountId;
}

/* ─── File upload URL ─── */
export interface EsignUploadData {
  fileId: string;
  uploadUrl: string;
}

export async function getFileUploadUrl(params: {
  fileName: string;
  fileSize: number;
  contentMd5: string;
  convert2Pdf?: boolean;
}): Promise<EsignUploadData> {
  const data = await esignRequest<EsignUploadData>("POST", "/v1/files/getUploadUrl", {
    fileName: params.fileName,
    fileSize: params.fileSize,
    contentMd5: params.contentMd5,
    convert2Pdf: params.convert2Pdf ?? false,
  });
  return data;
}

/* ─── Upload file bytes to presigned URL ─── */
export async function uploadFileToEsign(uploadUrl: string, fileBuffer: Buffer, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`File upload to e签宝 failed: ${res.status}`);
  }
}

/* ─── Create signing flow ─── */
export interface EsignFlowData {
  flowId: string;
}

export interface EsignSignerInfo {
  signerId: string;
  signerUrl?: string;
}

export interface FlowSigner {
  signerType: "PERSON" | "ORG";
  accountId?: string;
  orgId?: string;
  authorizedAccountId?: string;
  signOrder: number;
  noticeType?: "1";
  noticeMobile?: string;
  signBeans: Array<{
    fileId: string;
    posType: "0";
    keyword: string;
    keywordIndex?: number;
  }>;
}

export async function createSignFlow(params: {
  businessScene: string;
  fileId: string;
  platformSigner: {
    orgId: string;
    keyword: string;
  };
  counterpartySigner: FlowSigner;
  notifyUrl?: string;
}): Promise<string> {
  const body = {
    businessScene: params.businessScene,
    initiatorEvidenceInfo: {
      hashAlgorithm: "SHA256",
    },
    docs: [
      {
        fileId: params.fileId,
        fileName: "合同",
      },
    ],
    signers: [
      {
        signerType: "ORG",
        orgId: params.platformSigner.orgId,
        signOrder: 1,
        signBeans: [
          {
            fileId: params.fileId,
            posType: "0",
            keyword: params.platformSigner.keyword,
            keywordIndex: 0,
          },
        ],
      },
      {
        ...params.counterpartySigner,
        signOrder: 2,
      },
    ],
    ...(params.notifyUrl ? { notifyUrl: params.notifyUrl } : {}),
  };

  const data = await esignRequest<EsignFlowData>("POST", "/v1/signflows/createFlowOneStep", body);
  return data.flowId;
}

/* ─── Platform auto-seal (server-side) ─── */
export async function platformAutoSign(flowId: string): Promise<void> {
  await esignRequest<unknown>("POST", `/v1/signflows/${flowId}/seal`, {});
}

/* ─── Get counterparty sign URL ─── */
export interface EsignSignUrlData {
  shortUrl: string;
}

export async function getSignUrl(flowId: string, accountId: string): Promise<string> {
  const data = await esignRequest<EsignSignUrlData>(
    "GET",
    `/v1/signflows/${flowId}/signers/${accountId}/signUrl?redirectUrl=`,
  );
  return data.shortUrl;
}

/* ─── Download final signed PDF ─── */
export interface EsignDownloadData {
  fileDownloadUrl: string;
}

export async function getSignedFileUrl(flowId: string): Promise<string> {
  const data = await esignRequest<{ docs: Array<{ fileDownloadUrl: string }> }>(
    "GET",
    `/v1/signflows/${flowId}/documents/download`,
  );
  return data.docs?.[0]?.fileDownloadUrl ?? "";
}

/**
 * Verify an incoming e签宝 webhook callback signature.
 *
 * e签宝 sends these headers on every callback:
 *   X-Tsign-Open-TIMESTAMP         — millisecond Unix timestamp
 *   X-Tsign-Open-SIGNATURE         — HMAC-SHA256 hex digest
 *   X-Tsign-Open-SIGNATURE-ALGORITHM — always "hmac-sha256"
 *   X-Tsign-Open-App-Id            — the AppId (informational)
 *
 * Signature construction (per open.esign.cn/doc/opendoc/notify3/pmy852):
 *   data   = timestamp_string + sorted_query_param_values + raw_body_utf8
 *   result = HMAC-SHA256(data, APP_SECRET).hexdigest()
 *
 * Query param values: if the notifyUrl has query params, sort by key (ASCII),
 * concatenate values only.  Our notifyUrl has no query params → empty string.
 *
 * Replay-attack protection: reject callbacks whose timestamp is more than
 * TIMESTAMP_TOLERANCE_MS milliseconds away from server time.
 */
const TIMESTAMP_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes

export function verifyWebhookSignature(
  headers: {
    "x-tsign-open-timestamp"?: string;
    "x-tsign-open-signature"?: string;
  },
  body: string,
  notifyUrlQuery = "",
): boolean {
  try {
    if (!APP_SECRET) return false;

    const timestamp = headers["x-tsign-open-timestamp"] ?? "";
    const incomingSig = (headers["x-tsign-open-signature"] ?? "").toLowerCase();
    if (!timestamp || !incomingSig) return false;

    // Replay-attack guard
    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) return false;

    // Sort query params by key (ASCII order), concatenate values only
    let queryValues = "";
    if (notifyUrlQuery) {
      const params = new URLSearchParams(notifyUrlQuery);
      const sortedKeys = [...params.keys()].sort();
      queryValues = sortedKeys.map((k) => params.get(k) ?? "").join("");
    }

    // Signature = HMAC-SHA256(timestamp + queryValues + rawBody, appSecret)
    const data = timestamp + queryValues + body;
    const expected = crypto.createHmac("sha256", APP_SECRET).update(data, "utf8").digest("hex");

    if (expected.length !== incomingSig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(incomingSig, "utf8"));
  } catch {
    return false;
  }
}

/* ─── Get org sign URL (for enterprise/publisher signers) ─── */
export async function getOrgSignUrl(flowId: string, orgId: string): Promise<string> {
  const data = await esignRequest<EsignSignUrlData>(
    "GET",
    `/v1/signflows/${flowId}/organizations/${orgId}/signUrl?redirectUrl=`,
  );
  return data.shortUrl;
}

/* ─── Expose platform org ID for use in routes ─── */
export function getPlatformOrgId(): string {
  return ORG_ID;
}
