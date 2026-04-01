import { useState, useEffect, useRef } from "react";
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
};

export default function SettlementAccount() {
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();

  const [form, setForm] = useState<SettlementAccountData>(EMPTY_FORM);
  const [status, setStatus] = useState<"pending" | "verified" | "rejected" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.id || initialized.current) return;
    initialized.current = true;

    const userId = localStorage.getItem("jdb_user_id");
    fetch(`${BASE}/api/opc/settlement-account`, {
      headers: { Authorization: `Bearer ${userId}` },
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
          });
          setStatus(data.status ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  function handleChange(field: keyof SettlementAccountData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const userId = localStorage.getItem("jdb_user_id");
    try {
      const res = await fetch(`${BASE}/api/opc/settlement-account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(form),
      });
      const { data } = await res.json();
      if (data) {
        setStatus(data.status ?? "pending");
        toast({ title: "保存成功", description: "结算账户信息已更新" });
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
            {status === "rejected" && <span className="font-normal text-xs ml-1">· 请修改后重新提交</span>}
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
              <li>提交后平台将在 1-3 个工作日内完成审核</li>
              <li>审核通过后，订单收益将自动结算至绑定账户</li>
            </ul>
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saving}
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
