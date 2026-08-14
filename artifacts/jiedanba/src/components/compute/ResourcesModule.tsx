import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { ComputeResource } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TableShell, fmtDate,
} from "./shared";

const KEY = ["/compute/resources"];

type Form = { name: string; gpuModel: string; gpuCount: number; cpuCores: number; memoryGb: number; region: string };

function FormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>({ name: "", gpuModel: "A100", gpuCount: 1, cpuCores: 8, memoryGb: 32, region: "华东-1" });
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => cPost<ComputeResource>("/resources", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "已创建" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title="创建计算资源"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
            {mut.isPending ? "提交中…" : "创建"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="资源名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="GPU 型号">
          <input className={inputCls} value={form.gpuModel} onChange={(e) => setForm({ ...form, gpuModel: e.target.value })} />
        </Field>
        <Field label="GPU 数量">
          <input type="number" min={0} className={inputCls} value={form.gpuCount} onChange={(e) => setForm({ ...form, gpuCount: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="CPU 核数">
          <input type="number" min={1} className={inputCls} value={form.cpuCores} onChange={(e) => setForm({ ...form, cpuCores: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="内存 (GB)">
          <input type="number" min={1} className={inputCls} value={form.memoryGb} onChange={(e) => setForm({ ...form, memoryGb: Number(e.target.value) || 1 })} />
        </Field>
      </div>
      <Field label="地域">
        <input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function ResourcesModule() {
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ComputeResource[]>({
    queryKey: KEY,
    queryFn: () => cList<ComputeResource>("/resources"),
  });

  const del = useMutation({
    mutationFn: (id: number) => cDelete(`/resources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const list = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">计算资源</h2>
          <p className="text-xs text-slate-400 mt-0.5">专属 GPU 实例</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 购买资源
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无计算资源" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">GPU</th>
              <th className="px-4 py-3">CPU/内存</th>
              <th className="px-4 py-3">地域</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">到期时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{r.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.gpuCount ?? 0}×{r.gpuModel ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{r.cpuCores ?? 0}核 / {r.memoryGb ?? 0}G</td>
              <td className="px-4 py-3 text-slate-500">{r.region ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status ?? "running"} /></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(r.expiresAt)}</td>
              <td className="px-4 py-3 text-right">
                <GhostButton className="hover:!text-red-500" onClick={() => del.mutate(r.id)}><Trash2 size={13} /> 释放</GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
