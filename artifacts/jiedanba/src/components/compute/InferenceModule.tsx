import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Square, Trash2, Copy, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { InferenceService } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TabBar, TableShell, fmtDate, copyText,
} from "./shared";

const KEY = ["/compute/inference-services"];

type Form = {
  name: string; serviceType: string; modelSource: string; image: string;
  resourceSpec: string; replicas: number; description: string;
};

function FormModal({ serviceType, onClose }: { serviceType: "custom" | "dedicated"; onClose: () => void }) {
  const [form, setForm] = useState<Form>({
    name: "", serviceType, modelSource: "", image: "", resourceSpec: "", replicas: 1, description: "",
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const mut = useMutation({
    mutationFn: () => cPost<InferenceService>("/inference-services", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "服务已创建" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });

  return (
    <Modal
      title={`创建${serviceType === "dedicated" ? "专用" : "自定义"}推理服务`}
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
      <Field label="服务名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 chat-api" />
      </Field>
      <Field label="模型来源">
        <input className={inputCls} value={form.modelSource} onChange={(e) => setForm({ ...form, modelSource: e.target.value })} placeholder="模型路径 / 仓库" />
      </Field>
      <Field label="镜像">
        <input className={inputCls} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="推理镜像" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="资源规格">
          <input className={inputCls} value={form.resourceSpec} onChange={(e) => setForm({ ...form, resourceSpec: e.target.value })} placeholder="如 1×A10" />
        </Field>
        <Field label="实例数">
          <input type="number" min={1} className={inputCls} value={form.replicas} onChange={(e) => setForm({ ...form, replicas: Number(e.target.value) || 1 })} />
        </Field>
      </div>
      <Field label="描述">
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function InferenceModule() {
  const [tab, setTab] = useState<"custom" | "dedicated">("custom");
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<InferenceService[]>({
    queryKey: KEY,
    queryFn: () => cList<InferenceService>("/inference-services"),
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: number; act: "start" | "stop" | "delete" }) =>
      act === "delete" ? cDelete(`/inference-services/${id}`) : cPost(`/inference-services/${id}/${act}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: v.act === "start" ? "已启动" : v.act === "stop" ? "已停止" : "已删除" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const copyEndpoint = async (url: string) => {
    const ok = await copyText(url);
    toast({ title: ok ? "已复制访问地址" : "复制失败", variant: ok ? undefined : "destructive" });
  };

  const list = (data ?? []).filter((s) => (s.serviceType ?? "custom") === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">推理服务</h2>
          <p className="text-xs text-slate-400 mt-0.5">部署与管理在线推理服务</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建服务
        </PrimaryButton>
      </div>

      <TabBar
        tabs={[{ value: "custom", label: "自定义推理" }, { value: "dedicated", label: "专用推理" }]}
        active={tab}
        onChange={(v) => setTab(v as "custom" | "dedicated")}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无推理服务" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">服务名称</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">访问地址</th>
              <th className="px-4 py-3">实例数</th>
              <th className="px-4 py-3">资源规格</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((s) => (
            <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{s.name}</td>
              <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
              <td className="px-4 py-3">
                {s.endpointUrl ? (
                  <div className="flex items-center gap-1.5 max-w-[220px]">
                    <Link2 size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 truncate text-xs">{s.endpointUrl}</span>
                    <button onClick={() => copyEndpoint(s.endpointUrl!)} className="text-slate-400 hover:text-primary flex-shrink-0">
                      <Copy size={13} />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {s.runningReplicas ?? 0} / {s.replicas ?? 0}
              </td>
              <td className="px-4 py-3 text-slate-500">{s.resourceSpec ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(s.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  {s.status === "running" ? (
                    <GhostButton onClick={() => action.mutate({ id: s.id, act: "stop" })}><Square size={13} /> 停止</GhostButton>
                  ) : (
                    <GhostButton onClick={() => action.mutate({ id: s.id, act: "start" })}><Play size={13} /> 启动</GhostButton>
                  )}
                  <GhostButton className="hover:!text-red-500" onClick={() => action.mutate({ id: s.id, act: "delete" })}><Trash2 size={13} /> 删除</GhostButton>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal serviceType={tab} onClose={() => setCreating(false)} />}
    </div>
  );
}
