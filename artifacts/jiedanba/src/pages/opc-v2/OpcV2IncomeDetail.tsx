import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Lock, Package,
  Building2, User, CreditCard, Phone, ChevronDown, ChevronUp,
  ExternalLink,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { getAccessToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { OpcV2Layout } from "./OpcV2Layout";

interface SettlementDetail {
  id: number;
  outsourceOrderId: number;
  title: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paymentVoucherUrl: string | null;
  status: string;
  isLastItem: boolean;
  isBlockingPayment: boolean;
  isOverdue: boolean;
}

interface OrderInfo {
  id: number;
  orderNo: string;
  demandTitle: string | null;
  status: string;
}

interface SettlementAccount {
  companyName: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  accountName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string | null;
}

function WhyNotPaid({ plan }: { plan: SettlementDetail }) {
  if (plan.status === "paid") {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
        <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-green-700">平台已打款</p>
          {plan.paidAt && (
            <p className="text-xs text-green-600 mt-0.5">
              打款日期：{new Date(plan.paidAt).toLocaleDateString("zh-CN")}
            </p>
          )}
          <p className="text-xs text-green-600 mt-0.5">请查看附件付款凭证，核对到账情况</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const due = new Date(plan.dueDate);

  if (plan.isBlockingPayment) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-200">
        <Lock size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-700">尾款暂缓：有未关闭工单</p>
          <p className="text-xs text-red-500 mt-0.5">
            订单有未关闭工单，请前往「工单」模块积极配合处理。工单关闭后，平台将尽快打款。
          </p>
        </div>
      </div>
    );
  }

  if (now < due) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
        <Clock size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-700">尚未到打款日期</p>
          <p className="text-xs text-blue-600 mt-0.5">
            将于 {due.toLocaleDateString("zh-CN")} 可支付，请届时留意到账。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
      <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-700">已到打款日期，等待平台处理</p>
        <p className="text-xs text-amber-600 mt-0.5">
          如超过 3 个工作日仍未到账，请在工单模块发起工单联系平台。
        </p>
      </div>
    </div>
  );
}

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export default function OpcV2IncomeDetail() {
  const { id } = useParams<{ id: string }>();
  const planId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAccount, setShowAccount] = useState(false);

  const { data: plan, isLoading, isError } = useQuery<SettlementDetail>({
    queryKey: ["v2-opc-income-detail", planId],
    queryFn: () => v2Get(`/settlement-plans/${planId}`),
    enabled: !!planId,
  });

  const { data: orderData } = useQuery<{ items: OrderInfo[] }>({
    queryKey: ["v2-opc-orders-income"],
    queryFn: () => v2Get("/outsource-orders?limit=100"),
    enabled: !!plan,
  });

  const { data: accountRaw } = useQuery<{ data: SettlementAccount | null }>({
    queryKey: ["opc-settlement-account"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/opc/settlement-account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null };
      return res.json();
    },
  });

  const account = accountRaw?.data;
  const order = plan ? orderData?.items?.find(o => o.id === plan.outsourceOrderId) : null;

  if (isLoading) {
    return (
      <OpcV2Layout title="收款详情" backHref="/opc/income" backLabel="我的收款">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      </OpcV2Layout>
    );
  }

  if (isError || !plan) {
    return (
      <OpcV2Layout title="收款详情" backHref="/opc/income" backLabel="我的收款">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-6">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-sm text-red-500 font-medium">加载失败，请返回重试</p>
        </div>
      </OpcV2Layout>
    );
  }

  const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
    pending: { label: "待付款", color: "bg-amber-100 text-amber-700" },
    paid:    { label: "已付款", color: "bg-green-100 text-green-700" },
  };
  const statusCfg = PAYMENT_STATUS[plan.status] ?? PAYMENT_STATUS.pending;

  return (
    <OpcV2Layout
      title={plan.title}
      backHref="/opc/income"
      backLabel="我的收款"
    >
      <div className="py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-black text-slate-800 mb-2">{plan.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {plan.isLastItem && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">尾款</span>
              )}
              {plan.isBlockingPayment && plan.status !== "paid" && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 flex items-center gap-1">
                  <Lock size={10} /> 阻款中
                </span>
              )}
              {plan.isOverdue && plan.status !== "paid" && (
                <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">已逾期</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">应收金额</p>
              <p className="text-2xl font-black text-emerald-700">¥{plan.amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">应付日期</p>
              <p className={`text-sm font-bold ${plan.isOverdue && plan.status !== "paid" ? "text-red-600" : "text-slate-700"}`}>
                {new Date(plan.dueDate).toLocaleDateString("zh-CN")}
              </p>
            </div>
            {plan.paidAt && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">实际到账</p>
                <p className="text-sm font-bold text-green-700">{new Date(plan.paidAt).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
          </div>

          {order && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">关联订单</p>
              <button
                onClick={() => navigate(`/opc/orders/${order.id}`)}
                className="flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline"
              >
                <Package size={14} />
                {order.demandTitle ?? order.orderNo}
              </button>
            </div>
          )}
        </div>

        <WhyNotPaid plan={plan} />

        {plan.paymentVoucherUrl && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-3">付款凭证</h3>
            <a
              href={plan.paymentVoucherUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <ExternalLink size={14} /> 查看付款凭证
            </a>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAccount(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">我的收款账户</h3>
            </div>
            <div className="flex items-center gap-2">
              {!account?.bankAccount && (
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  ⚠️ 未配置
                </span>
              )}
              {showAccount ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </button>

          {showAccount && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs font-bold text-amber-800">
                  ⚠️ 请务必核对账户信息——账户错误是收不到钱的最常见原因！
                </p>
              </div>

              {account ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: Building2, label: "公司名称", value: account.companyName },
                    { icon: CreditCard, label: "银行账号", value: account.bankAccount },
                    { icon: Building2, label: "开户银行", value: account.bankName },
                    { icon: Building2, label: "开户支行", value: account.bankBranch },
                    { icon: User,      label: "账户名称", value: account.accountName },
                    { icon: User,      label: "联系人",   value: account.contactName },
                    { icon: Phone,     label: "联系电话", value: account.contactPhone },
                  ].map(row => (
                    <div key={row.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{row.label}</p>
                      <p className={`text-sm font-bold ${row.value ? "text-slate-700" : "text-slate-400"}`}>
                        {row.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">尚未配置收款账户</p>
              )}

              <div className="pt-3 border-t border-slate-100">
                <a
                  href="/profile"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors"
                >
                  前往个人中心维护账户信息
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </OpcV2Layout>
  );
}
