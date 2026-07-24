import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, FileText, Copy, Check } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { useToast } from "@/hooks/use-toast";

interface ContractB {
  id: number;
  contractNo: string;
  outsourceOrderId: number | null;
  outsourceOrderNo?: string | null;
  status: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  esignSignUrl?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                      { label: "草稿",         color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:  { label: "待OPC确认",    color: "bg-amber-100 text-amber-700" },
  publisher_rejected:         { label: "已退回",        color: "bg-red-100 text-red-600" },
  pending_sign:               { label: "待签约",        color: "bg-orange-100 text-orange-700" },
  esign_platform_signed:      { label: "平台盖章处理中", color: "bg-blue-100 text-blue-700" },
  esign_pending:              { label: "待对方签署",    color: "bg-violet-100 text-violet-700" },
  signed:                     { label: "已签约",        color: "bg-green-100 text-green-700" },
};

const STATUS_TABS = [
  { value: "draft",                     label: "草稿" },
  { value: "pending_publisher_confirm", label: "待确认" },
  { value: "publisher_rejected",        label: "已退回" },
  { value: "pending_sign",              label: "待签约" },
  { value: "esign_platform_signed",     label: "平台盖章中" },
  { value: "esign_pending",             label: "待对方签署" },
  { value: "signed",                    label: "已签约" },
  { value: "",                          label: "全部" },
];

const HIGHLIGHT = ["pending_publisher_confirm", "publisher_rejected"];

export default function AdminV2ContractBList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();
  const [items, setItems] = useState<ContractB[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("draft");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", channel: "b" });
      const data = await v2Get<ContractB[]>(`/contracts?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copySignUrl = useCallback(async (e: React.MouseEvent, contract: ContractB) => {
    e.stopPropagation();
    if (!contract.esignSignUrl) {
      toast({ title: "签署链接不存在", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(contract.esignSignUrl);
      setCopiedId(contract.id);
      toast({ title: "签署链接已复制", description: "可直接发送给对方完成签署" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "复制失败", description: "请手动复制", variant: "destructive" });
    }
  }, [toast]);

  const highlighted = items.filter(c => HIGHLIGHT.includes(c.status));
  const counts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.value] = tab.value === "" ? items.length : items.filter(c => c.status === tab.value).length;
    return acc;
  }, {} as Record<string, number>);
  const displayed = statusFilter === "" ? items : items.filter(c => c.status === statusFilter);

  return (
    <AdminV2Layout>
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 待处理（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.map(c => (
                <button key={c.id}
                  onClick={() => c.outsourceOrderId
                    ? (inlineNav ? inlineNav.push(`/admin/v2/outsource-orders/${c.outsourceOrderId}?tab=contract`) : navigate(`/admin/v2/outsource-orders/${c.outsourceOrderId}?tab=contract`))
                    : (inlineNav ? inlineNav.push(`/admin/v2/contracts-a/${c.id}`) : navigate(`/admin/v2/contracts-a/${c.id}`))}
                  className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-amber-800 hover:bg-amber-100">
                  {c.contractNo}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[c.status]?.color}`}>
                    {STATUS_CONFIG[c.status]?.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
              }`}>
              {tab.label}
              {counts[tab.value] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  statusFilter === tab.value ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}>{counts[tab.value]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-200">
            <FileText size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无合同</p>
            <p className="text-xs text-slate-400 mt-1">签约成功后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...displayed].sort((a, b) =>
              (hasUnread("contract", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("contract", a.id, a.updatedAt) ? 1 : 0)
            ).map(c => {
              const cfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: "bg-slate-100 text-slate-500" };
              const highlight = HIGHLIGHT.includes(c.status);
              const isEsignPending = c.status === "esign_pending";
              const isEsignPlatformSigned = c.status === "esign_platform_signed";
              const go = () => c.outsourceOrderId
                ? (inlineNav ? inlineNav.push(`/admin/v2/outsource-orders/${c.outsourceOrderId}?tab=contract`) : navigate(`/admin/v2/outsource-orders/${c.outsourceOrderId}?tab=contract`))
                : (inlineNav ? inlineNav.push(`/admin/v2/contracts-a/${c.id}`) : navigate(`/admin/v2/contracts-a/${c.id}`));
              return (
                <button key={c.id} onClick={go}
                  className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    highlight ? "bg-amber-50/40 border-amber-200" : "bg-white border-slate-100"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {c.outsourceOrderNo ? `订单 ${c.outsourceOrderNo}` : c.contractNo}
                      {hasUnread("contract", c.id, c.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {isEsignPending && (
                        <button
                          onClick={(e) => copySignUrl(e, c)}
                          title="复制对方签署链接"
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                          {copiedId === c.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === c.id ? "已复制" : "复制链接"}
                        </button>
                      )}
                      {isEsignPlatformSigned && (
                        <span className="text-xs text-blue-500 font-medium">盖章处理中…</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">合同编号</p>
                        <p className="text-sm text-slate-500 font-mono">{c.contractNo}</p>
                      </div>
                      {c.outsourceOrderNo && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">订单号</p>
                          <p className="text-sm text-slate-500 font-mono">{c.outsourceOrderNo}</p>
                        </div>
                      )}
                      {c.signedAt && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">签约时间</p>
                          <p className="text-sm text-slate-600">{new Date(c.signedAt).toLocaleDateString("zh-CN")}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">更新</p>
                        <p className="text-sm text-slate-600">{new Date(c.updatedAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
