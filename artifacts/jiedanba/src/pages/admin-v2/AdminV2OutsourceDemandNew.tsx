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
}

export default function AdminV2OutsourceDemandNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [publishMode, setPublishMode] = useState("open");
  const [clientDemandId, setClientDemandId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [detail, setDetail] = useState("");
  const [milestones, setMilestones] = useState<Array<{ title: string; dueDate: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const [clientDemands, setClientDemands] = useState<ClientDemand[]>([]);
  const [loadingDemands, setLoadingDemands] = useState(true);

  useEffect(() => {
    v2Get<{ items: ClientDemand[] }>("/client-demands?limit=100&status=executing")
      .then(d => setClientDemands(d.items ?? []))
      .catch(() => setClientDemands([]))
      .finally(() => setLoadingDemands(false));
  }, []);

  const handleImportDetail = () => {
    if (!clientDemandId) { toast({ title: "请先选择关联需求", variant: "destructive" }); return; }
    const cd = clientDemands.find(d => d.id === parseInt(clientDemandId));
    if (!cd) return;
    setTitle(`【外包】${cd.title}`);
    toast({ title: "已带入关联需求标题" });
  };

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
        publishMode,
        clientDemandId: clientDemandId ? parseInt(clientDemandId) : null,
        budgetMin: budgetMin ? parseFloat(budgetMin) : null,
        budgetMax: budgetMax ? parseFloat(budgetMax) : null,
        detail: detail.trim() || null,
        milestones: milestones.filter(m => m.title).map(m => ({ title: m.title, dueDate: m.dueDate || null })),
        status: asDraft ? "draft" : "open",
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
                  className="px-3 py-2 text-xs font-bold border border-primary/30 text-primary rounded-xl hover:bg-primary/5">
                  带入标题
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
              <select value={publishMode} onChange={e => setPublishMode(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="open">公开抢单</option>
                <option value="invite">指定邀请</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">预算下限 (¥)</label>
              <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">预算上限 (¥)</label>
              <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="0"
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
