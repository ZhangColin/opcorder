import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wrench, Server } from "lucide-react";
import { CustomTool, ToolKind, ListResponse, tGet, tPost, tPatch, tDelete, formatDate } from "./api";
import {
  PageHeader, EmptyState, Loading, ErrorBanner, PrimaryButton, GhostButton,
  Modal, Field, inputCls,
} from "./shared";
import { Switch } from "@/components/ui/switch";

interface ToolForm { name: string; kind: ToolKind; config: string; }

export default function ToolMgmtModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<ToolKind>("custom");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ToolForm>({ name: "", kind: "custom", config: "{}" });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/custom-tools"],
    queryFn: () => tGet<ListResponse<CustomTool>>("/tools/custom-tools"),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/tools/custom-tools"] });

  const createMut = useMutation({
    mutationFn: () => {
      let config: any = {};
      try { config = form.config.trim() ? JSON.parse(form.config) : {}; }
      catch { throw new Error("配置不是合法 JSON"); }
      return tPost("/tools/custom-tools", { name: form.name.trim(), kind: form.kind, config, enabled: true });
    },
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: "已创建工具" }); },
    onError: (e: any) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => tPatch(`/tools/custom-tools/${id}`, { enabled }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => tDelete(`/tools/custom-tools/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "已删除" }); },
    onError: (e: any) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setForm({ name: "", kind: tab, config: "{}" }); setOpen(true); };

  const rows = (data?.items ?? []).filter((t) => t.kind === tab);

  return (
    <div>
      <PageHeader
        title="工具管理"
        desc="自定义工具与 MCP 服务，供智能体调用"
        action={<PrimaryButton onClick={openCreate}><Plus size={16} />创建工具</PrimaryButton>}
      />

      <div className="flex gap-1.5 mb-5">
        <GhostButton active={tab === "custom"} onClick={() => setTab("custom")}><Wrench size={14} />自定义工具</GhostButton>
        <GhostButton active={tab === "mcp"} onClick={() => setTab("mcp")}><Server size={14} />MCP 服务</GhostButton>
      </div>

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       rows.length === 0 ? <EmptyState text={tab === "custom" ? "还没有自定义工具" : "还没有 MCP 服务"} icon={<Wrench size={26} className="text-primary/40" />} /> : (
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50/60">
                <th className="px-5 py-3 font-semibold">名称</th>
                <th className="px-5 py-3 font-semibold">智能体引用</th>
                <th className="px-5 py-3 font-semibold">创建时间</th>
                <th className="px-5 py-3 font-semibold">启用</th>
                <th className="px-5 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-border/40 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-semibold text-slate-800">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500">{t.refCount ?? 0} 个</td>
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(t.createdAt)}</td>
                  <td className="px-5 py-3">
                    <Switch checked={t.enabled} onCheckedChange={(v) => toggleMut.mutate({ id: t.id, enabled: v })} />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { if (confirm(`确认删除「${t.name}」？`)) deleteMut.mutate(t.id); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={13} />删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          title="创建工具"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton disabled={!form.name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
                {createMut.isPending ? "创建中…" : "创建"}
              </PrimaryButton>
            </>
          }
        >
          <Field label="名称"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="类型">
            <div className="flex gap-2">
              <GhostButton active={form.kind === "custom"} onClick={() => setForm({ ...form, kind: "custom" })}><Wrench size={14} />自定义</GhostButton>
              <GhostButton active={form.kind === "mcp"} onClick={() => setForm({ ...form, kind: "mcp" })}><Server size={14} />MCP</GhostButton>
            </div>
          </Field>
          <Field label="配置 (JSON)" hint="工具的调用配置，需为合法 JSON">
            <textarea className={`${inputCls} min-h-[140px] resize-y font-mono text-xs`} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} placeholder='{"endpoint": "https://..."}' />
          </Field>
        </Modal>
      )}
    </div>
  );
}
