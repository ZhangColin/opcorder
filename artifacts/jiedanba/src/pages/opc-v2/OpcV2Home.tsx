import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LayoutGrid, Search, FileText, Package, Wallet, Wrench,
  ChevronRight, Loader2, AlertCircle, Clock, CheckCircle2,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

interface DemandItem { id: number; title: string; status: string; tenderCount: number; }
interface TenderItem { id: number; outsourceDemandId: number; demandTitle: string; status: string; totalPrice: number | null; }
interface OrderItem { id: number; orderNo: string; demandTitle: string; status: string; }
interface TicketItem { id: number; title: string; status: string; isBlockingPayment: boolean; }
interface SettlementItem { id: number; title: string; status: string; amount: number; isLastItem: boolean; }

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  href: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, href, color, bgColor }: StatCardProps) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/20 transition-all text-left group"
    >
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-3xl font-black text-slate-800 group-hover:text-primary transition-colors">{value}</p>
        <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

interface TodoItem {
  id: string;
  label: string;
  href: string;
  urgent?: boolean;
}

const TENDER_STATUS_LABEL: Record<string, string> = {
  negotiating: "等待平台安排",
  quoted: "已报价·等审核",
  won: "已中标",
  lost: "未中标",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_contract: "待签约",
  executing: "执行中",
  warranty: "质保期",
  completed: "已完成",
  cancelled: "已取消",
};

const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "待处理",
  closed: "已关闭",
};

export default function OpcV2Home() {
  const [, navigate] = useLocation();

  const { data: tenderData, isLoading: loadingTenders } = useQuery<{ items: TenderItem[] }>({
    queryKey: ["v2-opc-tenders-home"],
    queryFn: () => v2Get("/tenders?limit=50"),
  });

  const { data: orderData, isLoading: loadingOrders } = useQuery<{ items: OrderItem[] }>({
    queryKey: ["v2-opc-orders-home"],
    queryFn: () => v2Get("/outsource-orders?limit=50"),
  });

  const { data: ticketData, isLoading: loadingTickets } = useQuery<TicketItem[]>({
    queryKey: ["v2-opc-tickets-home"],
    queryFn: () => v2Get("/tickets-b"),
  });

  const { data: settlementData, isLoading: loadingSettlements } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-settlements-home"],
    queryFn: () => v2Get("/settlement-plans"),
  });

  const tenders = tenderData?.items ?? [];
  const orders = orderData?.items ?? [];
  const tickets = ticketData ?? [];
  const settlements = settlementData ?? [];

  const activeTenders = tenders.filter(t => t.status === "negotiating" || t.status === "quoted");
  const pendingContractOrders = orders.filter(o => o.status === "pending_contract");
  const executingOrders = orders.filter(o => o.status === "executing" || o.status === "warranty");
  const openTickets = tickets.filter(t => t.status === "open");
  const blockingTickets = tickets.filter(t => t.status === "open" && t.isBlockingPayment);
  const pendingSettlements = settlements.filter(s => s.status === "pending");

  const isLoading = loadingTenders || loadingOrders || loadingTickets || loadingSettlements;

  const todos: TodoItem[] = [
    ...pendingContractOrders.map(o => ({
      id: `contract-${o.id}`,
      label: `【待签约】${o.demandTitle || o.orderNo} — 请确认合同`,
      href: `/opc/orders/${o.id}`,
      urgent: true,
    })),
    ...blockingTickets.map(t => ({
      id: `ticket-${t.id}`,
      label: `【阻款工单】${t.title} — 需回复`,
      href: `/opc/tickets/${t.id}`,
      urgent: true,
    })),
    ...activeTenders.map(t => ({
      id: `tender-${t.id}`,
      label: `【投标】${t.demandTitle ?? `需求 #${t.outsourceDemandId}`} — ${TENDER_STATUS_LABEL[t.status]}`,
      href: `/opc/tenders/${t.id}`,
      urgent: false,
    })),
    ...openTickets.filter(t => !t.isBlockingPayment).map(t => ({
      id: `ticket-np-${t.id}`,
      label: `【工单】${t.title} — ${TICKET_STATUS_LABEL[t.status]}`,
      href: `/opc/tickets/${t.id}`,
      urgent: false,
    })),
    ...pendingSettlements.map(s => ({
      id: `settle-${s.id}`,
      label: `【待收款】${s.title} — ¥${s.amount.toLocaleString()}`,
      href: `/opc/income`,
      urgent: false,
    })),
  ];

  return (
    <OpcV2Layout title="待办总览">
      <div className="py-6 space-y-8">

        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">欢迎回来 👋</h2>
          <p className="text-sm text-slate-500">以下是你当前的工作状态一览</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard icon={FileText} label="进行中投标" value={activeTenders.length} href="/opc/tenders" color="text-blue-600" bgColor="bg-blue-50" />
              <StatCard icon={Package}  label="待办订单"  value={pendingContractOrders.length + executingOrders.length} href="/opc/orders" color="text-primary" bgColor="bg-primary/10" />
              <StatCard icon={Wallet}   label="待收款项"  value={pendingSettlements.length} href="/opc/income" color="text-emerald-600" bgColor="bg-emerald-50" />
              <StatCard icon={Wrench}   label="开放工单"  value={openTickets.length} href="/opc/tickets" color="text-amber-600" bgColor="bg-amber-50" />
              <StatCard icon={AlertCircle} label="阻款工单" value={blockingTickets.length} href="/opc/tickets" color="text-red-600" bgColor="bg-red-50" />
              <StatCard icon={Search}   label="可抢需求"  value={0} href="/opc/demand-hall" color="text-violet-600" bgColor="bg-violet-50" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <Clock size={16} className="text-primary" />
                <h3 className="font-extrabold text-slate-800">待办事项</h3>
                <span className="ml-auto text-xs text-slate-400">{todos.length} 项</span>
              </div>

              {todos.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
                  <p className="text-sm font-bold text-slate-500">暂无待办事项 🎉</p>
                  <button
                    onClick={() => navigate("/opc/demand-hall")}
                    className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    前往需求大厅寻找机会
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {todos.map(todo => (
                    <li key={todo.id}>
                      <button
                        onClick={() => navigate(todo.href)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left group"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${todo.urgent ? "bg-red-400" : "bg-slate-300"}`} />
                        <span className={`flex-1 text-sm ${todo.urgent ? "font-bold text-slate-800" : "text-slate-600"}`}>
                          {todo.label}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
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
                { label: "我的订单", desc: "执行任务交付", href: "/opc/orders", icon: Package, color: "text-primary bg-primary/10" },
                { label: "我的收款", desc: "查看结算计划", href: "/opc/income", icon: Wallet, color: "text-emerald-600 bg-emerald-50" },
                { label: "工单", desc: "处理问题工单", href: "/opc/tickets", icon: Wrench, color: "text-amber-600 bg-amber-50" },
              ].map(item => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-primary/20 transition-all text-left group"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.color.split(" ")[1]} flex items-center justify-center shrink-0`}>
                    <item.icon size={17} className={item.color.split(" ")[0]} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </OpcV2Layout>
  );
}
