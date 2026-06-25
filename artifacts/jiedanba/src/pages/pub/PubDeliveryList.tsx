import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  PackageCheck, Loader2, AlertCircle, ChevronRight,
  Clock, CheckCircle2, XCircle, RotateCcw, Paperclip, User,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";
import { Pagination } from "@/components/pub/Pagination";

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

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:   { label: "待我确认", cls: "bg-amber-100 text-amber-700",  icon: Clock },
  confirmed: { label: "已确认",   cls: "bg-teal-100 text-teal-700",   icon: CheckCircle2 },
  revision:  { label: "已驳回",   cls: "bg-red-100 text-red-600",     icon: XCircle },
  rejected:  { label: "已驳回",   cls: "bg-red-100 text-red-600",     icon: XCircle },
};

const FILTER_TABS = [
  { key: "pending",   label: "待确认" },
  { key: "confirmed", label: "已确认" },
  { key: "revision",  label: "已驳回" },
  { key: "all",       label: "全部" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

const PAGE_SIZE = 10;

export default function PubDeliveryList() {
  const [filter, setFilter] = useState<FilterKey>(() =>
    new URLSearchParams(window.location.search).get("filter") === "all" ? "all" : "pending"
  );
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  const { data = [], isLoading, isError, refetch } = useQuery<DeliveryItem[]>({
    queryKey: ["pub-deliveries-a"],
    queryFn: () => v2Get("/deliverables-a"),
  });

  useEffect(() => { setPage(1); }, [filter]);

  const counts = {
    all:       data.length,
    pending:   data.filter(d => d.status === "pending").length,
    confirmed: data.filter(d => d.status === "confirmed").length,
    revision:  data.filter(d => ["revision", "rejected"].includes(d.status)).length,
  };

  const filtered = filter === "all" ? data : data.filter(d =>
    filter === "revision" ? ["revision", "rejected"].includes(d.status) : d.status === filter
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PubLayout>
      <div className="py-4 space-y-4">
        {counts.pending > 0 && filter !== "pending" && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <PackageCheck size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              <strong>{counts.pending}</strong> 份交付待您确认
            </p>
            <button onClick={() => setFilter("pending")}
              className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg shrink-0 transition-colors">
              查看
            </button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          {FILTER_TABS.map(tab => {
            const cnt = counts[tab.key];
            const active = filter === tab.key;
            return (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  active
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-teal-300 hover:text-teal-600"
                }`}>
                {tab.label}
                {cnt > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    active ? "bg-white/20 text-white" : tab.key === "pending" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                  }`}>{cnt}</span>
                )}
              </button>
            );
          })}
          <button onClick={() => refetch()}
            className="ml-auto text-slate-400 hover:text-teal-600 p-1.5 hover:bg-teal-50 rounded-lg transition-colors">
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
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <PackageCheck size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">
              {filter === "all" ? "暂无交付记录" : "暂无此状态的交付"}
            </p>
            <p className="text-xs text-slate-400 mt-1">OPC 完成工作后会在此提交交付物</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(item => {
                const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, cls: "bg-slate-100 text-slate-500", icon: Clock };
                const StatusIcon = cfg.icon;
                const isPending = item.status === "pending";
                const isRejected = ["revision", "rejected"].includes(item.status);

                return (
                  <button key={item.id}
                    onClick={() => navigate(`/pub/demands/${item.clientDemandId}?tab=delivery&id=${item.id}`)}
                    className={`w-full text-left bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group px-5 py-4 ${
                      isPending ? "border-amber-200 bg-amber-50/30" : "border-slate-100"
                    }`}>
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <p className={`text-[15px] font-bold leading-snug group-hover:text-teal-700 transition-colors flex-1 min-w-0 truncate ${
                        isRejected ? "text-red-800" : "text-slate-800"
                      }`}>
                        {item.title}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>
                        <StatusIcon size={10} /> {cfg.label}
                      </span>
                    </div>
                    {isRejected && item.rejectedReason && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-2.5 text-left">
                        <span className="font-bold">驳回原因：</span>{item.rejectedReason}
                      </p>
                    )}
                    <div className="flex items-end gap-6 text-xs flex-wrap">
                      {item.demandTitle && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">关联需求</p>
                          <p className="text-slate-600 truncate max-w-[12rem]">
                            {item.demandTitle}
                            {item.demandNo && <span className="text-slate-400"> · {item.demandNo}</span>}
                          </p>
                        </div>
                      )}
                      {item.createdByNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">提交人</p>
                          <p className="text-slate-600 flex items-center gap-1">
                            <User size={10} /> {item.createdByNickname}
                          </p>
                        </div>
                      )}
                      {item.attachments?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">附件</p>
                          <p className="text-slate-600 flex items-center gap-1">
                            <Paperclip size={10} /> {item.attachments.length} 个
                          </p>
                        </div>
                      )}
                      <div className="ml-auto">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">提交时间</p>
                        <p className="text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </PubLayout>
  );
}
