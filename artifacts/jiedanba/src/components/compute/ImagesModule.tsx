import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { ImageItem } from "./types";
import {
  Card, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TableShell, fmtDate, fmtSize,
} from "./shared";

const KEY = ["/compute/images"];

type Form = { name: string; tag: string; region: string; source: string; description: string };

function FormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>({ name: "", tag: "latest", region: "华东-1", source: "custom", description: "" });
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => cPost<ImageItem>("/images", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "已创建" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title="创建镜像"
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
      <Field label="镜像名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="标签 Tag">
          <input className={inputCls} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
        </Field>
        <Field label="来源">
          <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="custom">自定义</option>
            <option value="official">官方</option>
          </select>
        </Field>
      </div>
      <Field label="地域">
        <input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
      </Field>
      <Field label="描述">
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function ImagesModule() {
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ImageItem[]>({
    queryKey: KEY,
    queryFn: () => cList<ImageItem>("/images"),
  });

  const del = useMutation({
    mutationFn: (id: number) => cDelete(`/images/${id}`),
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
          <h2 className="text-lg font-black text-primary font-display">镜像管理</h2>
          <p className="text-xs text-slate-400 mt-0.5">官方与自定义镜像</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建镜像
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无镜像" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">镜像名称</th>
              <th className="px-4 py-3">标签</th>
              <th className="px-4 py-3">来源</th>
              <th className="px-4 py-3">大小</th>
              <th className="px-4 py-3">地域</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((im) => (
            <tr key={im.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{im.name}</td>
              <td className="px-4 py-3 text-slate-500">{im.tag ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${im.source === "official" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {im.source === "official" ? "官方" : "自定义"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">{fmtSize(im.sizeMb)}</td>
              <td className="px-4 py-3 text-slate-500">{im.region ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(im.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <GhostButton className="hover:!text-red-500" onClick={() => del.mutate(im.id)}><Trash2 size={13} /> 删除</GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
