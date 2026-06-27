import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { Loader2, X, Trash2, Bot, ChevronDown, Check } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, STORAGE_BASE } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { AgentChatPanel, type FormSuggestion } from "@/components/agent/AgentChatPanel";
import { MarkdownEditor } from "@/components/MarkdownEditor";

interface ClientDemand {
  id: number;
  title: string;
  demandNo: string;
  status: string;
  demandType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isUrgent?: boolean;
  latestVersion?: { detail?: string | null; attachments?: Array<{ name: string; url: string }> } | null;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
      >
        {loading ? (
          <span className="text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />加载中…</span>
        ) : selected ? (
          <span className="text-slate-800 text-left truncate">{selected.label}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className={opt.value === value ? "text-primary font-medium" : "text-slate-700"}>{opt.label}</span>
              {opt.value === value && <Check size={13} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminV2OutsourceDemandNew() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [mode, setMode] = useState<"public" | "invited">("public");
  const [clientDemandId, setClientDemandId] = useState("");
  const [expectedPriceMin, setExpectedPriceMin] = useState("");
  const [expectedPriceMax, setExpectedPriceMax] = useState("");
  const [detail, setDetail] = useState("");
  const [milestones, setMilestones] = useState<Array<{ title: string; dueDate: string; description: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const [opcSearch, setOpcSearch] = useState("");
  const [opcResults, setOpcResults] = useState<{ id: number; nickname: string; email: string }[]>([]);
  const [invitedOpcs, setInvitedOpcs] = useState<{ id: number; nickname: string }[]>([]);
  const [searchingOpc, setSearchingOpc] = useState(false);

  const [clientDemands, setClientDemands] = useState<ClientDemand[]>([]);
  const [loadingDemands, setLoadingDemands] = useState(true);
  const [catCategories, setCatCategories] = useState<{ id: number; name: string }[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSessionKey] = useState(() => `v2_opc_new_${Date.now()}`);
  const [linkedClientDemandId, setLinkedClientDemandId] = useState<number | null>(null);

  useEffect(() => {
    v2Get<{ items: ClientDemand[] }>("/client-demands?limit=200")
      .then(d => setClientDemands((d.items ?? []).filter(c => c.status !== "completed" && c.status !== "closed")))
      .catch(() => setClientDemands([]))
      .finally(() => setLoadingDemands(false));
    fetch(`${STORAGE_BASE}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: number; name: string }[]) => setCatCategories(Array.isArray(data) ? data : []))
      .catch(() => setCatCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  const handleImportDetail = async () => {
    if (!clientDemandId) { toast({ title: "请先选择关联需求", variant: "destructive" }); return; }
    try {
      const cd = await v2Get<ClientDemand>(`/client-demands/${clientDemandId}`);
      setTitle(`【外包】${cd.title}`);
      if (cd.demandType) setDemandType(cd.demandType);
      if (cd.budgetMin != null) setExpectedPriceMin(String(cd.budgetMin));
      if (cd.budgetMax != null) setExpectedPriceMax(String(cd.budgetMax));
      if (cd.latestVersion?.detail) setDetail(cd.latestVersion.detail);
      if (cd.isUrgent) setIsUrgent(true);
      toast({ title: "已带入关联需求内容", description: "已同步标题、类型、预算和详情" });
    } catch {
      toast({ title: "带入失败", description: "无法读取关联需求详情", variant: "destructive" });
    }
  };

  const handleOpenAgent = () => {
    setLinkedClientDemandId(clientDemandId ? parseInt(clientDemandId) : null);
    setAgentOpen(true);
  };

  const handleAgentFillForm = (suggestion: FormSuggestion) => {
    if (suggestion.title) setTitle(suggestion.title);
    if (suggestion.type) setDemandType(suggestion.type);
    if (suggestion.description) setDetail(suggestion.description);
    if (suggestion.budgetMin != null) setExpectedPriceMin(String(suggestion.budgetMin));
    if (suggestion.budgetMax != null) setExpectedPriceMax(String(suggestion.budgetMax));
    if (suggestion.isUrgent != null) setIsUrgent(suggestion.isUrgent);
    if (suggestion.milestones?.length) {
      setMilestones(suggestion.milestones.map(m => ({ title: m.name, dueDate: m.deadline ?? "", description: m.deliverableDesc ?? "" })));
    }
  };

  const handleOpcSearch = async () => {
    if (!opcSearch.trim()) return;
    setSearchingOpc(true);
    try {
      const results = await v2Get<{ id: number; nickname: string; email: string }[]>(
        `/outsource-demands/opc-search?q=${encodeURIComponent(opcSearch.trim())}`
      );
      setOpcResults(results);
    } catch {
      setOpcResults([]);
    } finally {
      setSearchingOpc(false);
    }
  };

  const addInvitedOpc = (opc: { id: number; nickname: string }) => {
    if (!invitedOpcs.find(o => o.id === opc.id)) {
      setInvitedOpcs(prev => [...prev, { id: opc.id, nickname: opc.nickname }]);
    }
    setOpcSearch(""); setOpcResults([]);
  };

  const removeInvitedOpc = (id: number) => setInvitedOpcs(prev => prev.filter(o => o.id !== id));

  const addMilestone = () => setMilestones([...milestones, { title: "", dueDate: "", description: "" }]);
  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, j) => j !== i));
  const updateMilestone = (i: number, field: "title" | "dueDate" | "description", value: string) => {
    const arr = [...milestones];
    arr[i][field] = value;
    setMilestones(arr);
  };

  const handleSubmit = async (asDraft = false) => {
    if (!title.trim()) { toast({ title: "请填写需求标题", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        demandType: demandType || null,
        isUrgent,
        mode,
        clientDemandId: clientDemandId ? parseInt(clientDemandId) : null,
        expectedPriceMin: expectedPriceMin ? parseFloat(expectedPriceMin) : null,
        expectedPriceMax: expectedPriceMax ? parseFloat(expectedPriceMax) : null,
        detail: detail.trim() || null,
        milestones: milestones.filter(m => m.title).map(m => ({ name: m.title, deadline: m.dueDate || null, description: m.description || null })),
        invitedOpcIds: mode === "invited" && invitedOpcs.length > 0 ? invitedOpcs.map(o => o.id) : undefined,
        status: asDraft ? "draft" : "negotiating",
      };
      const result = await v2Post<{ id: number }>("/outsource-demands", payload);
      toast({ title: asDraft ? "已保存草稿" : "OPC 需求已发布" });
      if (inlineNav) inlineNav.push(`/admin/v2/outsource-demands/${result.id}`);
      else navigate(`/admin/v2/outsource-demands/${result.id}`);
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const clientDemandOptions = [
    { value: "", label: "不关联" },
    ...clientDemands.map(cd => ({ value: String(cd.id), label: `${cd.title}（${cd.demandNo}）` })),
  ];

  return (
    <>
      <AgentChatPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        sessionKey={agentSessionKey}
        sceneKey="v2_admin_opc_demand"
        agentMode="new"
        linkedClientDemandId={linkedClientDemandId}
        onFillForm={handleAgentFillForm}
        welcomeOverride={linkedClientDemandId != null ? {
          role: "assistant",
          content: `你好！我已关联到一个客户需求。请直接告诉我您想发布什么样的 OPC 需求，我会先读取关联需求的详情，再协助您整理发布内容。`,
          timestamp: new Date().toISOString(),
        } : undefined}
      />
      <AdminV2Layout backHref="/admin/v2/outsource-demands" backLabel="OPC 需求">
        <div className="space-y-5">

          {/* ── 基本信息 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full inline-block" />
              基本信息
            </h3>

            {/* 关联需求 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">关联客户需求（可选）</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <CustomSelect
                    value={clientDemandId}
                    onChange={setClientDemandId}
                    options={clientDemandOptions}
                    placeholder="不关联"
                    loading={loadingDemands}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  {clientDemandId && (
                    <button onClick={handleImportDetail}
                      className="px-3 py-2 text-xs font-bold border border-primary/30 text-primary rounded-xl hover:bg-primary/5 whitespace-nowrap transition-colors">
                      带入内容
                    </button>
                  )}
                  <button onClick={handleOpenAgent}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold border border-violet-300 text-violet-600 rounded-xl hover:bg-violet-50 whitespace-nowrap transition-colors">
                    <Bot size={12} />需求分析助手
                  </button>
                </div>
              </div>
            </div>

            {/* 需求标题 */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">需求标题 <span className="text-red-400">*</span></label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="请输入 OPC 需求标题…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            {/* 类型 + 模式 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">需求类型</label>
                <CustomSelect
                  value={demandType}
                  onChange={setDemandType}
                  options={catCategories.map(c => ({ value: c.code, label: c.name }))}
                  placeholder="请选择需求分类"
                  loading={loadingCats}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">发布模式 <span className="text-red-400">*</span></label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  {([["public", "公开抢单"], ["invited", "指定邀请"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMode(val)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        mode === val
                          ? "bg-primary text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      } ${val === "invited" ? "border-l border-slate-200" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 预算 + 紧急 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">预算下限 (¥)</label>
                <input
                  type="number"
                  value={expectedPriceMin}
                  onChange={e => setExpectedPriceMin(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">预算上限 (¥)</label>
                <input
                  type="number"
                  value={expectedPriceMax}
                  onChange={e => setExpectedPriceMax(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <div className="pb-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setIsUrgent(v => !v)}
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${isUrgent ? "bg-red-500" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isUrgent ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <span className={`text-sm font-medium transition-colors ${isUrgent ? "text-red-600" : "text-slate-500"}`}>
                    紧急需求
                  </span>
                </label>
              </div>
            </div>

            {/* 邀请 OPC */}
            {mode === "invited" && (
              <div className="pt-1 border-t border-slate-50">
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">邀请 OPC（指定参与报价）</label>
                <div className="flex gap-2 mb-3">
                  <input
                    value={opcSearch}
                    onChange={e => setOpcSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleOpcSearch(); } }}
                    placeholder="搜索 OPC 昵称…"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleOpcSearch}
                    disabled={searchingOpc || !opcSearch.trim()}
                    className="px-4 py-2 text-xs font-bold border border-primary/30 text-primary rounded-xl hover:bg-primary/5 whitespace-nowrap disabled:opacity-50 transition-colors"
                  >
                    {searchingOpc ? <Loader2 size={13} className="animate-spin" /> : "搜索"}
                  </button>
                </div>
                {opcResults.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm">
                    {opcResults.map(opc => (
                      <button
                        key={opc.id}
                        type="button"
                        onClick={() => addInvitedOpc(opc)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <span className="font-medium text-slate-800">{opc.nickname}</span>
                        <span className="text-xs text-slate-400">{opc.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {invitedOpcs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {invitedOpcs.map(opc => (
                      <span key={opc.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                        {opc.nickname}
                        <button type="button" onClick={() => removeInvitedOpc(opc.id)} className="hover:text-red-500 transition-colors">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">尚未邀请任何 OPC，可搜索后点击添加</p>
                )}
              </div>
            )}
          </div>

          {/* ── 需求详情 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full inline-block" />
              需求详情
            </h3>
            <MarkdownEditor
              value={detail}
              onChange={setDetail}
              placeholder="请详细描述 OPC 需求内容、工作范围、交付物规格、验收标准等…"
            />
          </div>

          {/* ── 里程碑 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                里程碑（可选）
              </h3>
              <button
                onClick={addMilestone}
                className="text-xs text-primary font-bold hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
              >
                + 添加里程碑
              </button>
            </div>
            {milestones.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">尚未添加里程碑，可点击右上角按钮添加</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
                    <button onClick={() => removeMilestone(i)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                      里程碑 {i + 1}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={m.title}
                        onChange={e => updateMilestone(i, "title", e.target.value)}
                        placeholder="名称（必填）"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                      <input
                        type="date"
                        value={m.dueDate}
                        onChange={e => updateMilestone(i, "dueDate", e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-slate-600"
                      />
                    </div>
                    <textarea
                      value={m.description}
                      onChange={e => updateMilestone(i, "description", e.target.value)}
                      placeholder="说明（可选）：描述该里程碑的任务、目标、验收标准等"
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 操作按钮 ── */}
          <div className="flex gap-3 justify-end py-2">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              保存草稿
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              立即发布
            </button>
          </div>

        </div>
      </AdminV2Layout>
    </>
  );
}
