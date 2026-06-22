import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  PackageCheck, Loader2, AlertCircle, ChevronRight, Clock,
  CheckCircle2, XCircle, RotateCcw,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";

interface DeliveryItem {
  id: number;
  clientDemandId: number;
  title: string;
  url: string | null;
  content: string | null;
  attachments: any[];
  status: string;
  createdByNickname: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  demandTitle: string | null;
  demandNo: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待我确认", color: "bg-amber-100 text-amber-700",  icon: Clock },
  confirmed: { label: "已确认",   color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  revision:  { label: "已驳回",   color: "bg-red-100 text-red-700",      icon: XCircle },
  rejected:  { label: "已驳回",   color: "bg-red-100 text-red-700",      icon: XCircle },
};

const FILTER_TABS = [
  { key: "all",       label: "全部" },
  { key: "pending",   label: "待确认" },
  { key: "confirmed", label: "已确认" },
  { key: "revision",  label: "已驳回" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function PubDeliveryList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [, navigate] = useLocation();

  const { data = [], isLoading, isError, refetch } = useQuery<DeliveryItem[]>({
    queryKey: ["pub-deliveries-a"],
    queryFn: () => v2Get("/deliverables-a"),
  });

  const filtered = filter === "all" ? data : data.filter(d => d.status === filter);
  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? data.length : data.filter(d => d.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <PubLayout>
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-blue-900 mb-1">交付确认</h2>
          <p className="text-sm text-slate-500">运营方提交的交付物，点击查看详情并沟通</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-primary/40"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${
                  filter === tab.key ? "opacity-75" : tab.key === "pending" ? "text-amber-500" : "text-slate-400"
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-primary px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors"
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
          <div className="space-y-2">
            {filtered.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500", icon: Clock };
              const StatusIcon = cfg.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/pub/demands/${item.clientDemandId}?tab=delivery&id=${item.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all p-5 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <PackageCheck size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.demandTitle && (
                        <p className="text-xs text-slate-400 truncate mb-0.5">
                          📋 {item.demandTitle}{item.demandNo && ` · ${item.demandNo}`}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <StatusIcon size={11} /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")} 提交
                        </span>
                        {item.createdByNickname && <span>提交人：{item.createdByNickname}</span>}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
