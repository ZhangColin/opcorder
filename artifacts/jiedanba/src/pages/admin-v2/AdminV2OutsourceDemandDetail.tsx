import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import {
  Loader2, X, ExternalLink, CheckCircle2,
  Edit2, History, Zap, AlertTriangle, Calendar, FileText,
  UserPlus, Search, ChevronDown, ChevronUp, Plus, Trash2,
  DollarSign, MessageSquare, Users, Bot,
} from "lucide-react";
import { AdminV2Layout, Section } from "@/components/admin-v2/AdminV2Layout";
import { CustomSelect } from "@/components/admin-v2/CustomSelect";
import { AgentChatPanel, type DocUpdate, type FormSuggestion } from "@/components/agent/AgentChatPanel";
import { BreakdownDisplay } from "@/components/shared/BreakdownDisplay";
import { FilePickerZone } from "@/components/shared/FilePickerZone";
import { useDemandTypeLabel } from "@/lib/catCategories";
import { v2Get, v2Post, v2Patch, v2Delete, uploadFile, STORAGE_BASE } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";

interface LatestVersion {
  id: number; versionNo: number; detail: string;
  attachments: Array<{ name: string; url: string }>; editComment: string | null; createdAt: string;
}
interface Milestone { name: string; deadline?: string; description?: string }
interface OutsourceDemand {
  id: number; demandNo: string; title: string; demandType: string | null;
  isUrgent: boolean; mode: string; opcLevel: string; clientDemandId: number | null;
  detail: string | null; status: string;
  expectedPriceMin: number | null; expectedPriceMax: number | null;
  deadline: string | null;
  milestones: Milestone[]; closedReason: string | null;
  createdBy: number; createdAt: string; updatedAt: string;
  latestVersion: LatestVersion | null; tenders?: Tender[];
}
interface Tender {
  id: number; opcId: number; opcNickname: string | null; status: string;
  totalPrice: number | null; quotedAt: string | null; createdAt: string;
  priceBreakdown?: Array<{ item: string; amount: number; note?: string }> | null;
}
interface VersionItem {
  id: number; versionNo: number; detail: string;
  attachments: Array<{ name: string; url: string }>;
  editedByNickname: string | null; editedByRole: "publisher" | "opc" | "admin" | null;
  editComment: string | null; createdAt: string;
}

const VERSION_ROLE_LABEL: Record<string, string> = { publisher: "发单方", opc: "OPC", admin: "运营方" };
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:       { label: "草稿", color: "bg-slate-100 text-slate-500" },
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

export default function AdminV2OutsourceDemandDetail({
  inlineId,
  initialTab,
  initialTenderId,
}: { inlineId?: number; initialTab?: "detail" | "tenders"; initialTenderId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();
  const { resolveDemandType } = useDemandTypeLabel();

  const [demand, setDemand] = useState<OutsourceDemand | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [activeTab, setActiveTab] = useState<"detail" | "tenders">(initialTab ?? "detail");
  const [expandedTenderId, setExpandedTenderId] = useState<number | null>(initialTenderId ?? null);
  const tenderRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [editDetail, setEditDetail] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSessionKey] = useState(() => `v2_outsource_detail_${id ?? Date.now()}`);
  const [editAttachments, setEditAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [editComment, setEditComment] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  const [milestoneEditMode, setMilestoneEditMode] = useState(false);
  const [editMilestones, setEditMilestones] = useState<Milestone[]>([]);
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [milestoneAgentOpen, setMilestoneAgentOpen] = useState(false);
  const [milestoneAgentSessionKey] = useState(() => `v2_opc_milestone_${id ?? Date.now()}`);

  const [showClose, setShowClose] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<{ id: number; nickname: string; email: string }[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  const [batchActing, setBatchActing] = useState(false);

  const [fullEditMode, setFullEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editOpcLevel, setEditOpcLevel] = useState("any");
  const [editPublishMode, setEditPublishMode] = useState<"public" | "invited">("public");
  const [editBudgetMin, setEditBudgetMin] = useState("");
  const [editBudgetMax, setEditBudgetMax] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editIsUrgent, setEditIsUrgent] = useState(false);
  const [catCategories, setCatCategories] = useState<{ id: number; code: string; name: string }[]>([]);
  const [fullEditAgentOpen, setFullEditAgentOpen] = useState(false);
  const [fullEditAgentSessionKey] = useState(() => `v2_opc_edit_${id ?? Date.now()}`);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<OutsourceDemand>(`/outsource-demands/${id}`);
      setDemand(d);
      markRead("outsource", id);
      if (d.tenders) setTenders(d.tenders);
      else {
        const t = await v2Get<Tender[]>(`/tenders?outsourceDemandId=${id}`);
        setTenders(Array.isArray(t) ? t : []);
      }
    } catch { setDemand(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  useEffect(() => {
    fetch(`${STORAGE_BASE}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: number; code: string; name: string }[]) => setCatCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialTenderId) setExpandedTenderId(initialTenderId);
  }, [initialTab, initialTenderId]);

  useEffect(() => {
    if (expandedTenderId && tenders.length > 0) {
      const el = tenderRefs.current[expandedTenderId];
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [expandedTenderId, tenders.length]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    setActing(true);
    try { const r = await fn(); toast({ title: msg }); return r; }
    catch (err: any) { toast({ title: "操作失败", description: err.message, variant: "destructive" }); return null; }
    finally { setActing(false); }
  };

  const handleSubmitEdit = async () => {
    if (!editDetail.trim()) { toast({ title: "请填写需求详情", variant: "destructive" }); return; }
    setActing(true);
    try {
      const newVer = await v2Post<LatestVersion>(`/outsource-demands/${id}/update-detail`, {
        detail: editDetail.trim(), attachments: editAttachments,
        editComment: editComment.trim() || undefined,
      });
      toast({ title: "需求详情已更新，已通知相关OPC" });
      setEditMode(false); setEditComment("");
      setDemand(prev => prev ? { ...prev, detail: newVer.detail, latestVersion: newVer } : prev);
    } catch (err: any) { toast({ title: "操作失败", description: err.message, variant: "destructive" }); }
    finally { setActing(false); }
  };

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setEditUploading(true);
    try { const url = await uploadFile(file); setEditAttachments(prev => [...prev, { name: file.name, url }]); }
    catch (err: any) { toast({ title: "上传失败", description: err.message, variant: "destructive" }); }
    finally { setEditUploading(false); if (e.target) e.target.value = ""; }
  };

  const handleSaveMilestones = async () => {
    setSavingMilestones(true);
    const saved = editMilestones.filter(m => m.name.trim());
    try {
      await v2Patch(`/outsource-demands/${id}`, { milestones: saved });
      toast({ title: "里程碑已保存" });
      setMilestoneEditMode(false);
      setDemand(prev => prev ? { ...prev, milestones: saved } : prev);
    } catch (err: any) { toast({ title: "保存失败", description: err.message, variant: "destructive" }); }
    finally { setSavingMilestones(false); }
  };

  const handleCancelTender = async (tenderId: number) => {
    const updated = await act(() => v2Post<Tender>(`/tenders/${tenderId}/cancel`, {}), "投标已取消，已通知OPC");
    if (updated) setTenders(prev => prev.map(t => t.id === tenderId ? { ...t, status: "lost" as const } : t));
  };

  const handleSelectWinnerSingle = async (tenderId: number) => {
    const result = await act(() => v2Post(`/tenders/${tenderId}/select-winner`, {}), "已选定中标，订单已生成，已通知OPC");
    if (result) {
      setDemand(prev => prev ? { ...prev, status: "executing" } : prev);
      setTenders(prev => prev.map(t => {
        if (t.id === tenderId) return { ...t, status: "won" as const };
        if (["negotiating", "quoted"].includes(t.status)) return { ...t, status: "lost" as const };
        return t;
      }));
    }
  };

  const handleBatchSelectWinners = async () => {
    const ids = [...batchSelected];
    if (ids.length === 0) return;
    setBatchActing(true);
    try {
      await v2Post("/tenders/batch-select-winners", { tenderIds: ids });
      toast({ title: `已选定 ${ids.length} 位中标 OPC，订单与合同已生成` });
      setShowBatchModal(false);
      setBatchSelected(new Set());
      const idSet = new Set(ids);
      setDemand(prev => prev ? { ...prev, status: "executing" } : prev);
      setTenders(prev => prev.map(t => {
        if (idSet.has(t.id)) return { ...t, status: "won" as const };
        if (["negotiating", "quoted"].includes(t.status)) return { ...t, status: "lost" as const };
        return t;
      }));
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setBatchActing(false);
    }
  };

  const handleClose = async () => {
    const result = await act(
      () => v2Post(`/outsource-demands/${id}/close`, { reason: closeReason.trim() || null }),
      "需求已关闭"
    );
    if (result) {
      setCloseReason(""); setShowClose(false);
      setDemand(prev => prev ? { ...prev, status: "closed" } : prev);
    }
  };

  const handlePublish = async () => {
    const result = await act(
      () => v2Patch<OutsourceDemand>(`/outsource-demands/${id}`, { status: "negotiating" }),
      "OPC 需求已发布，OPC 可开始投标"
    );
    if (result) setDemand(prev => prev ? { ...prev, status: "negotiating" } : prev);
  };

  const handleDelete = async () => {
    try {
      await v2Delete(`/outsource-demands/${id}`);
      toast({ title: "草稿已删除" });
      setShowDelete(false);
      if (inlineNav) inlineNav.back();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const handleInviteSearch = async () => {
    if (!inviteSearch.trim()) return;
    setInviteSearching(true);
    try {
      const rows = await v2Get<{ id: number; nickname: string; email: string }[]>(
        `/outsource-demands/opc-search?q=${encodeURIComponent(inviteSearch.trim())}`
      );
      setInviteResults(rows);
    } catch { setInviteResults([]); }
    finally { setInviteSearching(false); }
  };

  const handleAddInvitedOpc = async (opcId: number) => {
    setInviting(opcId);
    try {
      const opc = inviteResults.find(o => o.id === opcId);
      const tender = await v2Post<Tender>(`/outsource-demands/${id}/add-invited-opc`, { opcId });
      toast({ title: "已追加邀请，已发送通知" });
      markRead("tender", tender.id);
      setInviteResults(prev => prev.filter(o => o.id !== opcId));
      setTenders(prev => [...prev, { ...tender, opcNickname: opc?.nickname ?? null }]);
    } catch (err: any) { toast({ title: "邀请失败", description: err.message, variant: "destructive" }); }
    finally { setInviting(null); }
  };

  const loadVersions = async () => {
    try {
      const v = await v2Get<VersionItem[]>(`/outsource-demands/${id}/versions`);
      setVersions(v); setShowVersions(true);
    } catch { setVersions([]); setShowVersions(true); }
  };

  const enterFullEditMode = () => {
    if (!demand) return;
    setEditTitle(demand.title);
    setEditType(demand.demandType ?? "");
    setEditOpcLevel(demand.opcLevel ?? "any");
    setEditPublishMode((demand.mode === "invited" ? "invited" : "public") as "public" | "invited");
    setEditBudgetMin(demand.expectedPriceMin != null ? String(demand.expectedPriceMin) : "");
    setEditBudgetMax(demand.expectedPriceMax != null ? String(demand.expectedPriceMax) : "");
    setEditDeadline(demand.deadline ?? "");
    setEditIsUrgent(demand.isUrgent);
    const cur = demand.latestVersion?.detail ?? demand.detail ?? "";
    setEditDetail(cur);
    setEditAttachments(demand.latestVersion?.attachments?.map(a => ({ name: a.name, url: a.url })) ?? []);
    setEditComment("");
    setEditMilestones(demand.milestones?.length > 0 ? demand.milestones.map(m => ({ ...m })) : []);
    setFullEditMode(true);
  };

  const handleFullEditSave = async () => {
    setActing(true);
    try {
      const patchBody: Record<string, any> = {
        isUrgent: editIsUrgent,
        opcLevel: editOpcLevel,
        mode: editPublishMode,
      };
      if (editTitle.trim()) patchBody.title = editTitle.trim();
      if (editType) patchBody.demandType = editType;
      patchBody.expectedPriceMin = editBudgetMin ? parseFloat(editBudgetMin) : null;
      patchBody.expectedPriceMax = editBudgetMax ? parseFloat(editBudgetMax) : null;
      patchBody.deadline = editDeadline || null;
      await v2Patch(`/outsource-demands/${id}`, patchBody);

      const originalDetail = demand?.latestVersion?.detail ?? demand?.detail ?? "";
      if (editDetail.trim() !== originalDetail.trim()) {
        await v2Post(`/outsource-demands/${id}/update-detail`, {
          detail: editDetail.trim(),
          attachments: editAttachments,
          editComment: editComment.trim() || undefined,
        });
      }

      toast({ title: "需求已更新" });
      setFullEditMode(false);
      await load();
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleFullEditAgentFill = (suggestion: FormSuggestion) => {
    if (suggestion.title) setEditTitle(suggestion.title);
    if (suggestion.type) setEditType(suggestion.type);
    if (suggestion.opcLevel) setEditOpcLevel(suggestion.opcLevel);
    if (suggestion.description) setEditDetail(suggestion.description);
    if (suggestion.budgetMin != null) setEditBudgetMin(String(suggestion.budgetMin));
    if (suggestion.budgetMax != null) setEditBudgetMax(String(suggestion.budgetMax));
    if (suggestion.deadline) setEditDeadline(suggestion.deadline);
  };

  const handleMilestoneAgentFill = (suggestion: FormSuggestion) => {
    if (suggestion.milestones?.length) {
      const mapped: Milestone[] = suggestion.milestones.map(m => ({
        name: m.name,
        deadline: m.deadline ?? "",
        description: m.deliverableDesc ?? "",
      }));
      setEditMilestones(mapped);
      setMilestoneAgentOpen(false);
    }
  };

  const buildMilestoneAgentContext = () => {
    if (!demand) return "";
    const detail = demand.latestVersion?.detail ?? demand.detail ?? "";
    const deadlineStr = demand.deadline ?? "（未填写）";
    const typeStr = demand.demandType ? resolveDemandType(demand.demandType) : "（未分类）";
    const budgetStr = demand.expectedPriceMin != null
      ? `¥${demand.expectedPriceMin.toLocaleString()}${demand.expectedPriceMax ? ` ~ ¥${demand.expectedPriceMax.toLocaleString()}` : "+"}`
      : "面议";
    const msStr = editMilestones.filter(m => m.name.trim()).length > 0
      ? editMilestones.filter(m => m.name.trim()).map((m, i) =>
          `${i + 1}. ${m.name}${m.deadline ? `（截止 ${m.deadline}）` : ""}${m.description ? `\n   说明：${m.description}` : ""}`
        ).join("\n")
      : "（暂无里程碑）";
    return `---
【OPC需求信息】
标题：${demand.title}
类型：${typeStr}
预算：${budgetStr}
希望交付日期：${deadlineStr}

需求详情：
${detail || "（暂无详情）"}

当前已有里程碑：
${msStr}
---`;
  };

  if (loading) return (
    <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="OPC 需求">
      <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
    </AdminV2Layout>
  );
  if (!demand) return (
    <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="OPC 需求">
      <div className="text-center py-16 text-slate-400">需求不存在</div>
    </AdminV2Layout>
  );

  const cfg = STATUS_CFG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canEdit = !["completed", "closed"].includes(demand.status);
  const canPublish = demand.status === "draft";
  const canClose = demand.status === "negotiating";
  const currentDetail = demand.detail ?? demand.latestVersion?.detail ?? null;
  const currentAttachments = demand.latestVersion?.attachments ?? [];
  const quotedTenders = tenders.filter(t => t.status === "quoted");
  const canInvite = demand.mode === "invited" && ["draft", "negotiating"].includes(demand.status);

  return (
    <AdminV2Layout
      backHref="/admin/v2/outsource-demands"
      backLabel="OPC 需求"
    >
      {/* ── Full-edit 模式下的 AgentChatPanel ── */}
      <AgentChatPanel
        open={fullEditAgentOpen}
        onClose={() => setFullEditAgentOpen(false)}
        sessionKey={fullEditAgentSessionKey}
        sceneKey="v2_admin_opc_demand"
        agentMode="edit"
        linkedClientDemandId={demand?.clientDemandId ?? undefined}
        existingDemandData={{
          title: editTitle,
          type: editType,
          description: editDetail,
          budgetMin: editBudgetMin ? parseFloat(editBudgetMin) : null,
          budgetMax: editBudgetMax ? parseFloat(editBudgetMax) : null,
        }}
        onFillForm={handleFullEditAgentFill}
      />

      {/* ── 里程碑助手 AgentChatPanel ── */}
      <AgentChatPanel
        open={milestoneAgentOpen}
        onClose={() => setMilestoneAgentOpen(false)}
        sessionKey={milestoneAgentSessionKey}
        sceneKey="v2_admin_opc_milestone"
        agentContext={milestoneAgentOpen ? buildMilestoneAgentContext() : undefined}
        onFillForm={handleMilestoneAgentFill}
        welcomeOverride={{
          role: "assistant",
          content: "你好！我是里程碑规划助手。我已读取了当前需求的详情和现有里程碑，正在为您分析合理的拆分方案，请稍候…\n\n请先描述一下您对里程碑拆分有什么特别要求（例如阶段数量偏好、重点阶段、时间节点等），或者直接发送「开始」让我给出建议。",
          timestamp: new Date().toISOString(),
        }}
      />


      <div className="mt-6 space-y-4">

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-extrabold text-slate-800 leading-snug">{demand.title}</h2>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && !fullEditMode && (
                <button onClick={enterFullEditMode}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                  <Edit2 size={11} /> 编辑
                </button>
              )}
              {canPublish && (
                <>
                  <button onClick={() => setShowDelete(true)}
                    className="px-3 py-1.5 text-xs font-bold border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors">
                    删除草稿
                  </button>
                  <button onClick={handlePublish} disabled={acting}
                    className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {acting ? "发布中…" : "发布需求"}
                  </button>
                </>
              )}
              {canClose && (
                <button onClick={() => setShowClose(v => !v)}
                  className={`px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${showClose ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
                  关闭需求
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {demand.mode === "public" ? "公开抢单" : "指定邀请"}
            </span>
            {demand.opcLevel && demand.opcLevel !== "any" && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                OPC {demand.opcLevel === "A" ? "A 级" : demand.opcLevel === "B" ? "B 级及以上" : "C 级及以上"}
              </span>
            )}
            {demand.isUrgent && (
              <span className="text-xs font-bold text-red-500 flex items-center gap-0.5 bg-red-50 px-2 py-0.5 rounded-full">
                <Zap size={10} />紧急
              </span>
            )}
            {demand.demandType && (
              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {resolveDemandType(demand.demandType)}
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">预算范围</p>
              <p className="font-semibold text-slate-700">
                {demand.expectedPriceMin != null
                  ? `¥${demand.expectedPriceMin.toLocaleString()}${demand.expectedPriceMax ? ` ～ ¥${demand.expectedPriceMax.toLocaleString()}` : "+"}`
                  : "面议"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><Calendar size={10} />希望交付时间</p>
              <p className="font-semibold text-slate-700">
                {demand.deadline ? new Date(demand.deadline).toLocaleDateString("zh-CN") : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">投标数</p>
              <p className="font-semibold text-slate-700">{tenders.length} 个</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">创建时间</p>
              <p className="font-semibold text-slate-700">{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
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
        </div>

        {/* ── 删除草稿弹窗 ── */}
        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDelete(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-base font-extrabold text-slate-800">删除草稿</h4>
                <button onClick={() => setShowDelete(false)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-6">确定要删除这份草稿吗？删除后无法恢复。</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleDelete}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 关闭需求弹窗 ── */}
        {showClose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowClose(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h4 className="text-base font-extrabold text-slate-800 mb-1">确认关闭需求？</h4>
              <p className="text-sm text-slate-500 mb-5">关闭后需求将不可再操作，OPC 将无法继续投标。</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowClose(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleClose} disabled={acting}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                  {acting ? "关闭中…" : "确认关闭"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 全量编辑表单 ── */}
        {fullEditMode && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Edit2 size={13} className="text-primary" /> 编辑 OPC 需求
              </h3>
              <button onClick={() => setFullEditAgentOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-violet-300 text-violet-600 rounded-xl hover:bg-violet-50 transition-colors">
                <Bot size={12} /> 需求分析助手
              </button>
            </div>

            {/* 标题 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">需求标题</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800" />
            </div>

            {/* 类型 + OPC等级 + 紧急 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">需求类型</label>
                <CustomSelect
                  value={editType}
                  onChange={setEditType}
                  options={[{ value: "", label: "未分类" }, ...catCategories.map(c => ({ value: c.code, label: c.name }))]}
                  placeholder="请选择需求分类"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">OPC 等级要求</label>
                <CustomSelect
                  value={editOpcLevel}
                  onChange={setEditOpcLevel}
                  options={[
                    { value: "any", label: "不限" },
                    { value: "C", label: "C 级及以上" },
                    { value: "B", label: "B 级及以上" },
                    { value: "A", label: "A 级" },
                  ]}
                  placeholder="请选择等级"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">紧急需求</label>
                <button type="button" onClick={() => setEditIsUrgent(v => !v)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl border transition-colors w-full ${
                    editIsUrgent
                      ? "bg-red-50 border-red-300 text-red-600"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}>
                  <Zap size={13} className={editIsUrgent ? "text-red-500" : "text-slate-400"} />
                  {editIsUrgent ? "是，紧急需求" : "否，正常需求"}
                </button>
              </div>
            </div>

            {/* 发布模式 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">发布模式</label>
              <div className="flex gap-2">
                {(["public", "invited"] as const).map(val => (
                  <button key={val} type="button" onClick={() => setEditPublishMode(val)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                      editPublishMode === val
                        ? "bg-primary text-white border-primary"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}>
                    {val === "public" ? "公开抢单" : "邀请发布"}
                  </button>
                ))}
              </div>
              {editPublishMode === "invited" && (
                <p className="text-xs text-slate-400 mt-1.5">保存后可在需求详情页「邀请 OPC」面板中管理受邀人员。</p>
              )}
            </div>

            {/* 预算 + 希望交付时间 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">预算下限（元）</label>
                <input type="number" value={editBudgetMin} onChange={e => setEditBudgetMin(e.target.value)}
                  placeholder="留空表示面议"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">预算上限（元）</label>
                <input type="number" value={editBudgetMax} onChange={e => setEditBudgetMax(e.target.value)}
                  placeholder="留空表示不限"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">希望交付时间</label>
              <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700" />
            </div>

            {/* 需求详情 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">需求详情</label>
              <MarkdownEditor key={`full-edit-detail-${id}`} value={editDetail} onChange={setEditDetail} placeholder="输入需求详情，支持 Markdown 富文本…" />
              <div className="mt-2">
                <FilePickerZone
                  variant="inline"
                  uploading={editUploading}
                  onChange={f => handleEditFileUpload({ target: { files: [f] } } as any)}
                  files={editAttachments}
                  onRemove={i => setEditAttachments(prev => prev.filter((_, j) => j !== i))}
                />
              </div>
            </div>

            {/* 更新说明 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">更新说明（可选）</label>
              <input value={editComment} onChange={e => setEditComment(e.target.value)}
                placeholder="如有变更，填写说明后将通知相关 OPC"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <button onClick={handleFullEditSave} disabled={acting}
                className="bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors">
                {acting ? "保存中…" : "保存更新"}
              </button>
              <button onClick={() => setFullEditMode(false)}
                className="border border-slate-200 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
            </div>
          </div>
        )}

        {/* ── Tab 栏 ── */}
        {!fullEditMode && <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1">
          {(["detail", "tenders"] as const).map(tab => {
            const label = tab === "detail" ? "需求详情" : `投标（${tenders.length}）`;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
                  activeTab === tab ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
                }`}>
                {label}
              </button>
            );
          })}
        </div>}

        {/* ══════════════ TAB 1: 需求详情 ══════════════ */}
        {!fullEditMode && activeTab === "detail" && (
          <div className="space-y-4">

            {/* 需求详情内容 */}
            <Section
              title={`需求详情${demand.latestVersion ? ` · v${demand.latestVersion.versionNo}` : ""}`}
              icon={FileText}
              collapsible={false}
              actions={
                <div className="flex items-center gap-3">
                  {demand.latestVersion && (
                    <button onClick={loadVersions} className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors">
                      <History size={11} /> 历史版本
                    </button>
                  )}
                </div>
              }
            >
              <div className="pt-4">
                {editMode ? (
                  <div className="space-y-3">
                    <MarkdownEditor key={`detail-edit-${id}`} value={editDetail} onChange={setEditDetail} placeholder="输入需求详情，支持 Markdown 富文本…" />
                    <div className="flex items-center gap-3 flex-wrap">
                      <FilePickerZone
                        variant="inline"
                        uploading={editUploading}
                        onChange={f => handleEditFileUpload({ target: { files: [f] } } as any)}
                        files={editAttachments}
                        onRemove={i => setEditAttachments(prev => prev.filter((_, j) => j !== i))}
                      />
                    </div>
                    <input value={editComment} onChange={e => setEditComment(e.target.value)} placeholder="更新说明（可选，将通知相关OPC）"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <div className="flex gap-2">
                      <button onClick={handleSubmitEdit} disabled={acting}
                        className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                        {acting ? "提交中…" : "发布更新"}
                      </button>
                      <button onClick={() => { setEditMode(false); setEditComment(""); }}
                        className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
                    </div>
                  </div>
                ) : currentDetail ? (
                  <div>
                    <MarkdownContent content={currentDetail} />
                    {currentAttachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                        {currentAttachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                            <ExternalLink size={11} />{a.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">暂无需求详情</p>
                    {canEdit && (
                      <button onClick={() => { setEditDetail(""); setEditAttachments([]); setEditMode(true); }}
                        className="mt-2 text-xs text-primary hover:underline">点击填写</button>
                    )}
                  </div>
                )}
              </div>
            </Section>

            {/* 里程碑 */}
            <Section
              title={`里程碑${demand.milestones?.length > 0 ? `（${demand.milestones.length}）` : ""}`}
              icon={Calendar}
              collapsible={false}
              actions={canEdit ? (
                milestoneEditMode ? (
                  <button
                    onClick={() => setMilestoneAgentOpen(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-200 rounded-lg px-2 py-0.5 hover:bg-violet-50 transition-colors">
                    <Bot size={11} /> 里程碑助手
                  </button>
                ) : (
                  <button onClick={() => { setEditMilestones(demand.milestones?.length > 0 ? demand.milestones.map(m => ({ ...m })) : [{ name: "", deadline: "", description: "" }]); setMilestoneEditMode(true); }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Edit2 size={11} /> 编辑
                  </button>
                )
              ) : undefined}
            >
              <div className="pt-4">
                {milestoneEditMode ? (
                  <div className="space-y-3">
                    {editMilestones.map((m, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
                        <button onClick={() => setEditMilestones(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-2 right-2 text-slate-300 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-1">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</div>
                          里程碑 {i + 1}
                        </div>
                        <input value={m.name} onChange={e => setEditMilestones(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="名称（必填）"
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        <input type="date" value={m.deadline ?? ""} onChange={e => setEditMilestones(prev => prev.map((x, j) => j === i ? { ...x, deadline: e.target.value } : x))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-600" />
                        <textarea value={m.description ?? ""} onChange={e => setEditMilestones(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                          rows={2} placeholder="说明（可选）"
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                      </div>
                    ))}
                    <button onClick={() => setEditMilestones(prev => [...prev, { name: "", deadline: "", description: "" }])}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Plus size={12} /> 添加里程碑
                    </button>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSaveMilestones} disabled={savingMilestones}
                        className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                        {savingMilestones ? "保存中…" : "保存里程碑"}
                      </button>
                      <button onClick={() => setMilestoneEditMode(false)}
                        className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
                    </div>
                  </div>
                ) : demand.milestones?.length > 0 ? (
                  <div className="space-y-3">
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
                ) : (
                  <p className="text-sm text-slate-400">暂无里程碑{canEdit && <button onClick={() => { setEditMilestones([{ name: "", deadline: "", description: "" }]); setMilestoneEditMode(true); }} className="ml-2 text-primary hover:underline">添加</button>}</p>
                )}
              </div>
            </Section>

          </div>
        )}

        {/* ══════════════ TAB 2: 投标 ══════════════ */}
        {!fullEditMode && activeTab === "tenders" && (
          <div className="space-y-3">

            {/* 工具栏：追加邀请 + 批量选定中标 */}
            {(canInvite || demand.status === "negotiating") && (
              <div className="flex justify-end gap-2">
                {demand.status === "negotiating" && tenders.some(t => t.status === "quoted") && (
                  <button
                    onClick={() => { setBatchSelected(new Set()); setShowBatchModal(true); }}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Users size={12} /> 批量选定中标
                  </button>
                )}
                {canInvite && (
                  <button onClick={() => { setShowInvitePanel(v => !v); setInviteResults([]); setInviteSearch(""); }}
                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                      showInvitePanel ? "bg-primary text-white border-primary" : "border-primary/30 text-primary hover:bg-primary/5"
                    }`}>
                    <UserPlus size={12} /> 追加邀请
                  </button>
                )}
              </div>
            )}

            {showInvitePanel && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-xs text-slate-500 mb-3">搜索 OPC 用户昵称，追加到本需求的邀请列表。</p>
                <div className="flex gap-2 mb-3">
                  <input value={inviteSearch} onChange={e => setInviteSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleInviteSearch()}
                    placeholder="输入 OPC 昵称关键词"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                  <button onClick={handleInviteSearch} disabled={inviteSearching || !inviteSearch.trim()}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50">
                    {inviteSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} 搜索
                  </button>
                </div>
                {inviteResults.length > 0 && (
                  <div className="space-y-1.5">
                    {inviteResults.map(opc => {
                      const already = tenders.some(t => t.opcId === opc.id);
                      return (
                        <div key={opc.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{opc.nickname}</p>
                            <p className="text-xs text-slate-400">{opc.email}</p>
                          </div>
                          {already ? (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">已邀请</span>
                          ) : (
                            <button onClick={() => handleAddInvitedOpc(opc.id)} disabled={inviting === opc.id}
                              className="flex items-center gap-1 text-xs font-bold text-primary border border-primary/30 px-2.5 py-1 rounded-lg hover:bg-primary/5 disabled:opacity-50">
                              {inviting === opc.id ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />} 邀请
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {inviteResults.length === 0 && !inviteSearching && inviteSearch.trim() && (
                  <p className="text-xs text-slate-400 text-center py-2">未找到匹配的 OPC 用户</p>
                )}
              </div>
            )}

            {/* 投标人手风琴列表 */}
            {tenders.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">暂无投标</div>
            ) : (
              <div className="space-y-2">
                {tenders.map(t => {
                  const ts = TENDER_STATUS[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
                  const isExpanded = expandedTenderId === t.id;
                  const canSelectWinner = t.status === "quoted" && demand.status === "negotiating";
                  const canCancel = ["quoted", "negotiating"].includes(t.status) && demand.status === "negotiating";
                  return (
                    <div key={t.id} ref={el => { tenderRefs.current[t.id] = el; }}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      {/* 手风琴头部 */}
                      <button
                        onClick={() => setExpandedTenderId(isExpanded ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex items-center justify-center shrink-0">
                          {(t.opcNickname ?? "?")[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.opcNickname ?? "OPC"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.totalPrice != null && (
                              <span className="text-xs font-bold text-primary">¥{t.totalPrice.toLocaleString()}</span>
                            )}
                            {t.quotedAt && (
                              <span className="text-xs text-slate-400">报价于 {new Date(t.quotedAt).toLocaleDateString("zh-CN")}</span>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.color}`}>{ts.label}</span>
                        {isExpanded ? <ChevronUp size={15} className="text-slate-400 shrink-0" /> : <ChevronDown size={15} className="text-slate-400 shrink-0" />}
                      </button>

                      {/* 展开内容 */}
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                          {/* 报价明细 */}
                          {t.priceBreakdown && t.priceBreakdown.length > 0 && (
                            <div className="px-4 py-3 border-b border-slate-50">
                              <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><DollarSign size={11} />报价明细</p>
                              <BreakdownDisplay bd={t.priceBreakdown} totalPrice={t.totalPrice} />
                            </div>
                          )}

                          {/* 操作按钮 */}
                          {(canSelectWinner || canCancel) && (
                            <div className="px-4 py-3 flex gap-2 border-b border-slate-50">
                              {canSelectWinner && (
                                <button onClick={() => handleSelectWinnerSingle(t.id)} disabled={acting}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 disabled:opacity-50">
                                  <CheckCircle2 size={12} /> 选定中标
                                </button>
                              )}
                              {canCancel && (
                                <button onClick={() => handleCancelTender(t.id)} disabled={acting}
                                  className="px-3 py-1.5 border border-red-200 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 disabled:opacity-50">
                                  取消投标
                                </button>
                              )}
                            </div>
                          )}

                          {/* 沟通区 */}
                          <div className="px-4 py-4">
                            <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1">
                              <MessageSquare size={11} />与 {t.opcNickname ?? "OPC"} 的私密沟通
                            </p>
                            <DiscussionThread
                              parentType="v2_tender"
                              parentId={t.id}
                              placeholder={`与 ${t.opcNickname ?? "OPC"} 私密沟通…`}
                              readOnly={!["negotiating", "quoted"].includes(t.status)}
                              onAfterPost={() => markRead("tender", t.id)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── 历史版本对比 Modal ── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary" />
                <span className="text-sm font-extrabold text-slate-800">历史版本对比</span>
                {versions.length > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">当前 v{versions[0].versionNo}</span>
                )}
              </div>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            {versions.length <= 1 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">暂无更早的历史版本</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
                  <span className="text-xs text-slate-400 shrink-0 mr-1">选择历史版本：</span>
                  {versions.slice(1).map((v, i) => (
                    <button key={v.id} onClick={() => setSelectedVersionIdx(i)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                        selectedVersionIdx === i ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary"
                      }`}>
                      v{v.versionNo}{v.editedByRole ? ` · ${VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole}` : ""}
                    </button>
                  ))}
                </div>
                {(() => {
                  const hist = versions.slice(1)[selectedVersionIdx] ?? versions[1];
                  const curr = versions[0];
                  const renderPanel = (v: VersionItem, isCurrent: boolean) => (
                    <div className={`overflow-y-auto min-h-0 p-5 ${isCurrent ? "bg-blue-50/30" : ""}`}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          v{v.versionNo} {isCurrent ? "当前" : "历史"}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                        {v.editedByRole && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole}</span>}
                        {v.editedByNickname && <span className="text-xs text-slate-500">{v.editedByNickname}</span>}
                        {v.editComment && <span className="text-xs text-slate-400 italic">「{v.editComment}」</span>}
                      </div>
                      <MarkdownContent content={v.detail} />
                      {v.attachments?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                          {v.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                              <ExternalLink size={11} />{a.name}
                            </a>
                          ))}
                        </div>
                      )}
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
      {showBatchModal && demand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">批量选定中标</h3>
                <p className="text-xs text-slate-400 mt-0.5">勾选中标的 OPC，未勾选的已报价投标将自动标记为未中标</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
              {tenders.filter(t => t.status === "quoted").length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">暂无已报价的投标</p>
              ) : (
                tenders.filter(t => t.status === "quoted").map(t => (
                  <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={batchSelected.has(t.id)}
                      onChange={e => {
                        setBatchSelected(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(t.id) : next.delete(t.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 accent-green-600 shrink-0"
                    />
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex items-center justify-center shrink-0">
                      {(t.opcNickname ?? "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{t.opcNickname ?? "OPC"}</p>
                      {t.totalPrice != null && (
                        <p className="text-xs font-bold text-primary">¥{t.totalPrice.toLocaleString()}</p>
                      )}
                    </div>
                    {batchSelected.has(t.id) && (
                      <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                已选 {batchSelected.size} 位，其余 {tenders.filter(t => t.status === "quoted").length - batchSelected.size} 位将自动取消
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                  取消
                </button>
                <button
                  onClick={handleBatchSelectWinners}
                  disabled={batchSelected.size === 0 || batchActing}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {batchActing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  确认选定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent chat panel — edit mode */}
      <AgentChatPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        sessionKey={agentSessionKey}
        sceneKey="v2_demand_analysis"
        agentMode="edit"
        existingDemandData={{
          title: demand?.title,
          type: demand?.demandType ?? undefined,
          description: editDetail || currentDetail || undefined,
          budgetMin: demand?.expectedPriceMin,
          budgetMax: demand?.expectedPriceMax,
        }}
        onDocUpdate={(update) => {
          setEditDetail(update.description);
          if (!editMode) {
            setEditAttachments(currentAttachments.map(a => ({ name: a.name, url: a.url })));
            setEditMode(true);
          }
          setAgentOpen(false);
        }}
      />
    </AdminV2Layout>
  );
}
