import { Clock, Users, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Demand } from "@workspace/api-client-react";
import { formatBudget } from "@/lib/utils";
import { DEMAND_TYPES, DEMAND_STATUSES } from "@/lib/constants";

export function DemandCard({ demand }: { demand: Demand }) {
  const [, navigate] = useLocation();
  const isUrgent = demand.isUrgent;
  const status = DEMAND_STATUSES[demand.status] || DEMAND_STATUSES.published;
  const type = DEMAND_TYPES[demand.type] || demand.type;
  
  const timeStr = demand.bidDeadline 
    ? formatDistanceToNow(new Date(demand.bidDeadline), { addSuffix: true, locale: zhCN })
    : "长期有效";

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
          <div className="flex gap-2 items-center">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${isUrgent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              {type}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${status.color}`}>
              {status.label}
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium flex items-center">
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
          <button
            className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center group-hover:shadow-md"
            onClick={(e) => { e.stopPropagation(); navigate(`/demands/${demand.id}`); }}
          >
            抢单
            <ArrowRight size={16} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
