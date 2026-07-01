import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Copy, Loader2, Search, X, ChevronDown, Paperclip, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownContent } from "@/components/MarkdownContent";
import { getAccessToken } from "@/lib/auth";
import { uploadFile } from "@/lib/v2api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getHeaders() {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders() });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "请求失败"); }
  return res.json();
}
async function adminPost<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "操作失败"); }
  return res.json();
}
async function adminPut<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "更新失败"); }
  return res.json();
}
async function adminDelete(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: getHeaders() });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "删除失败"); }
  return res.json();
}

type CatCategory = { id: number; name: string; colorHex?: string | null };
type QuestionAttachment = { name: string; url: string };
type ContestQuestion = {
  id: number;
  catCategoryId: number;
  catName: string | null;
  catColorHex: string | null;
  title: string;
  content: string;
  attachments: QuestionAttachment[];
  createdAt: string;
};

/* Large centered dialog for the create/edit form */
function FormDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-12 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}


function CatBadge({ name, colorHex }: { name?: string | null; colorHex?: string | null }) {
  if (!name) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorHex || "#6b7280" }}>
      {name}
    </span>
  );
}

/* ─── Attachment uploader ─── */
function AttachmentUploader({
  attachments,
  onAdd,
  onRemove,
}: {
  attachments: QuestionAttachment[];
  onAdd: (a: QuestionAttachment) => void;
  onRemove: (i: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onAdd({ name: file.name, url });
    } catch {
      toast({ title: "附件上传失败", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">附件（可多个）</label>
      <div className="flex flex-col gap-2">
        {attachments.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Paperclip size={12} className="text-slate-400 shrink-0" />
            <span className="truncate flex-1">{a.name}</span>
            <button type="button" onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading
            ? <><Loader2 size={12} className="animate-spin" /> 上传中…</>
            : <><UploadCloud size={12} /> 点击上传附件</>
          }
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    </div>
  );
}

export default function ContestQuestions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();

  const [catFilter, setCatFilter] = useState<number | "">("");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContestQuestion | null>(null);
  const [previewItem, setPreviewItem] = useState<ContestQuestion | null>(null);

  const [form, setForm] = useState({ catCategoryId: "", title: "", content: "" });
  const [formAttachments, setFormAttachments] = useState<QuestionAttachment[]>([]);
  const [formErr, setFormErr] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleKeywordChange(v: string) {
    setKeyword(v);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedKeyword(v), 350);
  }

  const { data: cats } = useQuery<CatCategory[]>({
    queryKey: ["admin-cat-categories"],
    queryFn: () => adminGet("/api/admin/cat-categories"),
    staleTime: 60_000,
  });

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (catFilter) params.set("catCategoryId", String(catFilter));
  if (debouncedKeyword.trim()) params.set("keyword", debouncedKeyword.trim());

  const { data, isLoading } = useQuery<{ items: ContestQuestion[]; total: number; page: number; pageSize: number }>({
    queryKey: ["admin-contest-questions", catFilter, debouncedKeyword, page],
    queryFn: () => adminGet(`/api/admin/contests/questions?${params}`),
  });

  const saveMut = useMutation({
    mutationFn: async (payload: { catCategoryId: number; title: string; content: string; attachments: QuestionAttachment[] }) => {
      if (editTarget) {
        return adminPut(`/api/admin/contests/questions/${editTarget.id}`, payload);
      }
      return adminPost("/api/admin/contests/questions", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contest-questions"] });
      toast({ title: editTarget ? "题目已更新" : "题目已创建" });
      setDrawerOpen(false);
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/contests/questions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contest-questions"] });
      toast({ title: "题目已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ catCategoryId: "", title: "", content: "" });
    setFormAttachments([]);
    setFormErr(null);
    setDrawerOpen(true);
  }

  function openEdit(q: ContestQuestion) {
    setEditTarget(q);
    setForm({ catCategoryId: String(q.catCategoryId), title: q.title, content: q.content });
    setFormAttachments(Array.isArray(q.attachments) ? q.attachments : []);
    setFormErr(null);
    setDrawerOpen(true);
  }

  function openDuplicate(q: ContestQuestion) {
    setEditTarget(null);
    setForm({ catCategoryId: String(q.catCategoryId), title: `${q.title}（副本）`, content: q.content });
    setFormAttachments(Array.isArray(q.attachments) ? q.attachments : []);
    setFormErr(null);
    setDrawerOpen(true);
  }

  function handleDelete(q: ContestQuestion) {
    askConfirm({ title: "确认删除", description: `删除题目「${q.title}」？此操作不可撤销。`, confirmLabel: "删除", confirmVariant: "destructive", onConfirm: () => deleteMut.mutate(q.id) });
  }

  function handleSubmit() {
    setFormErr(null);
    if (!form.catCategoryId) { setFormErr("请选择赛道分类"); return; }
    if (!form.title.trim()) { setFormErr("请输入题目标题"); return; }
    saveMut.mutate({ catCategoryId: Number(form.catCategoryId), title: form.title, content: form.content, attachments: formAttachments });
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-900">题库管理</h2>
          <p className="text-slate-500 text-sm mt-1">管理各赛道的测试题目</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
          <Plus size={16} /> 新增题目
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Title search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={keyword}
            onChange={e => handleKeywordChange(e.target.value)}
            placeholder="搜索题目标题…"
            className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white w-52"
          />
          {keyword && (
            <button onClick={() => { setKeyword(""); setDebouncedKeyword(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Category filter */}
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => { setCatFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]"
          >
            <option value="">全部赛道</option>
            {cats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <tr>
              <th className="px-6 py-4">标题</th>
              <th className="px-6 py-4">赛道</th>
              <th className="px-6 py-4">附件</th>
              <th className="px-6 py-4">创建时间</th>
              <th className="px-6 py-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-sm">加载中…</span></div>
              </td></tr>
            ) : !data?.items?.length ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                {debouncedKeyword ? `未找到包含「${debouncedKeyword}」的题目` : "暂无题目"}
              </td></tr>
            ) : data.items.map(q => (
              <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <button onClick={() => setPreviewItem(q)} className="text-sm font-semibold text-blue-700 hover:underline text-left">
                    {q.title}
                  </button>
                </td>
                <td className="px-6 py-4"><CatBadge name={q.catName} colorHex={q.catColorHex} /></td>
                <td className="px-6 py-4">
                  {q.attachments?.length > 0
                    ? <span className="flex items-center gap-1 text-xs text-slate-500"><Paperclip size={12} />{q.attachments.length} 个</span>
                    : <span className="text-xs text-slate-300">—</span>
                  }
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString("zh-CN")}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(q)} title="编辑" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => openDuplicate(q)} title="复制为新题" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Copy size={15} /></button>
                    <button onClick={() => handleDelete(q)} title="删除" className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-slate-400">共 <b className="text-slate-600">{data?.total ?? 0}</b> 条</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">‹</button>
            <span className="text-xs text-slate-500 px-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">›</button>
          </div>
        </div>
      )}

      {/* Create/Edit — large centered dialog */}
      <FormDialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editTarget ? "编辑题目" : "新增题目"}>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">赛道分类 *</label>
              <div className="relative">
                <select
                  value={form.catCategoryId}
                  onChange={e => setForm(f => ({ ...f, catCategoryId: e.target.value }))}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">请选择赛道分类</option>
                  {cats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">题目标题 *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="请输入题目标题"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">题目内容（Markdown）</label>
            <MarkdownEditor
              value={form.content}
              onChange={v => setForm(f => ({ ...f, content: v }))}
              placeholder="请输入题目详细内容（支持 Markdown 格式）…"
              minHeight="400px"
            />
          </div>
          <AttachmentUploader
            attachments={formAttachments}
            onAdd={a => setFormAttachments(prev => [...prev, a])}
            onRemove={i => setFormAttachments(prev => prev.filter((_, idx) => idx !== i))}
          />
          {formErr && <div className="text-sm text-destructive bg-red-50 rounded-xl px-4 py-3">{formErr}</div>}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saveMut.isPending}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saveMut.isPending && <Loader2 size={15} className="animate-spin" />}
              {editTarget ? "保存修改" : "创建题目"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
          </div>
        </div>
      </FormDialog>

      {/* Preview Dialog */}
      <FormDialog open={!!previewItem} onClose={() => setPreviewItem(null)} title="题目详情">
        {previewItem && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CatBadge name={previewItem.catName} colorHex={previewItem.catColorHex} />
              <span className="text-xs text-slate-400">#{previewItem.id}</span>
            </div>
            <h3 className="text-lg font-bold text-blue-900">{previewItem.title}</h3>
            {previewItem.content ? (
              <div className="bg-slate-50 rounded-xl p-4">
                <MarkdownContent content={previewItem.content} />
              </div>
            ) : (
              <p className="text-sm text-slate-400">暂无题目内容</p>
            )}
            {previewItem.attachments?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Paperclip size={12} /> 附件</p>
                <div className="flex flex-col gap-1.5">
                  {previewItem.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <Paperclip size={11} /> {a.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2">
              <button onClick={() => { setPreviewItem(null); openEdit(previewItem); }} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Edit2 size={15} /> 编辑此题目
              </button>
            </div>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
