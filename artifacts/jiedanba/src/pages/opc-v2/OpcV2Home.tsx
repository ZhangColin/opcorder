import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LayoutGrid, Search, FileText, Package, Wallet, Wrench,
  ChevronRight, Loader2, CheckCircle2, Clock, AlertCircle,
  RefreshCw,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

interface TenderItem {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
  status: string;
  totalPrice: number | null;
}

interface OrderItem {
  id: number;
  orderNo: string;
  demandTitle: string | null;
  status: string;
}

interface DeliverableItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  status: string;
}

interface TicketItem {
  id: number;
  title: string;
  status: string;
  isBlockingPayment: boolean;
}

interface SettlementItem {
  id: number;
  title: string;
  status: string;
  amount: number;
  isLastItem: boolean;
  isOverdue: boolean;
  isBlockingPayment: boolean;
}

interface DemandHallItem {
  id: number;
  status: string;
  mode: string;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  href: string;
  color: string;
  bgColor: string;
  highlight?: boolean;
}

function StatCard({ icon: Icon, label, value, href, color, bgColor, highlight }: StatCardProps) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all text-left group ${
        highlight && value > 0 ? "border-red-200 bg-red-50 hover:border-red-400" : "border-slate-100 hover:border-emerald-200"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className={`text-3xl font-black transition-colors ${highlight && value > 0 ? "text-red-600" : "text-slate-800 group-hover:text-emerald-700"}`}>{value}</p>
        <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

interface TodoItem {
  id: string;
  label: string;
  href: string;
  priority: 0 | 1 | 2;
}

export default function OpcV2Home() {
  const [, navigate] = useLocation();

  const { data: tenders = [], isLoading: loadingTenders } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders-home"],
    queryFn: () => v2Get("/tenders?limit=100"),
  });

  const { data: orderData, isLoading: loadingOrders } = useQuery<{ total: number; items: OrderItem[] }>({
    queryKey: ["v2-opc-orders-home"],
    queryFn: () => v2Get("/outsource-orders?limit=100"),
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery<TicketItem[]>({
    queryKey: ["v2-opc-tickets-home"],
    queryFn: () => v2Get("/tickets-b"),
  });

  const { data: settlements = [], isLoading: loadingSettlements } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-settlements-home"],
    queryFn: () => v2Get("/settlement-plans"),
  });

  const { data: deliverables = [], isLoading: loadingDelivs } = useQuery<DeliverableItem[]>({
    queryKey: ["v2-opc-deliverables-home"],
    queryFn: () => v2Get("/deliverables-b?limit=200"),
  });

  const { data: hallData } = useQuery<{ total: number; items: DemandHallItem[] }>({
    queryKey: ["v2-opc-hall-count-home"],
    queryFn: () => v2Get("/outsource-demands?status=negotiating&mode=public&limit=200"),
  });

  const orders = orderData?.items ?? [];

  const appliedDemandIds = new Set(tenders.map(t => t.outsourceDemandId));
  const hallItems = hallData?.items ?? [];
  const availableDemandsCount = hallItems.filter(d => !appliedDemandIds.has(d.id)).length;

  const activeTenders = tenders.filter(t => t.status === "negotiating" || t.status === "quoted");
  const wonTenders = tenders.filter(t => t.status === "won");
  const pendingContractOrders = orders.filter(o => o.status === "pending_contract");
  const executingOrders = orders.filter(o => o.status === "executing");
  const warrantyOrders = orders.filter(o => o.status === "warranty");
  const openTickets = tickets.filter(t => t.status === "open");

  const pendingSettlements = settlements.filter(s => s.status === "pending");
  const overdueSettlements = settlements.filter(s => s.status === "pending" && s.isOverdue);
  const rejectedDelivs = deliverables.filter(d => d.status === "revision");

  const isLoading = loadingTenders || loadingOrders || loadingTickets || loadingSettlements || loadingDelivs;

  const todos: TodoItem[] = [
    ...pendingContractOrders.map(o => ({
      id: `contract-${o.id}`,
      label: `【🔴 待签约】${o.demandTitle ?? o.orderNo} — 合同待确认`,
      href: `/opc/orders/${o.id}`,
      priority: 0 as const,
    })),
    ...overdueSettlements.map(s => ({
      id: `overdue-${s.id}`,
      label: `【🟠 收款逾期】${s.title} ¥${s.amount.toLocaleString()} — 已逾期`,
      href: `/opc/income/${s.id}`,
      priority: 1 as const,
    })),
    ...wonTenders.map(t => ({
      id: `won-${t.id}`,
      label: `【🟢 已中标】${t.demandTitle ?? `需求 #${t.outsourceDemandId}`} — 请前往我的订单签约`,
      href: `/opc/tenders/${t.id}`,
      priority: 1 as const,
    })),
    ...rejectedDelivs.map(d => ({
      id: `rejected-deliv-${d.id}`,
      label: `【🟡 交付被退回】${d.title} — 请修改后重新提交`,
      href: `/opc/orders/${d.outsourceOrderId}`,
      priority: 1 as const,
    })),
    ...openTickets.map(t => ({
      id: `ticket-${t.id}`,
      label: `【工单】${t.title} — 待回复`,
      href: `/opc/tickets/${t.id}`,
      priority: 2 as const,
    })),
    ...activeTenders.map(t => ({
      id: `tender-${t.id}`,
      label: `【投标${t.status === "quoted" ? "·已报价" : "·洽谈中"}】${t.demandTitle ?? `需求 #${t.outsourceDemandId}`}${!t.totalPrice ? " — 尚未提交报价" : ""}`,
      href: `/opc/tenders/${t.id}`,
      priority: 2 as const,
    })),
  ].sort((a, b) => a.priority - b.priority);

  return (
    <OpcV2Layout title="待办总览">
      <div className="py-6 space-y-8">

        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">欢迎回来 👋</h2>
          <p className="text-sm text-slate-500">以下是你当前需要处理的事项</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard icon={AlertCircle} label="待签约订单" value={pendingContractOrders.length} href="/opc/orders" color="text-red-600" bgColor="bg-red-50" highlight />
              <StatCard icon={Wrench} label="进行中工单" value={openTickets.length} href="/opc/tickets" color="text-amber-600" bgColor="bg-amber-50" highlight={openTickets.length > 0} />
              <StatCard icon={RefreshCw} label="被退回交付" value={rejectedDelivs.length} href="/opc/orders" color="text-amber-600" bgColor="bg-amber-50" highlight />
              <StatCard icon={FileText} label="进行中投标" value={activeTenders.length} href="/opc/tenders" color="text-blue-600" bgColor="bg-blue-50" />
              <StatCard icon={Package} label="执行中订单" value={executingOrders.length + warrantyOrders.length} href="/opc/orders" color="text-emerald-600" bgColor="bg-emerald-50" />
              <StatCard icon={Search} label="可报名需求" value={availableDemandsCount} href="/opc/demand-hall" color="text-violet-600" bgColor="bg-violet-50" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <Clock size={16} className="text-emerald-700" />
                <h3 className="font-extrabold text-slate-800">待办事项</h3>
                <span className="ml-auto text-xs text-slate-400">{todos.length} 项</span>
              </div>

              {todos.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
                  <p className="text-sm font-bold text-slate-500">暂无待办，太棒了！🎉</p>
                  {availableDemandsCount > 0 && (
                    <button
                      onClick={() => navigate("/opc/demand-hall")}
                      className="mt-4 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors"
                    >
                      需求大厅有 {availableDemandsCount} 条可报名需求
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {todos.map(todo => (
                    <li key={todo.id}>
                      <button
                        onClick={() => navigate(todo.href)}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left group ${
                          todo.priority === 0 ? "hover:bg-red-50" :
                          todo.priority === 1 ? "hover:bg-amber-50" :
                          "hover:bg-slate-50"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          todo.priority === 0 ? "bg-red-400" :
                          todo.priority === 1 ? "bg-amber-400" :
                          "bg-slate-300"
                        }`} />
                        <span className={`flex-1 text-sm ${
                          todo.priority === 0 ? "font-bold text-slate-800" :
                          todo.priority === 1 ? "font-semibold text-slate-700" :
                          "text-slate-600"
                        }`}>
                          {todo.label}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "需求大厅", desc: "发现新机会", href: "/opc/demand-hall", icon: Search, color: "text-violet-600 bg-violet-50" },
                { label: "我的投标", desc: "跟进报价进度", href: "/opc/tenders", icon: FileText, color: "text-blue-600 bg-blue-50" },
                { label: "我的订单", desc: "执行任务交付", href: "/opc/orders", icon: Package, color: "text-emerald-600 bg-emerald-50" },
                { label: "我的收款", desc: "查看结算计划", href: "/opc/income", icon: Wallet, color: "text-green-600 bg-green-50" },
                { label: "工单", desc: "处理问题工单", href: "/opc/tickets", icon: Wrench, color: "text-amber-600 bg-amber-50" },
              ].map(item => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-emerald-200 transition-all text-left group"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.color.split(" ")[1]} flex items-center justify-center shrink-0`}>
                    <item.icon size={17} className={item.color.split(" ")[0]} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </OpcV2Layout>
  );
}
