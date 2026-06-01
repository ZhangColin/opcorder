import { logger } from "./logger";

// Tencent Cloud SMS template IDs
const TPL = {
  REGISTER_CODE:      "2654686",
  DEMAND_APPROVED:    "2654697",
  DEMAND_REJECTED:    "2654700",
  BID_SELECTED:       "2654706",
  DEMAND_INVITATION:  "2654708",
} as const;

let _client: any = null;

function getClient() {
  if (_client) return _client;
  const secretId  = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    logger.warn("Tencent SMS not configured (missing TENCENT_SECRET_ID / TENCENT_SECRET_KEY)");
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tencentcloud = require("tencentcloud-sdk-nodejs-sms");
    const SmsClient = tencentcloud.sms.v20210111.Client;
    _client = new SmsClient({
      credential: { secretId, secretKey },
      region: "ap-guangzhou",
    });
  } catch (err) {
    logger.error({ err }, "Failed to initialise Tencent SMS client");
    return null;
  }
  return _client;
}

async function sendSms(phone: string, templateId: string, params: string[]): Promise<void> {
  const client  = getClient();
  const appId   = process.env.TENCENT_SMS_APP_ID;
  const sign    = process.env.TENCENT_SMS_SIGN_NAME;

  if (!client || !appId || !sign) return;

  // Normalise to E.164-style: add +86 if no country code
  const normalised = /^\+/.test(phone) ? phone : `+86${phone.replace(/^0/, "")}`;

  try {
    const res = await client.SendSms({
      SmsSdkAppId:    appId,
      SignName:       sign,
      TemplateId:     templateId,
      TemplateParamSet: params,
      PhoneNumberSet: [normalised],
    });
    const item = res?.SendStatusSet?.[0];
    if (item && item.Code !== "Ok") {
      logger.warn({ code: item.Code, msg: item.Message, phone: normalised }, "SMS send failed");
    } else {
      logger.info({ templateId, phone: normalised }, "SMS sent");
    }
  } catch (err) {
    logger.warn({ err, templateId, phone: normalised }, "SMS send threw");
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** 注册验证码 */
export function sendRegisterCode(phone: string, code: string): Promise<void> {
  return sendSms(phone, TPL.REGISTER_CODE, [code]);
}

/** 需求审核通过 */
export function sendDemandApproved(phone: string, demandTitle: string): Promise<void> {
  return sendSms(phone, TPL.DEMAND_APPROVED, [demandTitle]);
}

/** 需求审核拒绝 */
export function sendDemandRejected(phone: string, demandTitle: string): Promise<void> {
  return sendSms(phone, TPL.DEMAND_REJECTED, [demandTitle]);
}

/** 投标入选通知（发给 OPC） */
export function sendBidSelected(phone: string, demandTitle: string): Promise<void> {
  return sendSms(phone, TPL.BID_SELECTED, [demandTitle]);
}

/** 邀请投标通知（发给 OPC） */
export function sendDemandInvitation(phone: string, demandTitle: string, bidDeadline: string): Promise<void> {
  return sendSms(phone, TPL.DEMAND_INVITATION, [demandTitle, bidDeadline]);
}
