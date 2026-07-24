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

const APP_ID     = process.env["ESIGN_APP_ID"]     ?? "";
const APP_SECRET = process.env["ESIGN_APP_SECRET"]  ?? "";
const ORG_ID     = process.env["ESIGN_ORG_ID"]      ?? "";
const BASE_URL   = process.env["ESIGN_BASE_URL"]     ?? "https://smlopenapi.esign.cn";

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

/* ─── Verify webhook signature ─── */
export function verifyWebhookSignature(headers: {
  "x-timstamp"?: string;
  "x-signature"?: string;
}, body: string): boolean {
  try {
    const timestamp = headers["x-timstamp"] ?? "";
    const incomingSig = headers["x-signature"] ?? "";
    const contentMd5 = crypto.createHash("md5").update(body).digest("base64");
    const stringToSign = ["POST", contentMd5, "application/json; charset=UTF-8", timestamp, "/api/webhooks/esign"].join("\n");
    const expected = `${APP_ID}:${crypto.createHmac("sha256", APP_SECRET).update(stringToSign).digest("base64")}`;
    return expected === incomingSig;
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
