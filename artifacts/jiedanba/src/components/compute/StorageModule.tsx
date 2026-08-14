import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { Storage } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TableShell, fmtDate,
} from "./shared";

const KEY = ["/compute/storages"];

type Form = { name: string; storageType: string; region: string; capacityGb: number };

function FormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>({ name: "", storageType: "file", region: "华东-1", capacityGb: 100 });
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => cPost<Storage>("/storages", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "已创建" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title="创建存储"
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
      <Field label="存储名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="存储类型">
        <select className={inputCls} value={form.storageType} onChange={(e) => setForm({ ...form, storageType: e.target.value })}>
          <option value="file">文件存储</option>
          <option value="object">对象存储</option>
        </select>
      </Field>
      <Field label="地域">
        <input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
      </Field>
      <Field label="容量 (GB)">
        <input type="number" min={1} className={inputCls} value={form.capacityGb} onChange={(e) => setForm({ ...form, capacityGb: Number(e.target.value) || 1 })} />
      </Field>
    </Modal>
  );
}

export default function StorageModule() {
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<Storage[]>({
    queryKey: KEY,
    queryFn: () => cList<Storage>("/storages"),
  });

  const del = useMutation({
    mutationFn: (id: number) => cDelete(`/storages/${id}`),
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
          <h2 className="text-lg font-black text-primary font-display">存储管理</h2>
          <p className="text-xs text-slate-400 mt-0.5">文件存储与对象存储</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建存储
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无存储" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">地域</th>
              <th className="px-4 py-3">已用/容量</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((s) => (
            <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{s.name}</td>
              <td className="px-4 py-3 text-slate-500">{s.storageType === "object" ? "对象存储" : "文件存储"}</td>
              <td className="px-4 py-3 text-slate-500">{s.region ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{s.usedGb ?? 0} / {s.capacityGb ?? 0} GB</td>
              <td className="px-4 py-3"><StatusBadge status={s.status ?? "active"} /></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(s.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <GhostButton className="hover:!text-red-500" onClick={() => del.mutate(s.id)}><Trash2 size={13} /> 删除</GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
