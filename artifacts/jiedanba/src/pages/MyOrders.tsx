import { useState } from "react";
import { Link } from "wouter";
import { ClipboardList, ArrowRight, CheckCircle2 } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { ORDER_STATUSES } from "@/lib/constants";
import type { ListOrdersStatus } from "@workspace/api-client-react";

export default function MyOrders() {
  const [activeTab, setActiveTab] = useState<ListOrdersStatus | undefined>(undefined);
  
  const { data, isLoading } = useListOrders({ status: activeTab, limit: 20 });

  const tabs = [
    { id: undefined, label: "全部订单" },
    { id: "in_progress", label: "执行中" },
    { id: "pending_acceptance", label: "待验收" },
    { id: "completed", label: "已完成" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black font-display text-foreground mb-2 flex items-center gap-3">
            <ClipboardList className="text-primary" size={32} /> 我的订单
          </h1>
          <p className="text-muted-foreground font-medium">跟踪和管理您的所有交易订单</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id || 'all'}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 font-bold text-sm border-b-2 transition-all ${
              activeTab === tab.id 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-card rounded-2xl border border-border animate-pulse"></div>
          ))}
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-4">
          {data.items.map(order => {
            const status = ORDER_STATUSES[order.status] || ORDER_STATUSES.in_progress;
            
            return (
              <div key={order.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                      {order.orderNo}
                    </span>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold font-display text-foreground mb-2 group-hover:text-primary transition-colors">
                    {order.demandTitle}
                  </h3>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium">
                    <span>协作方: {order.publisherName || order.opcNickname}</span>
                    <span>截止: {order.deadline}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between md:flex-col md:items-end gap-4 shrink-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                  <div className="text-left md:text-right">
                    <span className="block text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">订单金额</span>
                    <span className="text-2xl font-black text-secondary">¥{order.amount.toLocaleString()}</span>
                  </div>
                  
                  <Link href={`/orders/${order.id}`} className="bg-primary/10 text-primary font-bold px-6 py-2.5 rounded-xl hover:bg-primary hover:text-white transition-all flex items-center text-sm">
                    查看详情 <ArrowRight size={16} className="ml-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-20 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="text-muted-foreground" size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">暂无相关订单</h3>
          <p className="text-muted-foreground">当前状态下没有查询到任何订单记录。</p>
        </div>
      )}
    </div>
  );
}
