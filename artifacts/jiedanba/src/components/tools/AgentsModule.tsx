import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Workflow, Plus, Search, Pencil, Trash2, Upload, Download, Copy, Tag,
} from "lucide-react";
import {
  Agent, AppType, CATEGORIES, ListResponse, tGet, tPost, tPatch, tDelete, formatDate,
} from "./api";
import {
  PageHeader, EmptyState, Loading, ErrorBanner, PrimaryButton, GhostButton,
  Modal, Field, inputCls, TagBadges, AppTypeBadge,
} from "./shared";

interface AgentForm {
  name: string;
  appType: AppType;
  description: string;
  tags: string;
  category: string;
}

const emptyForm: AgentForm = { name: "", appType: "agent", description: "", tags: "", category: "其他" };

export default function AgentsModule() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [appType, setAppType] = useState<"" | AppType>("");
  const [shareStatus, setShareStatus] = useState("");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);

  const [publishTarget, setPublishTarget] = useState<Agent | null>(null);
  const [price, setPrice] = useState("0");
  const [publishCategory, setPublishCategory] = useState("其他");
  const [publishTags, setPublishTags] = useState("");

  const qs = new URLSearchParams();
  if (appType) qs.set("appType", appType);
  if (shareStatus) qs.set("shareStatus", shareStatus);
  if (search.trim()) qs.set("search", search.trim());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/agents", appType, shareStatus, search],
    queryFn: () => tGet<ListResponse<Agent>>(`/tools/agents${qs.toString() ? `?${qs}` : ""}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/tools/agents"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        appType: form.appType,
        description: form.description.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        category: form.category,
      };
      if (editing) return tPatch(`/tools/agents/${editing.id}`, payload);
      return tPost(`/tools/agents`, payload);
    },
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      toast({ title: editing ? "已保存" : "已创建智能体" });
    },
    onError: (e: any) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => tDelete(`/tools/agents/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "已删除" }); },
    onError: (e: any) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const fen = Math.round(parseFloat(price || "0") * 100);
      return tPost(`/tools/agents/${publishTarget!.id}/publish`, {
        priceFenPerMonth: isNaN(fen) ? 0 : fen,
        category: publishCategory,
        tags: publishTags.split(",").map((t) => t.trim()).filter(Boolean),
      });
    },
    onSuccess: () => { invalidate(); setPublishTarget(null); toast({ title: "已上架到智能体市场" }); },
    onError: (e: any) => toast({ title: "上架失败", description: e.message, variant: "destructive" }),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: number) => tPost(`/tools/agents/${id}/unpublish`),
    onSuccess: () => { invalidate(); toast({ title: "已下架" }); },
    onError: (e: any) => toast({ title: "下架失败", description: e.message, variant: "destructive" }),
  });

  const templateMut = useMutation({
    mutationFn: (id: number) => tPost(`/tools/agents/${id}/publish-template`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/tools/templates"] }); invalidate(); toast({ title: "已发布为模板" }); },
    onError: (e: any) => toast({ title: "发布失败", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setEditorOpen(true); };
  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({
      name: a.name, appType: a.appType, description: a.description ?? "",
      tags: (a.tags ?? []).join(", "), category: a.category ?? "其他",
    });
    setEditorOpen(true);
  };
  const openPublish = (a: Agent) => {
    setPublishTarget(a);
    setPrice(a.priceFenPerMonth ? (a.priceFenPerMonth / 100).toString() : "0");
    setPublishCategory(a.category ?? "其他");
    setPublishTags((a.tags ?? []).join(", "));
  };

  const agents = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="智能体管理"
        desc="管理你创建的 Agent 与工作流应用"
        action={<PrimaryButton onClick={openCreate}><Plus size={16} />创建智能体</PrimaryButton>}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1.5">
          {([["", "全部"], ["agent", "Agent"], ["workflow", "工作流"]] as const).map(([v, l]) => (
            <GhostButton key={v} active={appType === v} onClick={() => setAppType(v)}>{l}</GhostButton>
          ))}
        </div>
        <span className="w-px h-6 bg-border/60 mx-1" />
        <div className="flex gap-1.5">
          {([["", "全部状态"], ["private", "未发布"], ["published", "已上架"], ["template", "模板"]] as const).map(([v, l]) => (
            <GhostButton key={v} active={shareStatus === v} onClick={() => setShareStatus(v)}>{l}</GhostButton>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称/描述"
            className="w-52 rounded-xl border border-border/60 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       agents.length === 0 ? <EmptyState text="还没有智能体，点击右上角创建一个吧" icon={<Bot size={26} className="text-primary/40" />} /> : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                  {a.appType === "agent" ? <Bot size={20} className="text-primary" /> : <Workflow size={20} className="text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 truncate">{a.name}</h3>
                    <AppTypeBadge appType={a.appType} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">ID: {a.id}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                  a.shareStatus === "published" ? "bg-green-50 text-green-600" :
                  a.shareStatus === "template" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {a.shareStatus === "published" ? "已上架" : a.shareStatus === "template" ? "模板" : "未发布"}
                </span>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] mb-3">{a.description || "暂无描述"}</p>
              <div className="mb-3"><TagBadges tags={a.tags} /></div>
              <p className="text-[11px] text-slate-400 mb-3">最新编辑：{formatDate(a.updatedAt ?? a.createdAt)}</p>
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/40">
                <IconAction icon={<Pencil size={14} />} label="编辑" onClick={() => openEdit(a)} />
                {a.shareStatus === "published"
                  ? <IconAction icon={<Download size={14} />} label="下架" onClick={() => unpublishMut.mutate(a.id)} />
                  : <IconAction icon={<Upload size={14} />} label="上架" onClick={() => openPublish(a)} />}
                <IconAction icon={<Copy size={14} />} label="发布为模板" onClick={() => templateMut.mutate(a.id)} />
                <IconAction icon={<Trash2 size={14} />} label="删除" danger
                  onClick={() => { if (confirm(`确认删除「${a.name}」？`)) deleteMut.mutate(a.id); }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <Modal
          title={editing ? "编辑智能体" : "创建智能体"}
          onClose={() => setEditorOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setEditorOpen(false)}>取消</GhostButton>
              <PrimaryButton disabled={!form.name.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? "保存中…" : "保存"}
              </PrimaryButton>
            </>
          }
        >
          <Field label="名称">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="给智能体起个名字" />
          </Field>
          <Field label="应用类型">
            <div className="flex gap-2">
              <GhostButton active={form.appType === "agent"} onClick={() => setForm({ ...form, appType: "agent" })}><Bot size={14} />Agent</GhostButton>
              <GhostButton active={form.appType === "workflow"} onClick={() => setForm({ ...form, appType: "workflow" })}><Workflow size={14} />工作流</GhostButton>
            </div>
          </Field>
          <Field label="描述">
            <textarea className={`${inputCls} min-h-[90px] resize-y`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述这个智能体的能力" />
          </Field>
          <Field label="标签" hint="多个标签用英文逗号分隔">
            <input className={inputCls} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="如：客服, 自动回复" />
          </Field>
          <Field label="分类">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </Modal>
      )}

      {/* Publish modal */}
      {publishTarget && (
        <Modal
          title={`上架「${publishTarget.name}」`}
          onClose={() => setPublishTarget(null)}
          footer={
            <>
              <GhostButton onClick={() => setPublishTarget(null)}>取消</GhostButton>
              <PrimaryButton disabled={publishMut.isPending} onClick={() => publishMut.mutate()}>
                {publishMut.isPending ? "上架中…" : "确认上架"}
              </PrimaryButton>
            </>
          }
        >
          <Field label="订阅价格（元/月）" hint="填 0 表示限时免费">
            <input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="分类">
            <select className={inputCls} value={publishCategory} onChange={(e) => setPublishCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="标签" hint="多个标签用英文逗号分隔">
            <input className={inputCls} value={publishTags} onChange={(e) => setPublishTags(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

function IconAction({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
        danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-primary/5 hover:text-primary"
      }`}
    >
      {icon}{label}
    </button>
  );
}
