import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Square, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cPatch, cDelete } from "./api";
import type { Notebook } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TabBar, TableShell, fmtDate, fmtRuntime,
} from "./shared";

const KEY = ["/compute/notebooks"];

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "creating", label: "创建中" },
  { value: "running", label: "运行中" },
  { value: "waiting", label: "等待中" },
  { value: "stopped", label: "已停止" },
  { value: "error", label: "错误" },
  { value: "completed", label: "已完成" },
];

type Form = { name: string; envType: string; image: string; resourceSpec: string; description: string };
const EMPTY: Form = { name: "", envType: "PyTorch 2.1", image: "", resourceSpec: "", description: "" };

function FormModal({ initial, editId, onClose }: { initial: Form; editId?: number; onClose: () => void }) {
  const [form, setForm] = useState<Form>(initial);
  const qc = useQueryClient();
  const { toast } = useToast();

  const mut = useMutation({
    mutationFn: () =>
      editId ? cPatch<Notebook>(`/notebooks/${editId}`, form) : cPost<Notebook>("/notebooks", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: editId ? "已更新" : "创建成功" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  return (
    <Modal
      title={editId ? "编辑开发环境" : "创建开发环境"}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
            {mut.isPending ? "提交中…" : editId ? "保存" : "创建"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="任务名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 my-notebook" />
      </Field>
      <Field label="环境类型">
        <input className={inputCls} value={form.envType} onChange={(e) => setForm({ ...form, envType: e.target.value })} placeholder="PyTorch 2.1 / TensorFlow" />
      </Field>
      <Field label="镜像">
        <input className={inputCls} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="镜像地址" />
      </Field>
      <Field label="资源规格">
        <input className={inputCls} value={form.resourceSpec} onChange={(e) => setForm({ ...form, resourceSpec: e.target.value })} placeholder="如 1×A100 / 8核32G" />
      </Field>
      <Field label="描述">
        <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function NotebooksModule() {
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<Notebook[]>({
    queryKey: KEY,
    queryFn: () => cList<Notebook>("/notebooks"),
    refetchInterval: 10000,
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: number; act: "start" | "stop" | "delete" }) =>
      act === "delete" ? cDelete(`/notebooks/${id}`) : cPost(`/notebooks/${id}/${act}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: v.act === "start" ? "已启动" : v.act === "stop" ? "已停止" : "已删除" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const list = (data ?? []).filter((n) => filter === "all" || n.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">模型开发</h2>
          <p className="text-xs text-slate-400 mt-0.5">交互式 Notebook 开发环境</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建环境
        </PrimaryButton>
      </div>

      <TabBar tabs={FILTERS} active={filter} onChange={setFilter} />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无开发环境，点击右上角创建" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">任务名称</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">环境类型</th>
              <th className="px-4 py-3">镜像</th>
              <th className="px-4 py-3">资源规格</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3">运行总时长</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((n) => (
            <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{n.name}</td>
              <td className="px-4 py-3"><StatusBadge status={n.status} /></td>
              <td className="px-4 py-3 text-slate-500">{n.envType ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{n.image ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{n.resourceSpec ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(n.createdAt)}</td>
              <td className="px-4 py-3 text-slate-500">{fmtRuntime(n.totalRuntimeSeconds)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  {n.status === "running" ? (
                    <GhostButton onClick={() => action.mutate({ id: n.id, act: "stop" })}><Square size={13} /> 停止</GhostButton>
                  ) : (
                    <GhostButton onClick={() => action.mutate({ id: n.id, act: "start" })}><Play size={13} /> 启动</GhostButton>
                  )}
                  <GhostButton onClick={() => setEditing(n)}><Pencil size={13} /> 编辑</GhostButton>
                  <GhostButton className="hover:!text-red-500" onClick={() => action.mutate({ id: n.id, act: "delete" })}><Trash2 size={13} /> 删除</GhostButton>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal initial={EMPTY} onClose={() => setCreating(false)} />}
      {editing && (
        <FormModal
          editId={editing.id}
          initial={{
            name: editing.name,
            envType: editing.envType ?? "",
            image: editing.image ?? "",
            resourceSpec: editing.resourceSpec ?? "",
            description: editing.description ?? "",
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
