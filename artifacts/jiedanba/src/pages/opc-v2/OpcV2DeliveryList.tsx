import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  PackageCheck, Loader2, AlertCircle, ChevronRight, Clock,
  CheckCircle2, XCircle,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

interface DeliveryItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  content: string | null;
  status: string;
  submittedByNickname: string | null;
  orderNo: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "待审核", color: "bg-orange-100 text-orange-700", icon: <Clock size={12} /> },
  approved: { label: "已通过", color: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={12} /> },
  rejected: { label: "已驳回", color: "bg-red-100 text-red-700",      icon: <XCircle size={12} /> },
};

const FILTER_TABS = [
  { key: "all",      label: "全部" },
  { key: "pending",  label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2DeliveryList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [, navigate] = useLocation();

  const { data = [], isLoading, isError, refetch } = useQuery<DeliveryItem[]>({
    queryKey: ["v2-opc-deliveries"],
    queryFn: () => v2Get("/deliverables-b"),
  });

  const filtered = filter === "all" ? data : data.filter(d => d.status === filter);
  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? data.length : data.filter(d => d.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <OpcV2Layout title="交付管理">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">交付管理</h2>
          <p className="text-sm text-slate-500">我提交的交付物及审核状态</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-400"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filter === tab.key ? "opacity-75" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-emerald-700 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            刷新
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <PackageCheck size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无交付记录" : "暂无此状态的交付记录"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500", icon: null };
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/opc/deliveries/${item.id}`)}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all p-5 text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-emerald-800 transition-colors mb-1">
                        {item.title}
                      </h3>
                      {item.content && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-1">{item.content}</p>
                      )}
                      {item.status === "rejected" && item.rejectedReason && (
                        <p className="text-xs text-red-500 mb-1">驳回原因：{item.rejectedReason}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")} 提交
                        </span>
                        {item.orderNo && <span className="font-mono">{item.orderNo}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors mt-1 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </OpcV2Layout>
  );
}
