import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import {
  Loader2, Users, Package, ShoppingCart, CreditCard, Wallet,
  ChevronRight, ChevronDown, Clock, AlertTriangle, CheckCircle2,
  FileText, ReceiptText, Tag,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

/* ─── Stats types ─────────────────────────────────────────── */
interface AdminOverview {
  channelA: { total: number; negotiating: number; quoting: number; pendingContract: number; executing: number; warranty: number; completed: number };
  channelB: { total: number; negotiating: number; executing: number; warranty: number; completed: number };
  orders:   { total: number; pendingContract: number; executing: number; warranty: number; completed: number };
  paymentStats:    { pendingReview: number; overdue: number };
  settlementStats: { pendingPay: number };
  recentDemands: Array<{ id: number; demandNo: string; title: string; status: string; publisherNickname: string | null; createdAt: string }>;
}

/* ─── Tree types ──────────────────────────────────────────── */
interface OrderNode {
  id: number; orderNo: string; status: string;
  openTicketBCount: number; hasBlockingTicket: boolean;
  pendingSettlements: number; paidSettlements: number; totalSettlementAmount: number;
}
interface TenderNode {
  id: number; opcNickname: string | null; status: string; totalPrice: number | null;
  orders: OrderNode[];
}
interface ODNode {
  id: number; demandNo: string; title: string; status: string;
  tenders: TenderNode[];
}
interface PPNode {
  id: number; itemNo: number | null; description: string | null; amount: number;
  status: string; dueDate: string | null; isOverdue: boolean;
}
interface CDNode {
  id: number; demandNo: string; title: string; status: string;
  publisherNickname: string | null; createdAt: string;
  contracts: Array<{ id: number; contractNo: string; status: string }>;
  paymentPlans: PPNode[];
  openTicketACount: number;
  outsourceDemands: ODNode[];
}

/* ─── Status maps ─────────────────────────────────────────── */
const CD_STATUS: Record<string, { label: string; color: string }> = {
  draft:            { label: "草稿",    color: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "沟通中",  color: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中",  color: "bg-amber-100 text-amber-700" },
  pending_contract: { label: "待签约",  color: "bg-orange-100 text-orange-700" },
  executing:        { label: "执行中",  color: "bg-green-100 text-green-700" },
  warranty:         { label: "质保中",  color: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成",  color: "bg-emerald-100 text-emerald-700" },
  closed:           { label: "已关闭",  color: "bg-red-100 text-red-500" },
};
const OD_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "草稿",   color: "bg-slate-100 text-slate-500" },
  open:      { label: "招募中", color: "bg-blue-100 text-blue-700" },
  negotiating:{ label: "谈判中",color: "bg-amber-100 text-amber-700" },
  executing: { label: "执行中", color: "bg-green-100 text-green-700" },
  completed: { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:    { label: "已关闭", color: "bg-red-100 text-red-500" },
};
const TENDER_STATUS: Record<string, { label: string; color: string }> = {
  negotiating: { label: "洽谈中", color: "text-amber-600" },
  quoted:      { label: "已报价", color: "text-blue-600" },
  won:         { label: "已中标", color: "text-green-600" },
  lost:        { label: "未中标", color: "text-slate-400" },
};
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending_contract: { label: "待签约", color: "text-orange-600" },
  executing:        { label: "执行中", color: "text-green-600" },
  warranty:         { label: "质保中", color: "text-teal-600" },
  completed:        { label: "已完成", color: "text-emerald-600" },
};

/* ─── Helpers ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ?? "text-blue-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function RiskBadge({ count, label, color }: { count: number; label: string; color: string }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      <AlertTriangle size={9} />{count} {label}
    </span>
  );
}

/* ─── Tree node component ─────────────────────────────────── */
function CDRow({ node, navigate }: { node: CDNode; navigate: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const cdCfg = CD_STATUS[node.status] ?? { label: node.status, color: "bg-slate-100 text-slate-500" };
  const overduePayments = node.paymentPlans.filter(p => p.isOverdue).length;
  const hasRisk = node.openTicketACount > 0 || overduePayments > 0;

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer ${hasRisk ? "border-l-4 border-l-red-400" : ""}`}
        onClick={() => setOpen(o => !o)}>
        <button className="text-slate-400 shrink-0">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cdCfg.color}`}>{cdCfg.label}</span>
        <span className="text-sm font-bold text-blue-900 flex-1 truncate">{node.title}</span>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <RiskBadge count={node.openTicketACount} label="开放工单" color="bg-red-100 text-red-600" />
          <RiskBadge count={overduePayments} label="逾期收款" color="bg-orange-100 text-orange-600" />
        </div>
        <span className="text-xs text-slate-400 font-mono shrink-0">{node.demandNo}</span>
        <button onClick={e => { e.stopPropagation(); navigate(`/admin/v2/client-demands/${node.id}`); }}
          className="text-xs text-primary font-bold hover:underline shrink-0">详情</button>
      </div>

      {open && (
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 space-y-3">
          {/* Publisher + meta */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            {node.publisherNickname && <span>发单方：{node.publisherNickname}</span>}
            <span className="flex items-center gap-1"><Clock size={10} />{new Date(node.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>

          {/* Contracts */}
          {node.contracts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1"><FileText size={10} />合同 ({node.contracts.length})</p>
              <div className="flex flex-wrap gap-2">
                {node.contracts.map(c => {
                  const isPending = c.status === "pending_sign";
                  return (
                    <button key={c.id} onClick={() => navigate(`/admin/v2/contracts-a/${c.id}`)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border hover:opacity-80 ${isPending ? "border-orange-300 text-orange-600 bg-orange-50" : "border-slate-200 text-slate-600 bg-white"}`}>
                      {c.contractNo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment plans */}
          {node.paymentPlans.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1"><ReceiptText size={10} />收款计划 ({node.paymentPlans.length})</p>
              <div className="flex flex-wrap gap-2">
                {node.paymentPlans.map(p => {
                  const label = p.description ?? `第${p.itemNo ?? 1}期`;
                  const color = p.status === "paid" ? "border-emerald-200 text-emerald-600 bg-emerald-50"
                    : p.isOverdue ? "border-red-300 text-red-600 bg-red-50"
                    : p.status === "awaiting_review" ? "border-amber-300 text-amber-600 bg-amber-50"
                    : "border-slate-200 text-slate-600 bg-white";
                  return (
                    <button key={p.id} onClick={() => navigate(`/admin/v2/payments-a/${p.id}`)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border hover:opacity-80 ${color}`}>
                      {label} ¥{Number(p.amount).toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outsource demands */}
          {node.outsourceDemands.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1"><Package size={10} />OPC 需求 ({node.outsourceDemands.length})</p>
              <div className="space-y-2">
                {node.outsourceDemands.map(od => {
                  const odCfg = OD_STATUS[od.status] ?? { label: od.status, color: "bg-slate-100 text-slate-500" };
                  const allOrders = od.tenders.flatMap(t => t.orders);
                  const totalBlockingOrders = allOrders.filter(o => o.hasBlockingTicket).length;
                  const totalOpenTickets = allOrders.reduce((a, o) => a + o.openTicketBCount, 0);
                  return (
                    <div key={od.id} className="bg-white border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${odCfg.color}`}>{odCfg.label}</span>
                        <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{od.title}</span>
                        <RiskBadge count={totalBlockingOrders} label="阻断工单" color="bg-red-100 text-red-600" />
                        <RiskBadge count={totalOpenTickets} label="开放工单" color="bg-orange-100 text-orange-600" />
                        <button onClick={() => navigate(`/admin/v2/outsource-demands/${od.id}`)}
                          className="text-[10px] text-primary font-bold hover:underline shrink-0">详情</button>
                      </div>
                      {/* Tenders / Orders */}
                      {od.tenders.length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-1">
                          {od.tenders.map(t => {
                            const tCfg = TENDER_STATUS[t.status] ?? { label: t.status, color: "text-slate-400" };
                            return (
                              <div key={t.id} className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Tag size={9} className="text-slate-400" />
                                  <span className={`text-[9px] font-bold ${tCfg.color}`}>{tCfg.label}</span>
                                  <span className="text-[10px] text-slate-500">{t.opcNickname ?? "OPC"}</span>
                                  {t.totalPrice != null && <span className="text-[10px] font-bold text-violet-600">¥{Number(t.totalPrice).toLocaleString()}</span>}
                                </div>
                                {t.orders.map(o => {
                                  const oCfg = ORDER_STATUS[o.status] ?? { label: o.status, color: "text-slate-400" };
                                  return (
                                    <button key={o.id} onClick={() => navigate(`/admin/v2/outsource-orders/${o.id}`)}
                                      className="ml-4 flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-primary group">
                                      <span className={`font-bold ${oCfg.color}`}>{oCfg.label}</span>
                                      <span className="font-mono text-slate-400 group-hover:text-primary">{o.orderNo}</span>
                                      {o.paidSettlements > 0 && (
                                        <span className="flex items-center gap-0.5 text-emerald-600">
                                          <CheckCircle2 size={8} />{o.paidSettlements}/{o.paidSettlements + o.pendingSettlements}期
                                        </span>
                                      )}
                                      {o.hasBlockingTicket && (
                                        <span className="flex items-center gap-0.5 text-red-500 font-bold">
                                          <AlertTriangle size={8} />阻断
                                        </span>
                                      )}
                                      {!o.hasBlockingTicket && o.openTicketBCount > 0 && (
                                        <span className="text-orange-500">{o.openTicketBCount}工单</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {node.outsourceDemands.length === 0 && node.contracts.length === 0 && node.paymentPlans.length === 0 && (
            <p className="text-xs text-slate-400">暂无关联数据</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function AdminV2Overview() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const go = (path: string) => { if (inlineNav) inlineNav.push(path); else navigate(path); };
  const cdIdFilter = useMemo(() => new URLSearchParams(window.location.search).get("clientDemandId"), []);
  const [tab, setTab] = useState<"stats" | "tree">(cdIdFilter ? "tree" : "stats");

  const [statsData, setStatsData] = useState<AdminOverview | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [treeData, setTreeData] = useState<CDNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treePage, setTreePage] = useState(1);
  const [treeHasMore, setTreeHasMore] = useState(true);

  useEffect(() => {
    v2Get<AdminOverview>("/overview/admin")
      .then(d => setStatsData(d))
      .catch(() => setStatsData(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadTree = useCallback(async (page = 1) => {
    setTreeLoading(true);
    try {
      const cdParam = cdIdFilter ? `&clientDemandId=${cdIdFilter}` : "";
      const data = await v2Get<CDNode[]>(`/overview/admin/tree?page=${page}&limit=15${cdParam}`);
      if (page === 1) setTreeData(data);
      else setTreeData(prev => [...prev, ...data]);
      setTreeHasMore(data.length === 15);
      setTreePage(page);
    } catch {
      setTreeData([]);
    } finally {
      setTreeLoading(false);
    }
  }, [cdIdFilter]);

  useEffect(() => {
    if (tab === "tree" && treeData.length === 0) loadTree(1);
  }, [tab]);

  return (
    <AdminV2Layout title="运营概览">
      {/* Tab selector */}
      <div className="flex gap-1 mt-4 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {([["stats", "统计概览"], ["tree", "跨通道全景"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === key ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Stats tab ── */}
      {tab === "stats" && (
        statsLoading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : !statsData ? (
          <div className="text-center py-16 text-slate-400 text-sm">数据加载失败</div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-blue-500" />
                <h2 className="text-sm font-bold text-slate-700">通道 A — 客户需求</h2>
                <span className="text-xs text-slate-400">共 {statsData.channelA.total} 个</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatCard label="沟通中" value={statsData.channelA.negotiating} />
                <StatCard label="报价中" value={statsData.channelA.quoting} />
                <StatCard label="待签约" value={statsData.channelA.pendingContract} accent="text-orange-600" />
                <StatCard label="执行中" value={statsData.channelA.executing} accent="text-green-600" />
                <StatCard label="质保中" value={statsData.channelA.warranty} accent="text-teal-600" />
                <StatCard label="已完成" value={statsData.channelA.completed} accent="text-emerald-600" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package size={15} className="text-violet-500" />
                <h2 className="text-sm font-bold text-slate-700">通道 B — OPC 需求</h2>
                <span className="text-xs text-slate-400">共 {statsData.channelB.total} 个</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard label="沟通中" value={statsData.channelB.negotiating} />
                <StatCard label="执行中" value={statsData.channelB.executing} accent="text-green-600" />
                <StatCard label="质保中" value={statsData.channelB.warranty} accent="text-teal-600" />
                <StatCard label="已完成" value={statsData.channelB.completed} accent="text-emerald-600" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart size={15} className="text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-700">外包订单</h2>
                <span className="text-xs text-slate-400">共 {statsData.orders.total} 单</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard label="待签约" value={statsData.orders.pendingContract} accent="text-orange-600" />
                <StatCard label="执行中" value={statsData.orders.executing} accent="text-green-600" />
                <StatCard label="质保中" value={statsData.orders.warranty} accent="text-teal-600" />
                <StatCard label="已完成" value={statsData.orders.completed} accent="text-emerald-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "收款待审核", val: statsData.paymentStats.pendingReview, href: "/admin/v2/payments-a", icon: CreditCard, iconColor: "text-amber-500", bg: "bg-amber-50", accent: "text-amber-600" },
                { label: "收款已逾期", val: statsData.paymentStats.overdue,       href: "/admin/v2/payments-a", icon: CreditCard, iconColor: "text-red-500",   bg: "bg-red-50",   accent: "text-red-600" },
                { label: "结算待打款", val: statsData.settlementStats.pendingPay,  href: "/admin/v2/payments-b", icon: Wallet,     iconColor: "text-violet-500",bg: "bg-violet-50",accent: "text-violet-600" },
              ].map(({ label, val, href, icon: Icon, iconColor, bg, accent }) => (
                <button key={label} onClick={() => go(href)}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-primary/20 hover:shadow-sm transition-all group">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className={`text-xl font-extrabold ${val > 0 ? accent : "text-blue-900"}`}>{val}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-primary ml-auto" />
                </button>
              ))}
            </div>

            {statsData.recentDemands.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700">最近客户需求</h3>
                  <button onClick={() => go("/admin/v2/client-demands")}
                    className="text-xs text-primary font-bold hover:text-primary/80 transition-colors">查看全部</button>
                </div>
                <div className="space-y-2">
                  {statsData.recentDemands.map(d => {
                    const cfg = CD_STATUS[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                    return (
                      <button key={d.id} onClick={() => go(`/admin/v2/client-demands/${d.id}`)}
                        className="w-full flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors group">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-sm text-slate-800 flex-1 truncate font-medium">{d.title}</span>
                        <span className="text-xs text-slate-400 shrink-0 font-mono">{d.demandNo}</span>
                        <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                          <Clock size={10} />{new Date(d.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-primary shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Tree tab ── */}
      {tab === "tree" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">以客户需求为根节点，展示完整双通道链路及风险标记</p>
            <button onClick={() => loadTree(1)} disabled={treeLoading}
              className="text-xs text-primary font-bold hover:text-primary/80 disabled:opacity-50">刷新</button>
          </div>

          {treeLoading && treeData.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : treeData.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">暂无数据</div>
          ) : (
            <>
              {treeData.map(node => (
                <CDRow key={node.id} node={node} navigate={go} />
              ))}
              {treeHasMore && (
                <div className="flex justify-center pt-2">
                  <button onClick={() => loadTree(treePage + 1)} disabled={treeLoading}
                    className="px-6 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    {treeLoading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                    加载更多
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AdminV2Layout>
  );
}
