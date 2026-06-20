import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, X, ChevronRight, Clock, ExternalLink, CheckCircle2,
  Network, Users2, Edit2, History, Zap,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useToast } from "@/hooks/use-toast";

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
  createdAt: string;
  updatedAt: string;
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
  publisher: "发单方",
  opc: "OPC",
  admin: "运营方",
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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full p-6 max-h-[90vh] overflow-y-auto ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminV2OutsourceDemandDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<OutsourceDemand | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showUpdateDetail, setShowUpdateDetail] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newDetail, setNewDetail] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);
  const [showSelectWinner, setShowSelectWinner] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<OutsourceDemand>(`/outsource-demands/${id}`);
      setDemand(d);
      const t = await v2Get<Tender[]>(`/tenders?outsourceDemandId=${id}`);
      setTenders(t);
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
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleUpdateDetail = async () => {
    if (!newDetail.trim()) { toast({ title: "请填写新的需求详情", variant: "destructive" }); return; }
    await act(async () => {
      await v2Post(`/outsource-demands/${id}/update-detail`, {
        detail: newDetail.trim(),
        editComment: updateComment.trim() || undefined,
      });
      setShowUpdateDetail(false);
      setNewDetail(""); setUpdateComment("");
    }, "需求详情已更新，已通知相关OPC");
  };

  const handleSelectWinner = async () => {
    if (selectedWinners.length === 0) { toast({ title: "请选择中标投标", variant: "destructive" }); return; }
    await act(async () => {
      await v2Post(`/tenders/batch-select-winners`, { tenderIds: selectedWinners });
      setShowSelectWinner(false);
      setSelectedWinners([]);
    }, "中标已选定，已通知OPC及生成订单");
  };

  const handleCancelTender = (tenderId: number) => act(
    () => v2Post(`/tenders/${tenderId}/cancel`, {}),
    "投标已取消，已通知OPC"
  );

  const handleClose = async () => {
    if (!closeReason.trim()) { toast({ title: "请填写关闭原因", variant: "destructive" }); return; }
    await act(async () => {
      await v2Post(`/outsource-demands/${id}/close`, { reason: closeReason.trim() });
      setShowCloseModal(false); setCloseReason("");
    }, "需求已关闭");
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="外包需求"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!demand) return <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="外包需求"><div className="text-center py-16 text-slate-400">需求不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canUpdateDetail = !["completed","closed"].includes(demand.status);
  const canSelectWinner = demand.status === "negotiating";
  const canClose = !["completed","closed"].includes(demand.status);
  const quotedTenders = tenders.filter(t => t.status === "quoted");

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
            <button onClick={() => setShowCloseModal(true)}
              className="px-3 py-1.5 text-xs font-bold border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
              关闭需求
            </button>
          )}
        </div>
      }
    >
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-50">
                  {demand.mode === "public" ? "公开抢单" : "指定邀请"}
                </span>
                {demand.isUrgent && <span className="text-xs font-bold text-red-500 flex items-center gap-0.5"><Zap size={10} />紧急</span>}
                <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-1">{demand.title}</h2>
              <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
                {demand.clientDemandId && <span>关联客户需求 #{demand.clientDemandId}</span>}
                {demand.expectedPriceMin != null && <span>预算 ¥{demand.expectedPriceMin.toLocaleString()}{demand.expectedPriceMax ? `~¥${demand.expectedPriceMax.toLocaleString()}` : "+"}</span>}
                <span>更新：{new Date(demand.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {canUpdateDetail && (
                <button onClick={() => { setNewDetail(demand.detail ?? ""); setShowUpdateDetail(true); }} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                  <Edit2 size={14} /> 更新需求详情
                </button>
              )}
              {canSelectWinner && quotedTenders.length > 0 && (
                <button onClick={() => setShowSelectWinner(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
                  <CheckCircle2 size={14} /> 选定中标
                </button>
              )}
            </div>
          </div>
        </div>

        {demand.detail && (
          <Section title="需求详情">
            <MarkdownContent content={demand.detail} />
          </Section>
        )}

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

      {showVersions && (
        <Modal title="历史版本" onClose={() => setShowVersions(false)} wide>
          {versions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无历史版本</p>
          ) : (
            <div className="space-y-4">
              {versions.map(v => (
                <div key={v.id} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary">版本 {v.versionNo}</span>
                    <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                  {(v.editedByRole || v.editedByNickname) && (
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <span className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium">{v.editedByRole ? VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole : ""}</span>
                      {v.editedByNickname && <span>{v.editedByNickname}</span>}
                      <span className="text-slate-400">修改</span>
                    </p>
                  )}
                  {v.editComment && <p className="text-xs text-slate-500 mb-2">备注：{v.editComment}</p>}
                  <div className="text-sm text-slate-600 max-h-40 overflow-y-auto">
                    <MarkdownContent content={v.detail} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showUpdateDetail && (
        <Modal title="更新共享需求详情" onClose={() => setShowUpdateDetail(false)} wide>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">更新后将通知所有未中标OPC查看最新详情，并生成新版本记录。</p>
            <textarea value={newDetail} onChange={e => setNewDetail(e.target.value)} rows={10}
              placeholder="输入新的需求详情（支持 Markdown）…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">更新说明（可选）</label>
              <input value={updateComment} onChange={e => setUpdateComment(e.target.value)} placeholder="本次更新的原因或摘要"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUpdateDetail(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleUpdateDetail} disabled={acting}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting ? "提交中…" : "发布更新"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSelectWinner && (
        <Modal title="选定中标 OPC" onClose={() => setShowSelectWinner(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">选择一个或多个中标OPC，确认后将自动生成接单订单并通知相关OPC。</p>
            <div className="space-y-2">
              {quotedTenders.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedWinners.includes(t.id) ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/30"
                }`}>
                  <input type="checkbox" checked={selectedWinners.includes(t.id)}
                    onChange={e => setSelectedWinners(e.target.checked ? [...selectedWinners, t.id] : selectedWinners.filter(i => i !== t.id))}
                    className="w-4 h-4 rounded border-slate-300 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{t.opcNickname}</p>
                    {t.totalPrice != null && <p className="text-xs text-slate-400">报价 ¥{t.totalPrice.toLocaleString()}</p>}
                  </div>
                </label>
              ))}
            </div>
            {quotedTenders.length === 0 && <p className="text-sm text-slate-400 text-center py-4">没有可选的已报价投标</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSelectWinner(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleSelectWinner} disabled={acting || selectedWinners.length === 0}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                {acting ? "处理中…" : `选定 ${selectedWinners.length > 0 ? selectedWinners.length + " 位" : ""} 中标`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCloseModal && (
        <Modal title="关闭外包需求" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">关闭后需求将不可再操作，请填写关闭原因。</p>
            <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} placeholder="关闭原因"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleClose} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "关闭中…" : "确认关闭"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
