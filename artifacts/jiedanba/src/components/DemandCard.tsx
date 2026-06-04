import { Clock, Users, ArrowRight, CheckCircle2, AlertTriangle, ShieldX } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Demand } from "@workspace/api-client-react";
import { formatBudget } from "@/lib/utils";
import { DEMAND_TYPES, DEMAND_STATUSES } from "@/lib/constants";

const LEVEL_RANK: Record<string, number> = { C: 1, B: 2, A: 3 };

export type OpcTrackCertMap = Map<number, { level: string; status: string }>;

export function DemandCard({
  demand,
  opcCerts,
}: {
  demand: Demand;
  opcCerts?: OpcTrackCertMap;
}) {
  const [, navigate] = useLocation();
  const isUrgent = demand.isUrgent;
  const status = DEMAND_STATUSES[demand.status] || DEMAND_STATUSES.published;
  const type = (demand as any).categoryName || DEMAND_TYPES[demand.type] || demand.type;

  const timeStr = demand.bidDeadline
    ? formatDistanceToNow(new Date(demand.bidDeadline), { addSuffix: true, locale: zhCN })
    : "长期有效";

  const catCategoryId: number | null = (demand as any).catCategoryId ?? null;
  const requiredTrackLevel: string | null = (demand as any).requiredTrackLevel ?? null;
  const needsTrackCert = catCategoryId && requiredTrackLevel && requiredTrackLevel !== "any";

  let eligibilityBadge: React.ReactNode = null;
  if (opcCerts && needsTrackCert && catCategoryId) {
    const cert = opcCerts.get(catCategoryId);
    if (!cert || cert.status !== "active") {
      const catName = (demand as any).categoryName ?? "";
      eligibilityBadge = (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
          <ShieldX size={10} />
          {catName ? `缺少${catName}认证` : "缺少赛道认证"}
        </span>
      );
    } else if ((LEVEL_RANK[cert.level] ?? 0) < (LEVEL_RANK[requiredTrackLevel!] ?? 0)) {
      eligibilityBadge = (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
          <AlertTriangle size={10} />
          认证等级不足
        </span>
      );
    } else {
      eligibilityBadge = (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
          <CheckCircle2 size={10} />
          已满足资质
        </span>
      );
    }
  }

  return (
    <div
      className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden cursor-pointer"
      onClick={() => navigate(`/demands/${demand.id}`)}
    >
      {isUrgent && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl">
          <div className="absolute top-6 -right-6 bg-destructive text-white text-[10px] font-bold py-1 px-8 transform rotate-45 text-center shadow-md">
            急单
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${isUrgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {type}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${status.color}`}>
              {status.label}
            </span>
            {eligibilityBadge}
          </div>
          <span className="text-muted-foreground text-xs font-medium flex items-center shrink-0 ml-2">
            <Clock size={14} className="mr-1" />
            {timeStr}
          </span>
        </div>

        <h4 className="text-lg font-bold text-foreground font-display leading-snug group-hover:text-primary transition-colors mb-3 line-clamp-2">
          {demand.title}
        </h4>

        <div className="flex flex-wrap gap-2 mb-6">
          {demand.skillTags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-medium border border-border/50">
              {tag}
            </span>
          ))}
          {(demand.skillTags?.length || 0) > 3 && (
            <span className="bg-muted/50 text-muted-foreground px-2 py-1 rounded-full text-xs font-medium">
              +{(demand.skillTags?.length || 0) - 3}
            </span>
          )}
        </div>
      </div>

      <div className="pt-5 border-t border-border flex items-end justify-between mt-auto">
        <div>
          <span className="block text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">项目预算</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-secondary">
              {formatBudget(demand.budgetMin, demand.budgetMax, demand.budget)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center text-xs text-muted-foreground font-medium">
            <Users size={14} className="mr-1" />
            {demand.bidCount || 0} 人申请
          </div>
          {demand.status === "published" && !(demand.bidDeadline && new Date(demand.bidDeadline) < new Date()) ? (
            <button
              className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center group-hover:shadow-md"
              onClick={(e) => { e.stopPropagation(); navigate(`/demands/${demand.id}`); }}
            >
              立即抢单
              <ArrowRight size={16} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </button>
          ) : demand.status === "published" ? (
            <span className="bg-muted text-muted-foreground px-4 py-2.5 rounded-xl text-sm font-bold">
              抢单已截止
            </span>
          ) : (
            <span className="bg-secondary/15 text-secondary px-4 py-2.5 rounded-xl text-sm font-bold">
              已成交
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
