import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/adminAuth";

const router: IRouter = Router();

interface CredentialEntry {
  key: string;
  present: boolean;
  required: boolean;
  description: string;
}

interface CredentialGroup {
  name: string;
  credentials: CredentialEntry[];
}

function check(key: string, required: boolean, description: string): CredentialEntry {
  return {
    key,
    present: Boolean(process.env[key]),
    required,
    description,
  };
}

router.get("/health/credentials", requireAdmin, (_req, res) => {
  const groups: CredentialGroup[] = [
    {
      name: "Auth / JWT",
      credentials: [
        check("JWT_SECRET", true, "JWT signing secret; required for all authenticated requests"),
      ],
    },
    {
      name: "e签宝 (eSign)",
      credentials: [
        check("ESIGN_APP_ID",     true,  "e签宝 open-platform App ID"),
        check("ESIGN_APP_SECRET", true,  "e签宝 open-platform App Secret"),
        check("ESIGN_ORG_ID",     true,  "e签宝 organization ID for contract stamping"),
        check("ESIGN_BASE_URL",   false, "e签宝 API base URL (defaults to sandbox if absent)"),
      ],
    },
    {
      name: "SMS / 腾讯云",
      credentials: [
        check("TENCENT_SECRET_ID",    true, "腾讯云 SecretId for SMS API"),
        check("TENCENT_SECRET_KEY",   true, "腾讯云 SecretKey for SMS API"),
        check("TENCENT_SMS_APP_ID",   true, "腾讯云 SMS SdkAppId"),
        check("TENCENT_SMS_SIGN_NAME",true, "腾讯云 SMS signature/sign name"),
      ],
    },
    {
      name: "Email / Resend",
      credentials: [
        check("RESEND_API_KEY",          true,  "Resend API key for transactional email"),
        check("RESEND_API_KEY_FORGOT_PWD",false, "Separate Resend key for forgot-password emails (falls back to RESEND_API_KEY)"),
      ],
    },
    {
      name: "LLM / DeepSeek",
      credentials: [
        check("DEEPSEEK_API_KEY", true, "DeepSeek API key for AI agent features"),
      ],
    },
    {
      name: "Payment",
      credentials: [
        check("PAYMENT_APP_ID",    true, "Payment gateway App ID"),
        check("PAYMENT_API_SECRET",true, "Payment gateway API secret"),
      ],
    },
    {
      name: "Object Storage",
      credentials: [
        check("PUBLIC_OBJECT_SEARCH_PATHS", true,  "Comma-separated GCS paths for public file access"),
        check("PRIVATE_OBJECT_DIR",         false, "GCS path prefix for private file uploads"),
      ],
    },
    {
      name: "Site / Origin",
      credentials: [
        check("SITE_URL",    false, "Canonical site URL (used in email links)"),
        check("WEB_ORIGIN",  false, "Frontend origin override (used for CORS and notifications)"),
      ],
    },
  ];

  const allRequired = groups
    .flatMap((g) => g.credentials)
    .filter((c) => c.required);

  const missingRequired = allRequired.filter((c) => !c.present);
  const allHealthy = missingRequired.length === 0;

  res.status(200).json({
    healthy: allHealthy,
    summary: allHealthy
      ? "All required credentials are present"
      : `${missingRequired.length} required credential(s) missing: ${missingRequired.map((c) => c.key).join(", ")}`,
    groups,
  });
});

export default router;
