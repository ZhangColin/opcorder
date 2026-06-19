import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, X, Trash2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";

interface ClientDemand {
  id: number;
  title: string;
  demandNo: string;
  status: string;
  demandType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  detail?: string | null;
  isUrgent?: boolean;
}

export default function AdminV2OutsourceDemandNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [mode, setMode] = useState<"public" | "invited">("public");
  const [clientDemandId, setClientDemandId] = useState("");
  const [expectedPriceMin, setExpectedPriceMin] = useState("");
  const [expectedPriceMax, setExpectedPriceMax] = useState("");
  const [detail, setDetail] = useState("");
  const [milestones, setMilestones] = useState<Array<{ title: string; dueDate: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const [opcSearch, setOpcSearch] = useState("");
  const [opcResults, setOpcResults] = useState<{ id: number; nickname: string; email: string }[]>([]);
  const [invitedOpcs, setInvitedOpcs] = useState<{ id: number; nickname: string }[]>([]);
  const [searchingOpc, setSearchingOpc] = useState(false);

  const [clientDemands, setClientDemands] = useState<ClientDemand[]>([]);
  const [loadingDemands, setLoadingDemands] = useState(true);

  useEffect(() => {
    v2Get<{ items: ClientDemand[] }>("/client-demands?limit=100&status=executing")
      .then(d => setClientDemands(d.items ?? []))
      .catch(() => setClientDemands([]))
      .finally(() => setLoadingDemands(false));
  }, []);

  const handleImportDetail = async () => {
    if (!clientDemandId) { toast({ title: "请先选择关联需求", variant: "destructive" }); return; }
    try {
      const cd = await v2Get<ClientDemand>(`/client-demands/${clientDemandId}`);
      setTitle(`【外包】${cd.title}`);
      if (cd.demandType) setDemandType(cd.demandType);
      if (cd.budgetMin != null) setExpectedPriceMin(String(cd.budgetMin));
      if (cd.budgetMax != null) setExpectedPriceMax(String(cd.budgetMax));
      if (cd.detail) setDetail(cd.detail);
      if (cd.isUrgent) setIsUrgent(true);
      toast({ title: "已带入关联需求内容", description: "已同步标题、类型、预算和详情" });
    } catch {
      toast({ title: "带入失败", description: "无法读取关联需求详情", variant: "destructive" });
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

  const addMilestone = () => setMilestones([...milestones, { title: "", dueDate: "" }]);
  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, j) => j !== i));
  const updateMilestone = (i: number, field: "title" | "dueDate", value: string) => {
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
        milestones: milestones.filter(m => m.title).map(m => ({ title: m.title, dueDate: m.dueDate || null })),
        invitedOpcIds: mode === "invited" && invitedOpcs.length > 0 ? invitedOpcs.map(o => o.id) : undefined,
      };
      const result = await v2Post<{ id: number }>("/outsource-demands", payload);
      toast({ title: asDraft ? "已保存草稿" : "外包需求已发布" });
      navigate(`/admin/v2/outsource-demands/${result.id}`);
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminV2Layout title="新建外包需求" backHref="/admin/v2/outsource-demands" backLabel="外包需求">
      <div className="mt-6 space-y-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-700">基本信息</h3>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">关联客户需求（可选）</label>
            <div className="flex gap-2">
              <select value={clientDemandId} onChange={e => setClientDemandId(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">不关联</option>
                {clientDemands.map(cd => (
                  <option key={cd.id} value={cd.id}>{cd.title} ({cd.demandNo})</option>
                ))}
              </select>
              {clientDemandId && (
                <button onClick={handleImportDetail}
                  className="px-3 py-2 text-xs font-bold border border-primary/30 text-primary rounded-xl hover:bg-primary/5 whitespace-nowrap">
                  带入内容
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">需求标题 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="外包需求标题"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">需求类型</label>
              <input value={demandType} onChange={e => setDemandType(e.target.value)} placeholder="如：营销策划、IT开发"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">发布模式 *</label>
              <select value={mode} onChange={e => setMode(e.target.value as "public" | "invited")}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="public">公开抢单</option>
                <option value="invited">指定邀请</option>
              </select>
            </div>
          </div>

          {mode === "invited" && (
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">邀请OPC（指定参与报价）</label>
              <div className="flex gap-2 mb-2">
                <input value={opcSearch} onChange={e => setOpcSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleOpcSearch(); } }}
                  placeholder="搜索OPC昵称…"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={handleOpcSearch} disabled={searchingOpc || !opcSearch.trim()}
                  className="px-3 py-2 text-xs font-bold border border-primary/30 text-primary rounded-xl hover:bg-primary/5 whitespace-nowrap disabled:opacity-50">
                  {searchingOpc ? "搜索中…" : "搜索"}
                </button>
              </div>
              {opcResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-2">
                  {opcResults.map(opc => (
                    <button key={opc.id} type="button" onClick={() => addInvitedOpc(opc)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0">
                      <span className="font-medium">{opc.nickname}</span>
                      <span className="text-xs text-slate-400">{opc.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {invitedOpcs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {invitedOpcs.map(opc => (
                    <span key={opc.id} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg">
                      {opc.nickname}
                      <button type="button" onClick={() => removeInvitedOpc(opc.id)} className="hover:text-red-500 ml-0.5"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">尚未邀请任何OPC，可搜索后点击添加</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">预算下限 (¥)</label>
              <input type="number" value={expectedPriceMin} onChange={e => setExpectedPriceMin(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">预算上限 (¥)</label>
              <input type="number" value={expectedPriceMax} onChange={e => setExpectedPriceMax(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20" />
            紧急需求
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">需求详情</h3>
          <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={8}
            placeholder="详细描述外包需求，支持 Markdown 格式…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">里程碑（可选）</h3>
            <button onClick={addMilestone} className="text-xs text-primary font-bold hover:text-primary/80">+ 添加里程碑</button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-slate-400">尚未添加里程碑</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={m.title} onChange={e => updateMilestone(i, "title", e.target.value)}
                    placeholder={`里程碑 ${i + 1}`}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <input type="date" value={m.dueDate} onChange={e => updateMilestone(i, "dueDate", e.target.value)}
                    className="w-36 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <button onClick={() => removeMilestone(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={() => handleSubmit(true)} disabled={submitting}
            className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            保存草稿
          </button>
          <button onClick={() => handleSubmit(false)} disabled={submitting}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            立即发布
          </button>
        </div>
      </div>
    </AdminV2Layout>
  );
}
