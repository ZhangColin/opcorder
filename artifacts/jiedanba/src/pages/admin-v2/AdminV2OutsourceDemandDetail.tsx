import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, X, ExternalLink, CheckCircle2,
  Edit2, History, Zap, AlertTriangle, Calendar,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";

interface LatestVersion {
  id: number;
  versionNo: number;
  detail: string;
  attachments: Array<{ name: string; url: string }>;
  editComment: string | null;
  createdAt: string;
}

interface Milestone {
  name: string;
  deadline?: string;
  description?: string;
}

interface OutsourceDemand {
  id: number;
  demandNo: string;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  mode: string;
  clientDemandId: number | null;
  detail: string | null;
  status: string;
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  milestones: Milestone[];
  closedReason: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  latestVersion: LatestVersion | null;
}

interface Tender {
  id: number;
  opcId: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  quotedAt: string | null;
  selectedAt: string | null;
  createdAt: string;
}

interface Version {
  id: number;
  versionNo: number;
  detail: string;
  createdAt: string;
  editedByNickname?: string | null;
  editedByRole?: "publisher" | "opc" | "admin" | null;
  editComment?: string | null;
}

const VERSION_ROLE_LABEL: Record<string, string> = {
  publisher: "发单方", opc: "OPC", admin: "运营方",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "招标中", color: "bg-blue-100 text-blue-700" },
  executing:   { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:    { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:   { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:      { label: "已关闭", color: "bg-red-100 text-red-500" },
};

const TENDER_STATUS: Record<string, { label: string; color: string }> = {
  negotiating: { label: "待报价", color: "bg-slate-100 text-slate-500" },
  quoted:      { label: "已报价", color: "bg-blue-100 text-blue-700" },
  won:         { label: "已中标", color: "bg-green-100 text-green-700" },
  lost:        { label: "已取消", color: "bg-red-100 text-red-500" },
};

const DEMAND_TYPE_LABEL: Record<string, string> = {
  website: "网站建设", app: "App开发", miniprogram: "小程序",
  ecommerce: "电商运营", design: "设计制作", marketing: "营销推广", other: "其他",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InlinePanel({ title, color = "bg-slate-50 border-slate-200", onClose, children }: {
  title: string; color?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
      </div>
      {children}
    </div>
  );
}

type Panel = "update_detail" | "select_winner" | "close" | null;

export default function AdminV2OutsourceDemandDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<OutsourceDemand | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>(null);

  const [newDetail, setNewDetail] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<OutsourceDemand & { tenders?: Tender[] }>(`/outsource-demands/${id}`);
      setDemand(d);
      // tenders come back embedded in the response
      if (d.tenders) {
        setTenders(d.tenders);
      } else {
        const t = await v2Get<Tender[]>(`/tenders?outsourceDemandId=${id}`);
        setTenders(Array.isArray(t) ? t : []);
      }
    } catch {
      setDemand(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const loadVersions = async () => {
    try {
      const v = await v2Get<Version[]>(`/outsource-demands/${id}/versions`);
      setVersions(v);
    } catch { setVersions([]); }
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setActing(true);
    try {
      await fn();
      toast({ title: msg });
      setActivePanel(null);
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const openPanel = (p: Panel, extra?: () => void) => {
    extra?.();
    setActivePanel(prev => (prev === p ? null : p));
  };

  const handleUpdateDetail = () => act(async () => {
    if (!newDetail.trim()) throw new Error("请填写新的需求详情");
    await v2Post(`/outsource-demands/${id}/update-detail`, {
      detail: newDetail.trim(),
      editComment: updateComment.trim() || undefined,
    });
    setUpdateComment("");
  }, "需求详情已更新，已通知相关OPC");

  const handleSelectWinner = () => act(async () => {
    if (selectedWinners.length === 0) throw new Error("请选择中标投标");
    await v2Post(`/tenders/batch-select-winners`, { tenderIds: selectedWinners });
    setSelectedWinners([]);
  }, "中标已选定，已通知OPC及生成订单");

  const handleCancelTender = (tenderId: number) => act(
    () => v2Post(`/tenders/${tenderId}/cancel`, {}),
    "投标已取消，已通知OPC"
  );

  const handleClose = () => act(async () => {
    if (!closeReason.trim()) throw new Error("请填写关闭原因");
    await v2Post(`/outsource-demands/${id}/close`, { reason: closeReason.trim() });
    setCloseReason("");
  }, "需求已关闭");

  if (loading) return <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="外包需求"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!demand) return <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="外包需求"><div className="text-center py-16 text-slate-400">需求不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canUpdateDetail = !["completed","closed"].includes(demand.status);
  const canSelectWinner = demand.status === "negotiating";
  const canClose = !["completed","closed"].includes(demand.status);
  const quotedTenders = tenders.filter(t => t.status === "quoted");
  const currentDetail = demand.detail ?? demand.latestVersion?.detail ?? null;

  return (
    <AdminV2Layout
      title={demand.title}
      backHref="/admin/v2/outsource-demands"
      backLabel="外包需求"
      actions={
        <div className="flex gap-2">
          <button onClick={() => { setShowVersions(true); loadVersions(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            <History size={13} /> 历史版本
          </button>
          {canClose && (
            <button onClick={() => openPanel("close")}
              className={`px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "close" ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
              关闭需求
            </button>
          )}
        </div>
      }
    >
      <div className="mt-6 space-y-4">

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {demand.mode === "public" ? "公开抢单" : "指定邀请"}
                </span>
                {demand.isUrgent && (
                  <span className="text-xs font-bold text-red-500 flex items-center gap-0.5 bg-red-50 px-2 py-0.5 rounded-full">
                    <Zap size={10} />紧急
                  </span>
                )}
                {demand.demandType && (
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {DEMAND_TYPE_LABEL[demand.demandType] ?? demand.demandType}
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-3">{demand.title}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500">
                {demand.clientDemandId && (
                  <div><span className="font-medium text-slate-400">关联客户需求：</span>#{demand.clientDemandId}</div>
                )}
                <div>
                  <span className="font-medium text-slate-400">预算范围：</span>
                  {demand.expectedPriceMin != null
                    ? `¥${demand.expectedPriceMin.toLocaleString()}${demand.expectedPriceMax ? ` ～ ¥${demand.expectedPriceMax.toLocaleString()}` : "+"}`
                    : "面议"}
                </div>
                <div><span className="font-medium text-slate-400">投标数：</span>{tenders.length} 个</div>
                <div><span className="font-medium text-slate-400">更新时间：</span>{new Date(demand.updatedAt).toLocaleDateString("zh-CN")}</div>
                <div><span className="font-medium text-slate-400">创建时间：</span>{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</div>
              </div>
              {demand.closedReason && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-600 mb-0.5">关闭原因</p>
                    <p className="text-xs text-red-500">{demand.closedReason}</p>
                  </div>
                </div>
              )}
              {demand.latestVersion && (
                <p className="mt-2 text-xs text-slate-400">
                  需求详情版本 v{demand.latestVersion.versionNo}
                  {demand.latestVersion.editComment ? `（${demand.latestVersion.editComment}）` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {canUpdateDetail && (
                <button onClick={() => openPanel("update_detail", () => setNewDetail(currentDetail ?? ""))} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "update_detail" ? "bg-primary/80 text-white" : "bg-primary text-white hover:bg-primary/90"}`}>
                  <Edit2 size={14} /> 更新需求详情
                </button>
              )}
              {canSelectWinner && quotedTenders.length > 0 && (
                <button onClick={() => openPanel("select_winner")} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "select_winner" ? "bg-green-700 text-white" : "bg-green-600 text-white hover:bg-green-700"}`}>
                  <CheckCircle2 size={14} /> 选定中标
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 关闭需求面板 ── */}
        {activePanel === "close" && (
          <InlinePanel title="关闭外包需求" color="bg-red-50 border-red-200" onClose={() => setActivePanel(null)}>
            <p className="text-sm text-slate-500 mb-3">关闭后需求将不可再操作，请填写关闭原因。</p>
            <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} placeholder="关闭原因"
              className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none bg-white mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleClose} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "关闭中…" : "确认关闭"}
              </button>
            </div>
          </InlinePanel>
        )}

        {/* ── 更新需求详情面板 ── */}
        {activePanel === "update_detail" && (
          <InlinePanel title="更新共享需求详情" color="bg-primary/5 border-primary/20" onClose={() => setActivePanel(null)}>
            <p className="text-xs text-slate-500 mb-3">更新后将通知所有未中标OPC查看最新详情，并生成新版本记录。</p>
            <div className="space-y-3">
              <MarkdownEditor
                key={`outsource-detail-${id}`}
                value={newDetail}
                onChange={setNewDetail}
                placeholder="输入新的需求详情，支持 Markdown 富文本…"
              />
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">更新说明（可选）</label>
                <input value={updateComment} onChange={e => setUpdateComment(e.target.value)} placeholder="本次更新的原因或摘要"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleUpdateDetail} disabled={acting}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                  {acting ? "提交中…" : "发布更新"}
                </button>
              </div>
            </div>
          </InlinePanel>
        )}

        {/* ── 需求详情内容 ── */}
        <Section title={`需求详情${demand.latestVersion ? ` (v${demand.latestVersion.versionNo})` : ""}`}>
          {currentDetail ? (
            <MarkdownContent content={currentDetail} />
          ) : (
            <p className="text-sm text-slate-400 italic py-2">暂无需求详情，可点击"更新需求详情"填写。</p>
          )}
          {demand.latestVersion?.attachments && demand.latestVersion.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-50">
              {demand.latestVersion.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                  <ExternalLink size={11} />{a.name}
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* ── 里程碑 ── */}
        {demand.milestones && demand.milestones.length > 0 && (
          <Section title={`里程碑（${demand.milestones.length} 个）`}>
            <div className="space-y-2">
              {demand.milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{m.name}</p>
                    {m.deadline && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={10} />截止 {new Date(m.deadline).toLocaleDateString("zh-CN")}
                      </p>
                    )}
                    {m.description && <p className="text-xs text-slate-500 mt-1">{m.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 选定中标面板 ── */}
        {activePanel === "select_winner" && (
          <InlinePanel title="选定中标 OPC" color="bg-green-50 border-green-200" onClose={() => setActivePanel(null)}>
            <p className="text-xs text-slate-500 mb-3">选择一个或多个中标OPC，确认后将自动生成接单订单并通知相关OPC。</p>
            <div className="space-y-2 mb-4">
              {quotedTenders.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedWinners.includes(t.id) ? "border-green-500 bg-green-50" : "border-slate-200 bg-white hover:border-green-300"
                }`}>
                  <input type="checkbox" checked={selectedWinners.includes(t.id)}
                    onChange={e => setSelectedWinners(e.target.checked ? [...selectedWinners, t.id] : selectedWinners.filter(i => i !== t.id))}
                    className="w-4 h-4 rounded border-slate-300 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{t.opcNickname}</p>
                    {t.totalPrice != null && <p className="text-xs text-slate-400">报价 ¥{t.totalPrice.toLocaleString()}</p>}
                  </div>
                </label>
              ))}
              {quotedTenders.length === 0 && <p className="text-sm text-slate-400 text-center py-4">没有可选的已报价投标</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleSelectWinner} disabled={acting || selectedWinners.length === 0}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                {acting ? "处理中…" : `选定 ${selectedWinners.length > 0 ? selectedWinners.length + " 位" : ""} 中标`}
              </button>
            </div>
          </InlinePanel>
        )}

        {/* ── 投标列表 ── */}
        <Section title={`投标列表（${tenders.length} 个）`}>
          {tenders.length === 0 ? (
            <p className="text-sm text-slate-400">暂无投标</p>
          ) : (
            <div className="space-y-3">
              {tenders.map(t => {
                const ts = TENDER_STATUS[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex items-center justify-center shrink-0">
                        {(t.opcNickname ?? "?")[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{t.opcNickname ?? "OPC"}</p>
                        {t.totalPrice != null && <p className="text-xs text-slate-400">报价 ¥{t.totalPrice.toLocaleString()}</p>}
                        {t.quotedAt && <p className="text-xs text-slate-400">报价于 {new Date(t.quotedAt).toLocaleDateString("zh-CN")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.color}`}>{ts.label}</span>
                      <button onClick={() => navigate(`/admin/v2/tenders/${t.id}`)}
                        className="text-xs text-primary font-bold border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                        查看详情
                      </button>
                      {t.status === "quoted" && (
                        <button onClick={() => handleCancelTender(t.id)} disabled={acting}
                          className="text-xs text-red-500 font-bold border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors disabled:opacity-50">
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="讨论">
          <DiscussionThread parentType="outsource_demand" parentId={id} placeholder="发布公共公告或讨论…" />
        </Section>
      </div>

      {/* ── 历史版本对比 Modal（只读查看） ── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary" />
                <span className="text-sm font-extrabold text-slate-800">历史版本对比</span>
                {versions.length > 0 && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">当前 v{versions[0].versionNo}</span>}
              </div>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
            </div>
            {versions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : versions.length <= 1 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">暂无更早的历史版本</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
                  <span className="text-xs text-slate-400 shrink-0 mr-1">选择历史版本：</span>
                  {versions.slice(1).map((v, i) => (
                    <button key={v.id} onClick={() => setSelectedVersionIdx(i)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${selectedVersionIdx === i ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary"}`}>
                      v{v.versionNo}{v.editedByRole ? ` · ${VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole}` : ""}
                    </button>
                  ))}
                </div>
                {(() => {
                  const hist = versions.slice(1)[selectedVersionIdx] ?? versions[1];
                  const curr = versions[0];
                  const renderPanel = (v: Version, isCurrent: boolean) => (
                    <div className={`overflow-y-auto min-h-0 p-5 ${isCurrent ? "bg-blue-50/30" : ""}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          v{v.versionNo} {isCurrent ? "当前" : "历史"}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                      {(v.editedByRole || v.editedByNickname) && (
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-600 rounded px-1 py-0.5 font-medium">{v.editedByRole ? VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole : ""}</span>
                          {v.editedByNickname && <span>{v.editedByNickname}</span>}
                          <span className="text-slate-400">修改</span>
                        </p>
                      )}
                      <MarkdownContent content={v.detail} />
                    </div>
                  );
                  return (
                    <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-slate-100" style={{ overflow: "hidden" }}>
                      {renderPanel(hist, false)}
                      {renderPanel(curr, true)}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </AdminV2Layout>
  );
}
