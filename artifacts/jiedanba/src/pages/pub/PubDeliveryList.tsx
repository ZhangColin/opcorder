import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  PackageCheck, Loader2, AlertCircle, ChevronRight,
  Clock, CheckCircle2, XCircle, RotateCcw, User,
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

const STATUS_CONFIG: Record<string, {
  label: string; badge: string; accent: string;
  cardBg: string; icon: React.ElementType;
}> = {
  pending: {
    label: "待我确认", badge: "bg-amber-100 text-amber-700",
    accent: "border-l-amber-400", cardBg: "bg-amber-50/40",
    icon: Clock,
  },
  confirmed: {
    label: "已确认", badge: "bg-teal-100 text-teal-700",
    accent: "border-l-teal-400", cardBg: "bg-white",
    icon: CheckCircle2,
  },
  revision: {
    label: "已驳回", badge: "bg-red-100 text-red-700",
    accent: "border-l-red-400", cardBg: "bg-red-50/30",
    icon: XCircle,
  },
  rejected: {
    label: "已驳回", badge: "bg-red-100 text-red-700",
    accent: "border-l-red-400", cardBg: "bg-red-50/30",
    icon: XCircle,
  },
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
  const pendingCount = data.filter(d => d.status === "pending").length;

  const counts: Record<string, number> = {
    all: data.length,
    pending: data.filter(d => d.status === "pending").length,
    confirmed: data.filter(d => d.status === "confirmed").length,
    revision: data.filter(d => ["revision", "rejected"].includes(d.status)).length,
  };

  return (
    <PubLayout>
      <div className="py-4 space-y-4">
        {/* Pending alert */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <PackageCheck size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">{pendingCount} 份交付待您确认</p>
              <p className="text-xs text-amber-600 mt-0.5">请检查内容并确认或驳回</p>
            </div>
            <button
              onClick={() => setFilter("pending")}
              className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1.5 rounded-lg shrink-0"
            >
              查看
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap items-center">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === tab.key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-teal-300 hover:text-teal-600"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 ${
                  filter === tab.key
                    ? "opacity-70"
                    : tab.key === "pending"
                      ? "text-amber-500 font-black"
                      : "text-slate-400"
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-teal-600 px-3 py-1.5 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <RotateCcw size={13} />
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
            <button onClick={() => refetch()} className="mt-3 text-xs text-teal-600 underline">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
              <PackageCheck size={28} className="text-teal-300" />
            </div>
            <p className="text-base font-semibold text-slate-500">
              {filter === "all" ? "暂无交付记录" : "暂无此状态的交付"}
            </p>
            <p className="text-xs text-slate-400 mt-1">OPC 完成工作后会在此提交交付物</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? {
                label: item.status, badge: "bg-slate-100 text-slate-500",
                accent: "border-l-slate-300", cardBg: "bg-white", icon: Clock,
              };
              const StatusIcon = cfg.icon;
              const isPending = item.status === "pending";
              const isRejected = ["revision", "rejected"].includes(item.status);

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/pub/demands/${item.clientDemandId}?tab=delivery&id=${item.id}`)}
                  className={`w-full text-left rounded-2xl border border-l-4 ${cfg.accent} ${cfg.cardBg}
                    border-slate-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPending ? "bg-amber-100" : isRejected ? "bg-red-100" : "bg-teal-100"
                    }`}>
                      <StatusIcon size={18} className={
                        isPending ? "text-amber-600" : isRejected ? "text-red-500" : "text-teal-600"
                      } />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Demand breadcrumb */}
                      {item.demandTitle && (
                        <p className="text-xs text-slate-400 truncate mb-1.5">
                          {item.demandTitle}{item.demandNo && <span className="text-slate-300"> · {item.demandNo}</span>}
                        </p>
                      )}

                      {/* Status badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          <StatusIcon size={10} /> {cfg.label}
                        </span>
                        {isPending && (
                          <span className="text-[10px] font-bold text-amber-700 animate-pulse">· 需要您操作</span>
                        )}
                      </div>

                      {/* Title */}
                      <p className={`text-[15px] font-bold leading-snug mb-2 group-hover:text-teal-700 transition-colors
                        ${isRejected ? "text-red-800" : "text-slate-800"}`}>
                        {item.title}
                      </p>

                      {/* Rejected reason */}
                      {isRejected && item.rejectedReason && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5 mb-2 truncate">
                          驳回原因：{item.rejectedReason}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")} 提交
                        </span>
                        {item.createdByNickname && (
                          <span className="flex items-center gap-1">
                            <User size={10} /> {item.createdByNickname}
                          </span>
                        )}
                        {item.attachments?.length > 0 && (
                          <span className="text-teal-500 font-medium">{item.attachments.length} 个附件</span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 shrink-0 mt-1 transition-colors" />
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
