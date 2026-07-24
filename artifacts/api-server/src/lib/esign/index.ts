/**
 * e签宝 SaaS API V3 wrapper
 *
 * Auth (from official Postman pre-request script):
 *   stringToSign = METHOD + "\n*\/*\n" + Base64(MD5(body)) + "\napplication/json; charset=UTF-8\n\n" + path
 *   X-Tsign-Open-Ca-Signature = Base64( HMAC-SHA256( stringToSign, appSecret ) )
 *
 * Required headers (every call):
 *   X-Tsign-Open-App-Id:       {appId}
 *   X-Tsign-Open-Ca-Timestamp: {ms timestamp}
 *   X-Tsign-Open-Ca-Signature: {signature}
 *   Content-MD5:               {Base64(MD5(body))}  — MD5 of "" for GET
 *   X-Tsign-Open-Auth-Mode:    Signature
 *   Accept:                    *\/*
 *   Content-Type:              application/json; charset=UTF-8
 *
 * Endpoints (all /v3/):
 *   POST /v3/files/file-upload-url
 *   POST /v3/files/{fileId}/keyword-positions
 *   POST /v3/sign-flow/create-by-file
 *   POST /v3/sign-flow/{id}/sign-url
 *   GET  /v3/sign-flow/{id}/file-download-url
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
const BASE_URL   = process.env["ESIGN_BASE_URL"] ?? (IS_PROD
  ? "https://openapi.esign.cn"
  : "https://smlopenapi.esign.cn");

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const ACCEPT       = "*/*";
const CONTENT_TYPE = "application/json; charset=UTF-8";

/**
 * V3 signing: signs the full HTTP request metadata.
 * bodyStr should be the raw JSON string (or "" for GET/no-body).
 * path must include sorted query params when present (e.g. "/v3/foo?a=1&b=2").
 */
function buildAuth(method: HttpMethod, path: string, bodyStr: string): {
  timestamp: string;
  signature: string;
  contentMd5: string;
} {
  const timestamp  = String(Date.now());
  const contentMd5 = crypto.createHash("md5").update(bodyStr, "utf8").digest("base64");
  const date       = "";
  const stringToSign = `${method}\n${ACCEPT}\n${contentMd5}\n${CONTENT_TYPE}\n${date}\n${path}`;
  const signature  = crypto.createHmac("sha256", APP_SECRET).update(stringToSign).digest("base64");
  return { timestamp, signature, contentMd5 };
}

async function esignRequest<T>(method: HttpMethod, path: string, body?: object): Promise<T> {
  const bodyStr   = body ? JSON.stringify(body) : "";
  const { timestamp, signature, contentMd5 } = buildAuth(method, path, bodyStr);

  const headers: Record<string, string> = {
    "X-Tsign-Open-App-Id":       APP_ID,
    "X-Tsign-Open-Ca-Timestamp": timestamp,
    "X-Tsign-Open-Ca-Signature": signature,
    "Content-MD5":               contentMd5,
    "X-Tsign-Open-Auth-Mode":    "Signature",
    "Accept":                    ACCEPT,
    "Content-Type":              CONTENT_TYPE,
  };

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const json = await res.json() as { code: number; message: string; data: T };

  if (json.code !== 0) {
    logger.warn({ path, code: json.code, message: json.message }, "e签宝 V3 API error");
    throw new Error(`e签宝 错误 ${json.code}: ${json.message}`);
  }

  return json.data;
}

/* ─── File upload URL ────────────────────────────────────────────────── */
export interface EsignUploadData {
  fileId: string;
  uploadUrl: string;
}

export async function getFileUploadUrl(params: {
  fileName: string;
  fileSize: number;
  contentMd5: string;
  convertToPDF?: boolean;
}): Promise<EsignUploadData> {
  return esignRequest<EsignUploadData>("POST", "/v3/files/file-upload-url", {
    fileName:    params.fileName,
    fileSize:    String(params.fileSize),
    contentMd5:  params.contentMd5,
    contentType: "application/octet-stream",
    convertToPDF: params.convertToPDF ?? false,
  });
}

/* ─── Upload file bytes to presigned URL ─────────────────────────────── */
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

/* ─── Keyword positions ──────────────────────────────────────────────── */
export interface KeywordPosition {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface KeywordPositionResult {
  keyword: string;
  keywordPositions?: KeywordPosition[];
  positions?: KeywordPosition[];
}

export async function getKeywordPositions(fileId: string, keywords: string[]): Promise<KeywordPositionResult[]> {
  const data = await esignRequest<KeywordPositionResult[]>(
    "POST",
    `/v3/files/${fileId}/keyword-positions`,
    { keywords },
  );
  logger.info({ fileId, keywords, count: data?.length }, "e签宝 keyword positions fetched");
  return data ?? [];
}

/**
 * Extract the first position for a given keyword from the result array.
 * Returns null if the keyword was not found in the PDF.
 */
export function extractFirstPosition(results: KeywordPositionResult[], keyword: string): KeywordPosition | null {
  const entry = results.find(r => r.keyword === keyword);
  return entry?.keywordPositions?.[0] ?? entry?.positions?.[0] ?? null;
}

/* ─── Create file from doc template ─────────────────────────────────── */

/**
 * Fill an e签宝 doc-template with variable values and generate a file.
 * Returns the fileId of the generated document.
 */
export async function createFileFromTemplate(params: {
  docTemplateId: string;
  fileName: string;
  components?: Array<{ componentKey: string; componentValue: string }>;
}): Promise<string> {
  const data = await esignRequest<{ fileId: string }>("POST", "/v3/files/create-by-doc-template", {
    docTemplateId: params.docTemplateId,
    fileName: params.fileName,
    components: params.components ?? [],
    requiredCheck: true,
  });
  return data.fileId;
}

/* ─── Create signing flow ────────────────────────────────────────────── */
export interface V3SignerField {
  customBizNum: string;
  fileId: string;
  normalSignFieldConfig: {
    autoSign?: boolean;
    signFieldPosition: {
      positionPage: string;
      positionX: number;
      positionY: number;
    };
    signFieldStyle: number;
  };
}

export interface V3PlatformSigner {
  signerType: 1;
  signConfig: { signOrder: number };
  signFields: V3SignerField[];
}

export interface V3PersonalSigner {
  signerType: 0;
  psnSignerInfo: {
    psnAccount: string;
    psnInfo?: {
      psnName?: string;
      psnIDCardNum?: string;
      psnIDCardType?: string;
    };
  };
  signConfig: {
    signOrder: number;
    forcedReadingTime?: number;
  };
  signFields: V3SignerField[];
}

export interface V3OrgSigner {
  signerType: 1;
  orgSignerInfo: {
    orgName: string;
    orgInfo: {
      orgIDCardNum: string;
      orgIDCardType: "CRED_ORG_USCC";
    };
    transactorInfo: {
      psnAccount: string;
      psnInfo?: {
        psnName?: string;
      };
    };
  };
  signConfig: { signOrder: number };
  signFields: V3SignerField[];
}

export type V3Signer = V3PlatformSigner | V3PersonalSigner | V3OrgSigner;

export async function createSignFlow(params: {
  title: string;
  fileId: string;
  fileName: string;
  signers: V3Signer[];
  notifyUrl?: string;
  redirectUrl?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    docs: [{ fileId: params.fileId, fileName: params.fileName }],
    signFlowConfig: {
      signFlowTitle: params.title,
      autoStart: true,
      autoFinish: true,
      noticeConfig: { noticeTypes: "1,2" },
      signConfig: { availableSignClientTypes: "1" },
      ...(params.notifyUrl ? { notifyUrl: params.notifyUrl } : {}),
      ...(params.redirectUrl ? { redirectConfig: { redirectUrl: params.redirectUrl } } : {}),
    },
    signers: params.signers,
  };

  const data = await esignRequest<{ signFlowId: string }>("POST", "/v3/sign-flow/create-by-file", body);
  return data.signFlowId;
}

/* ─── Get counterparty sign URL ─────────────────────────────────────── */
export async function getSignUrl(signFlowId: string, psnAccount: string): Promise<string> {
  const data = await esignRequest<{ signUrl?: string; shortUrl?: string; url?: string }>(
    "POST",
    `/v3/sign-flow/${signFlowId}/sign-url`,
    { operator: { psnAccount } },
  );
  const url = data.signUrl ?? data.shortUrl ?? data.url ?? "";
  if (!url) {
    logger.warn({ signFlowId, psnAccount, data }, "e签宝 V3 sign-url response had no URL field");
  }
  return url;
}

/* ─── Download final signed PDF URL ─────────────────────────────────── */
export async function getSignedFileUrl(signFlowId: string): Promise<string> {
  const data = await esignRequest<{ downloadUrl?: string; fileDownloadUrl?: string; url?: string }>(
    "GET",
    `/v3/sign-flow/${signFlowId}/file-download-url`,
  );
  const url = data.downloadUrl ?? data.fileDownloadUrl ?? data.url ?? "";
  if (!url) {
    logger.warn({ signFlowId, data }, "e签宝 V3 file-download-url response had no URL field");
  }
  return url;
}

/**
 * Verify an incoming e签宝 webhook callback signature.
 *
 * e签宝 sends these headers on every callback (V3):
 *   X-Tsign-Open-TIMESTAMP         — millisecond Unix timestamp
 *   X-Tsign-Open-SIGNATURE         — HMAC-SHA256 hex digest
 *   X-Tsign-Open-SIGNATURE-ALGORITHM — always "hmac-sha256"
 *   X-Tsign-Open-App-Id            — the AppId (informational)
 *
 * Signature = HMAC-SHA256(timestamp + sortedQueryValues + rawBody, appSecret).hex
 *
 * Replay-attack protection: reject callbacks more than TIMESTAMP_TOLERANCE_MS away from now.
 */
const TIMESTAMP_TOLERANCE_MS = 10 * 60 * 1000;

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

    const timestamp   = headers["x-tsign-open-timestamp"] ?? "";
    const incomingSig = (headers["x-tsign-open-signature"] ?? "").toLowerCase();
    if (!timestamp || !incomingSig) return false;

    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) return false;

    let queryValues = "";
    if (notifyUrlQuery) {
      const params = new URLSearchParams(notifyUrlQuery);
      const sortedKeys = [...params.keys()].sort();
      queryValues = sortedKeys.map((k) => params.get(k) ?? "").join("");
    }

    const data     = timestamp + queryValues + body;
    const expected = crypto.createHmac("sha256", APP_SECRET).update(data, "utf8").digest("hex");

    if (expected.length !== incomingSig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(incomingSig, "utf8"));
  } catch {
    return false;
  }
}
