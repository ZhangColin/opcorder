import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Square, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { TrainingJob } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TabBar, TableShell, fmtDate,
} from "./shared";

const KEY = ["/compute/training-jobs"];

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "等待中" },
  { value: "running", label: "运行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "stopped", label: "已停止" },
  { value: "submit_failed", label: "提交失败" },
];

type Form = {
  name: string; mode: string; image: string; resourceSpec: string;
  command: string; datasetPath: string; outputPath: string; description: string;
};
const EMPTY: Form = { name: "", mode: "custom", image: "", resourceSpec: "", command: "", datasetPath: "", outputPath: "", description: "" };

function FormModal({ onClose }: { onClose: () => void }) {
  const [modeTab, setModeTab] = useState<"custom" | "template">("custom");
  const [form, setForm] = useState<Form>(EMPTY);
  const qc = useQueryClient();
  const { toast } = useToast();

  const mut = useMutation({
    mutationFn: () => cPost<TrainingJob>("/training-jobs", { ...form, mode: modeTab }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "任务已提交" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "提交失败", description: e.message, variant: "destructive" }),
  });

  return (
    <Modal
      title="创建训练任务"
      wide
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
            {mut.isPending ? "提交中…" : "提交任务"}
          </PrimaryButton>
        </>
      }
    >
      <TabBar
        tabs={[{ value: "custom", label: "自定义" }, { value: "template", label: "模板" }]}
        active={modeTab}
        onChange={(v) => setModeTab(v as "custom" | "template")}
      />
      <Field label="任务名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 llama-finetune" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="镜像">
          <input className={inputCls} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="训练镜像" />
        </Field>
        <Field label="资源规格">
          <input className={inputCls} value={form.resourceSpec} onChange={(e) => setForm({ ...form, resourceSpec: e.target.value })} placeholder="如 4×A100" />
        </Field>
      </div>
      {modeTab === "custom" && (
        <Field label="启动命令">
          <textarea className={inputCls} rows={2} value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="python train.py ..." />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="数据集路径">
          <input className={inputCls} value={form.datasetPath} onChange={(e) => setForm({ ...form, datasetPath: e.target.value })} placeholder="/data/train" />
        </Field>
        <Field label="输出路径">
          <input className={inputCls} value={form.outputPath} onChange={(e) => setForm({ ...form, outputPath: e.target.value })} placeholder="/output" />
        </Field>
      </div>
      <Field label="描述">
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function TrainingModule() {
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<TrainingJob[]>({
    queryKey: KEY,
    queryFn: () => cList<TrainingJob>("/training-jobs"),
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: number; act: "stop" | "clone" | "delete" }) =>
      act === "delete" ? cDelete(`/training-jobs/${id}`) : cPost(`/training-jobs/${id}/${act}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: v.act === "stop" ? "已停止" : v.act === "clone" ? "已克隆" : "已删除" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const list = (data ?? []).filter((n) => filter === "all" || n.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">模型训练</h2>
          <p className="text-xs text-slate-400 mt-0.5">提交与管理训练任务</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建任务
        </PrimaryButton>
      </div>

      <TabBar tabs={FILTERS} active={filter} onChange={setFilter} />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无训练任务" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">任务名称</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">模式</th>
              <th className="px-4 py-3">镜像</th>
              <th className="px-4 py-3">资源规格</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((n) => (
            <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{n.name}</td>
              <td className="px-4 py-3"><StatusBadge status={n.status} /></td>
              <td className="px-4 py-3 text-slate-500">{n.mode === "template" ? "模板" : "自定义"}</td>
              <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{n.image ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{n.resourceSpec ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(n.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  {n.status === "running" && (
                    <GhostButton onClick={() => action.mutate({ id: n.id, act: "stop" })}><Square size={13} /> 停止</GhostButton>
                  )}
                  <GhostButton onClick={() => action.mutate({ id: n.id, act: "clone" })}><Copy size={13} /> 克隆</GhostButton>
                  <GhostButton className="hover:!text-red-500" onClick={() => action.mutate({ id: n.id, act: "delete" })}><Trash2 size={13} /> 删除</GhostButton>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
