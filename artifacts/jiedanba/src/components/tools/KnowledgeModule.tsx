import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Database } from "lucide-react";
import { KnowledgeBase, ListResponse, tGet, tPost, tPatch, tDelete, formatDate } from "./api";
import {
  PageHeader, EmptyState, Loading, ErrorBanner, PrimaryButton, GhostButton,
  Modal, Field, inputCls, TagBadges,
} from "./shared";

interface KbForm { name: string; description: string; tags: string; sizeMb: string; docCount: string; }
const emptyForm: KbForm = { name: "", description: "", tags: "", sizeMb: "0", docCount: "0" };

export default function KnowledgeModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [form, setForm] = useState<KbForm>(emptyForm);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/knowledge-bases"],
    queryFn: () => tGet<ListResponse<KnowledgeBase>>("/tools/knowledge-bases"),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/tools/knowledge-bases"] });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        sizeMb: parseFloat(form.sizeMb) || 0,
        docCount: parseInt(form.docCount) || 0,
      };
      return editing ? tPatch(`/tools/knowledge-bases/${editing.id}`, payload) : tPost("/tools/knowledge-bases", payload);
    },
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: editing ? "已保存" : "已创建知识库" }); },
    onError: (e: any) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => tDelete(`/tools/knowledge-bases/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "已删除" }); },
    onError: (e: any) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (k: KnowledgeBase) => {
    setEditing(k);
    setForm({
      name: k.name, description: k.description ?? "", tags: (k.tags ?? []).join(", "),
      sizeMb: String(k.sizeMb ?? 0), docCount: String(k.docCount ?? 0),
    });
    setOpen(true);
  };

  const rows = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="知识库"
        desc="为你的智能体挂载专属知识"
        action={<PrimaryButton onClick={openCreate}><Plus size={16} />新建知识库</PrimaryButton>}
      />

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       rows.length === 0 ? <EmptyState text="还没有知识库" icon={<Database size={26} className="text-primary/40" />} /> : (
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50/60">
                <th className="px-5 py-3 font-semibold">名称</th>
                <th className="px-5 py-3 font-semibold">大小</th>
                <th className="px-5 py-3 font-semibold">标签</th>
                <th className="px-5 py-3 font-semibold">描述</th>
                <th className="px-5 py-3 font-semibold">修改时间</th>
                <th className="px-5 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id} className="border-t border-border/40 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-semibold text-slate-800">{k.name}</td>
                  <td className="px-5 py-3 text-slate-500">{(k.sizeMb ?? 0).toFixed(1)} MB<span className="text-slate-400"> · {k.docCount ?? 0} 文档</span></td>
                  <td className="px-5 py-3"><TagBadges tags={k.tags} /></td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{k.description || "—"}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(k.updatedAt ?? k.createdAt)}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(k)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-primary/5 hover:text-primary"><Pencil size={13} />编辑</button>
                    <button onClick={() => { if (confirm(`确认删除「${k.name}」？`)) deleteMut.mutate(k.id); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={13} />删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          title={editing ? "编辑知识库" : "新建知识库"}
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton disabled={!form.name.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? "保存中…" : "保存"}
              </PrimaryButton>
            </>
          }
        >
          <Field label="名称"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="描述"><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="标签" hint="多个标签用英文逗号分隔"><input className={inputCls} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="大小 (MB)"><input type="number" min="0" step="0.1" className={inputCls} value={form.sizeMb} onChange={(e) => setForm({ ...form, sizeMb: e.target.value })} /></Field>
            <Field label="文档数"><input type="number" min="0" className={inputCls} value={form.docCount} onChange={(e) => setForm({ ...form, docCount: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
