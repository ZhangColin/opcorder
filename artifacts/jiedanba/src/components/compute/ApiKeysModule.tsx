import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, KeyRound, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cList, cPost, cDelete } from "./api";
import type { ApiKey, ApiKeyCreated } from "./types";
import {
  Card, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, TableShell, fmtDate, copyText,
} from "./shared";

const KEY = ["/compute/api-keys"];

function CreateModal({ onCreated, onClose }: { onCreated: (k: ApiKeyCreated) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () => cPost<ApiKeyCreated>("/api-keys", { name }),
    onSuccess: (k) => {
      qc.invalidateQueries({ queryKey: KEY });
      onCreated(k);
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title="创建 API Key"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
            {mut.isPending ? "生成中…" : "生成"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="名称">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="如 生产环境-Key" />
      </Field>
    </Modal>
  );
}

function RevealModal({ item, onClose }: { item: ApiKeyCreated; onClose: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    const ok = await copyText(item.key);
    toast({ title: ok ? "已复制到剪贴板" : "复制失败", variant: ok ? undefined : "destructive" });
  };
  return (
    <Modal
      title="API Key 创建成功"
      onClose={onClose}
      footer={<PrimaryButton onClick={onClose}>我已保存</PrimaryButton>}
    >
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs font-bold text-amber-700 leading-relaxed">
          完整 Key 仅显示一次，请立即复制并妥善保存，关闭后将无法再次查看。
        </p>
      </div>
      <div className="rounded-xl bg-slate-900 p-3 flex items-center justify-between gap-2">
        <code className="text-xs text-emerald-300 break-all">{item.key}</code>
        <button onClick={copy} className="text-slate-300 hover:text-white flex-shrink-0">
          <Copy size={16} />
        </button>
      </div>
    </Modal>
  );
}

function maskKey(k: ApiKey): string {
  const prefix = k.keyPrefix ?? "sk-****";
  return `${prefix}••••••••`;
}

export default function ApiKeysModule() {
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyCreated | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ApiKey[]>({
    queryKey: KEY,
    queryFn: () => cList<ApiKey>("/api-keys"),
  });

  const del = useMutation({
    mutationFn: (id: number) => cDelete(`/api-keys/${id}`),
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
          <h2 className="text-lg font-black text-primary font-display">API Key</h2>
          <p className="text-xs text-slate-400 mt-0.5">管理调用凭证</p>
        </div>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> 创建 Key
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无 API Key" /></Card>
      ) : (
        <TableShell
          head={
            <>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">最近使用</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </>
          }
        >
          {list.map((k) => (
            <tr key={k.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-700">{k.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-mono text-xs">
                  <KeyRound size={13} className="text-slate-400" />
                  {maskKey(k)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(k.lastUsedAt)}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(k.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <GhostButton className="hover:!text-red-500" onClick={() => del.mutate(k.id)}><Trash2 size={13} /> 删除</GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={(k) => {
            setCreating(false);
            setRevealed(k);
          }}
        />
      )}
      {revealed && <RevealModal item={revealed} onClose={() => setRevealed(null)} />}
    </div>
  );
}
