import { useState, useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/auth";
import { useGetCurrentUser } from "@workspace/api-client-react";
import {
  Building2,
  CreditCard,
  Landmark,
  User,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SettlementAccountData {
  id?: number;
  companyName?: string;
  creditCode?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  accountName?: string;
  contactName?: string;
  contactPhone?: string;
  businessLicenseUrl?: string;
  rejectReason?: string;
  status?: "pending" | "verified" | "rejected";
}

const EMPTY_FORM: SettlementAccountData = {
  companyName: "",
  creditCode: "",
  bankName: "",
  bankBranch: "",
  bankAccount: "",
  accountName: "",
  contactName: "",
  contactPhone: "",
  businessLicenseUrl: "",
};

export default function SettlementAccount() {
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();

  const [form, setForm] = useState<SettlementAccountData>(EMPTY_FORM);
  const [status, setStatus] = useState<"pending" | "verified" | "rejected" | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.id || initialized.current) return;
    initialized.current = true;

    const token = getAccessToken();
    fetch(`${BASE}/api/opc/settlement-account`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setForm({
            companyName: data.companyName ?? "",
            creditCode: data.creditCode ?? "",
            bankName: data.bankName ?? "",
            bankBranch: data.bankBranch ?? "",
            bankAccount: data.bankAccount ?? "",
            accountName: data.accountName ?? "",
            contactName: data.contactName ?? "",
            contactPhone: data.contactPhone ?? "",
            businessLicenseUrl: data.businessLicenseUrl ?? "",
          });
          setStatus(data.status ?? null);
          setRejectReason(data.rejectReason ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  function handleChange(field: keyof SettlementAccountData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLicenseUpload(file: File) {
    if (!file) return;
    setLicenseUploading(true);
    const token = getAccessToken();
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${BASE}/api/storage/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("上传失败");
      const data = await res.json();
      const url = data.url ?? data.fileUrl ?? data.path;
      if (!url) throw new Error("上传响应异常");
      setForm((prev) => ({ ...prev, businessLicenseUrl: url }));
      toast({ title: "上传成功", description: "营业执照已上传" });
    } catch {
      toast({ title: "上传失败", description: "请重试或检查文件格式", variant: "destructive" });
    } finally {
      setLicenseUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const token = getAccessToken();
    try {
      const res = await fetch(`${BASE}/api/opc/settlement-account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const { data } = await res.json();
      if (data) {
        setStatus(data.status ?? "pending");
        setRejectReason(data.rejectReason ?? null);
        toast({ title: "保存成功", description: "结算账户信息已更新，等待审核" });
      } else {
        throw new Error("no data");
      }
    } catch {
      toast({ title: "保存失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const statusMap = {
    pending: { label: "待审核", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
    verified: { label: "已认证", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
    rejected: { label: "审核未通过", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  };

  const currentStatus = status ? statusMap[status] : null;
  const StatusIcon = currentStatus?.icon;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Landmark size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">结算账户</h1>
            <p className="text-sm text-muted-foreground mt-0.5">填写企业及银行信息，用于订单收益结算</p>
          </div>
        </div>

        {currentStatus && StatusIcon && (
          <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${currentStatus.color}`}>
            <StatusIcon size={15} className="shrink-0" />
            账户状态：{currentStatus.label}
            {status === "pending" && <span className="font-normal text-xs ml-1">· 平台将在 1-3 个工作日内完成审核</span>}
            {status === "rejected" && rejectReason && (
              <span className="font-normal text-xs ml-1">· 驳回原因：{rejectReason}</span>
            )}
            {status === "rejected" && !rejectReason && (
              <span className="font-normal text-xs ml-1">· 请修改后重新提交</span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">加载中…</div>
      ) : (
        <div className="space-y-6">
          {/* 企业信息 */}
          <section className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <span className="text-sm font-bold text-foreground">企业信息</span>
            </div>
            <div className="p-6 space-y-5">
              <FormField
                label="企业名称"
                placeholder="请输入营业执照上的企业名称"
                value={form.companyName ?? ""}
                onChange={(v) => handleChange("companyName", v)}
              />
              <FormField
                label="统一社会信用代码"
                placeholder="18位统一社会信用代码"
                value={form.creditCode ?? ""}
                onChange={(v) => handleChange("creditCode", v)}
                maxLength={18}
              />

              {/* 营业执照上传 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">营业执照</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  ref={licenseInputRef}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLicenseUpload(file);
                    e.target.value = "";
                  }}
                />
                {form.businessLicenseUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <FileText size={18} className="text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-700 truncate">营业执照已上传</p>
                      <a
                        href={form.businessLicenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        点击查看
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => licenseInputRef.current?.click()}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        重新上传
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, businessLicenseUrl: "" }))}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => licenseInputRef.current?.click()}
                    disabled={licenseUploading}
                    className="w-full h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {licenseUploading ? (
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <Upload size={20} className="text-slate-400" />
                    )}
                    <span className="text-xs text-slate-500">{licenseUploading ? "上传中…" : "点击上传营业执照（JPG / PNG / PDF）"}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 银行账户信息 */}
          <section className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <CreditCard size={16} className="text-primary" />
              <span className="text-sm font-bold text-foreground">银行账户信息</span>
            </div>
            <div className="p-6 space-y-5">
              <FormField
                label="开户名称"
                placeholder="与银行开户名称完全一致"
                value={form.accountName ?? ""}
                onChange={(v) => handleChange("accountName", v)}
              />
              <FormField
                label="银行账号"
                placeholder="请输入银行账号"
                value={form.bankAccount ?? ""}
                onChange={(v) => handleChange("bankAccount", v)}
              />
              <FormField
                label="开户银行"
                placeholder="如：中国工商银行"
                value={form.bankName ?? ""}
                onChange={(v) => handleChange("bankName", v)}
              />
              <FormField
                label="开户支行"
                placeholder="如：北京市朝阳区建国路支行"
                value={form.bankBranch ?? ""}
                onChange={(v) => handleChange("bankBranch", v)}
              />
            </div>
          </section>

          {/* 联系人信息 */}
          <section className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={16} className="text-primary" />
              <span className="text-sm font-bold text-foreground">联系人信息</span>
            </div>
            <div className="p-6 space-y-5">
              <FormField
                label="联系人姓名"
                placeholder="请输入联系人姓名"
                value={form.contactName ?? ""}
                onChange={(v) => handleChange("contactName", v)}
              />
              <FormField
                label="联系电话"
                placeholder="请输入联系电话"
                value={form.contactPhone ?? ""}
                onChange={(v) => handleChange("contactPhone", v)}
                type="tel"
              />
            </div>
          </section>

          {/* 说明 */}
          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">温馨提示</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>请确保企业名称、统一社会信用代码与营业执照保持一致</li>
              <li>银行账号、开户名称请与银行预留信息完全一致，避免结算失败</li>
              <li>请上传清晰的营业执照照片，用于资质核验</li>
              <li>提交后平台将在 1-3 个工作日内完成审核</li>
              <li>审核通过后，方可参与抢单，订单收益将自动结算至绑定账户</li>
            </ul>
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saving || licenseUploading}
            className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            <Save size={16} />
            {saving ? "保存中…" : "保存并提交审核"}
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full h-10 px-3 rounded-lg border border-border/60 bg-slate-50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
