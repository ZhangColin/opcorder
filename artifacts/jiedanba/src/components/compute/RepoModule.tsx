import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Heart, Lock, Globe, Trash2, Box, Database, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser } from "@/lib/auth";
import { cList, cPost, cDelete } from "./api";
import type { RepoItem } from "./types";
import {
  Card, PrimaryButton, GhostButton, Modal, Field, inputCls,
  EmptyState, LoadingState, ErrorState, fmtSize,
} from "./shared";

type RepoType = "model" | "dataset" | "image";

const META: Record<RepoType, { title: string; desc: string; icon: React.ReactNode }> = {
  model: { title: "模型仓库", desc: "浏览与发布模型", icon: <Box size={18} /> },
  dataset: { title: "数据集仓库", desc: "浏览与发布数据集", icon: <Database size={18} /> },
  image: { title: "镜像仓库", desc: "浏览与发布镜像", icon: <HardDrive size={18} /> },
};

type Form = { name: string; description: string; visibility: string; tagsText: string };

function PublishModal({ repoType, onClose }: { repoType: RepoType; onClose: () => void }) {
  const [form, setForm] = useState<Form>({ name: "", description: "", visibility: "public", tagsText: "" });
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: () =>
      cPost<RepoItem>("/repo-items", {
        repoType,
        name: form.name,
        description: form.description,
        visibility: form.visibility,
        tags: form.tagsText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/compute/repo-items", repoType] });
      toast({ title: "发布成功" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "发布失败", description: e.message, variant: "destructive" }),
  });
  return (
    <Modal
      title={`发布${META[repoType].title.replace("仓库", "")}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>取消</GhostButton>
          <PrimaryButton onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
            {mut.isPending ? "提交中…" : "发布"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="名称">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="描述">
        <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="可见性">
        <select className={inputCls} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
          <option value="public">公开</option>
          <option value="private">私有</option>
        </select>
      </Field>
      <Field label="标签（空格或逗号分隔）">
        <input className={inputCls} value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="NLP 文本生成" />
      </Field>
    </Modal>
  );
}

export function RepoCard({
  item,
  favored,
  onToggleFav,
  onDelete,
  ownable,
}: {
  item: RepoItem;
  favored?: boolean;
  onToggleFav: () => void;
  onDelete?: () => void;
  ownable?: boolean;
}) {
  const isPublic = (item.visibility ?? "public") === "public";
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-black text-slate-800 truncate">{item.name}</h3>
        <button onClick={onToggleFav} className={`flex-shrink-0 ${favored ? "text-red-500" : "text-slate-300 hover:text-red-400"}`}>
          <Heart size={16} fill={favored ? "currentColor" : "none"} />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 min-h-[32px]">{item.description || "暂无描述"}</p>
      {(item.tags?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags!.slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-bold">{t}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span>{fmtSize(item.sizeMb)}</span>
        <span className="flex items-center gap-1"><Download size={11} /> {item.downloads ?? 0}</span>
        <span className="flex items-center gap-1">
          {isPublic ? <Globe size={11} /> : <Lock size={11} />}
          {isPublic ? "公开" : "私有"}
        </span>
      </div>
      {ownable && onDelete && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <GhostButton className="hover:!text-red-500" onClick={onDelete}><Trash2 size={13} /> 删除</GhostButton>
        </div>
      )}
    </Card>
  );
}

export default function RepoModule({ repoType }: { repoType: RepoType }) {
  const [publishing, setPublishing] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const me = getStoredUser();

  const { data, isLoading, error } = useQuery<RepoItem[]>({
    queryKey: ["/compute/repo-items", repoType],
    queryFn: () => cList<RepoItem>(`/repo-items?repoType=${repoType}`),
  });

  const fav = useMutation({
    mutationFn: (targetId: number) => cPost("/favorites/toggle", { targetType: "repo_item", targetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/compute/favorites"] });
      toast({ title: "已更新收藏" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => cDelete(`/repo-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/compute/repo-items", repoType] });
      toast({ title: "已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const list = data ?? [];
  const meta = META[repoType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-primary font-display flex items-center gap-2">
            <span className="text-primary">{meta.icon}</span>
            {meta.title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>
        </div>
        <PrimaryButton onClick={() => setPublishing(true)}>
          <Plus size={16} /> 发布
        </PrimaryButton>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : list.length === 0 ? (
        <Card><EmptyState text="暂无条目，点击右上角发布" /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((item) => (
            <RepoCard
              key={item.id}
              item={item}
              onToggleFav={() => fav.mutate(item.id)}
              ownable={!!me && item.ownerId === me.id}
              onDelete={() => del.mutate(item.id)}
            />
          ))}
        </div>
      )}

      {publishing && <PublishModal repoType={repoType} onClose={() => setPublishing(false)} />}
    </div>
  );
}
