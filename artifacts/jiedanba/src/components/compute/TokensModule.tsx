import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost } from "./api";
import type { TokenResource } from "./types";
import {
  Card, StatusBadge, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TableShell, fmtDate,
} from "./shared";

const KEY = ["/compute/token-resources"];

type Form = { name: string; modelName: string; totalTokens: number };

function fmtTokens(n?: number | null): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function FormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>({ name: "", modelName: "GPT-4", totalTokens: 1_000_000 });
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => cPost<TokenResource>("/token-resources", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "已购买" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "购买失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title="购买 Token 资源包"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
            {mut.isPending ? "提交中…" : "购买"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="资源包名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="模型名称">
        <input className={inputCls} value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
      </Field>
      <Field label="Token 总量">
        <input type="number" min={1} className={inputCls} value={form.totalTokens} onChange={(e) => setForm({ ...form, totalTokens: Number(e.target.value) || 1 })} />
      </Field>
    </Modal>
  );
}

export default function TokensModule() {
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery<TokenResource[]>({
    queryKey: KEY,
    queryFn: () => cList<TokenResource>("/token-resources"),
  });

  const list = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display">Token 资源</h2>
          <p className="text-xs text-slate-400 mt-0.5">按量 Token 资源包</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 购买资源包
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无 Token 资源包" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">资源包名称</th>
              <th className="px-4 py-3">模型</th>
              <th className="px-4 py-3">已用/总量</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">到期时间</th>
            </>
          }
        >
          {list.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{t.name}</td>
              <td className="px-4 py-3 text-slate-500">{t.modelName ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{fmtTokens(t.usedTokens)} / {fmtTokens(t.totalTokens)}</td>
              <td className="px-4 py-3"><StatusBadge status={t.status ?? "active"} /></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(t.expiresAt)}</td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && <FormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
