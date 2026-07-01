import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Edit2, Trash2, Loader2, X, ChevronDown,
  Settings, ArrowLeft, Calendar, Users, Link2, QrCode, Copy,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { RichTextEditor, RichTextView } from "@/components/RichTextEditor";
import { getAccessToken } from "@/lib/auth";

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
type ContestQuestion = { id: number; catCategoryId: number; title: string };
type Contest = {
  id: number; title: string; details: string; status: "draft" | "published" | "ended";
  announcementAt: string; registrationAt: string; publicAt: string; benefitAt: string; deadlineAt: string;
  trackCount: number; registrationCount: number; createdAt: string;
};
type ContestTrack = {
  id: number; contestId: number; catCategoryId: number; catName: string | null; catColorHex: string | null;
  testQuestionId: number | null; aQuestionId: number | null; bQuestionId: number | null; cQuestionId: number | null;
  testDurationHours: number; aDurationHours: number; bDurationHours: number; cDurationHours: number;
  quotaTotal: number; quotaUsed: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: "草稿",   color: "bg-slate-100 text-slate-600" },
  published: { label: "进行中", color: "bg-green-100 text-green-700" },
  ended:     { label: "已结束", color: "bg-slate-200 text-slate-500" },
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-");
}

function fmtDtInput(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FormDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-12 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

function CatBadge({ name, colorHex }: { name?: string | null; colorHex?: string | null }) {
  if (!name) return <span className="text-slate-400 text-xs">—</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorHex || "#6b7280" }}>{name}</span>;
}

/* ─── Contest Form ─── */
function ContestFormFields({ form, setForm }: {
  form: { title: string; details: string; announcementAt: string; registrationAt: string; publicAt: string; benefitAt: string; deadlineAt: string; status: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">大赛标题 *</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="请输入大赛名称" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">状态</label>
        <div className="relative">
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20">
            <option value="draft">草稿</option>
            <option value="published">进行中</option>
            <option value="ended">已结束</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {([
          ["公告开始时间", "announcementAt"],
          ["报名开始时间", "registrationAt"],
          ["公示开始时间", "publicAt"],
          ["权益发放时间", "benefitAt"],
          ["活动截止时间", "deadlineAt"],
        ] as [string, string][]).map(([label, key]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label} *</label>
            <input
              type="datetime-local"
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">大赛详情</label>
        <RichTextEditor value={form.details} onChange={v => setForm(f => ({ ...f, details: v }))} placeholder="请输入大赛详情介绍…" minHeight="150px" />
      </div>
    </div>
  );
}

/* ─── Track Detail View ─── */
function ContestTrackManager({ contest }: { contest: Contest }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog: trackConfirmDialog } = useConfirm();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTrack, setEditTrack] = useState<ContestTrack | null>(null);
  const [trackForm, setTrackForm] = useState({
    catCategoryId: "", testQuestionId: "", aQuestionId: "", bQuestionId: "", cQuestionId: "",
    testDurationHours: "72", aDurationHours: "72", bDurationHours: "72", cDurationHours: "72",
    quotaTotal: "0",
  });
  const [trackErr, setTrackErr] = useState<string | null>(null);

  const { data: cats } = useQuery<CatCategory[]>({ queryKey: ["admin-cat-categories"], queryFn: () => adminGet("/api/admin/cat-categories"), staleTime: 60_000 });
  const { data: tracks, isLoading } = useQuery<ContestTrack[]>({
    queryKey: ["admin-contest-tracks", contest.id],
    queryFn: () => adminGet(`/api/admin/contests/${contest.id}/tracks`),
  });
  const selectedCatId = trackForm.catCategoryId ? Number(trackForm.catCategoryId) : null;
  const { data: questions } = useQuery<{ items: ContestQuestion[] }>({
    queryKey: ["admin-contest-questions", selectedCatId],
    queryFn: () => adminGet(`/api/admin/contests/questions?catCategoryId=${selectedCatId}&pageSize=100`),
    enabled: !!selectedCatId,
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, number | null>) => {
      if (editTrack) return adminPut(`/api/admin/contests/${contest.id}/tracks/${editTrack.id}`, payload);
      return adminPost(`/api/admin/contests/${contest.id}/tracks`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contest-tracks", contest.id] });
      qc.invalidateQueries({ queryKey: ["admin-contests"] });
      toast({ title: editTrack ? "赛道已更新" : "赛道已添加" });
      setDrawerOpen(false);
    },
    onError: (e: Error) => setTrackErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (trackId: number) => adminDelete(`/api/admin/contests/${contest.id}/tracks/${trackId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contest-tracks", contest.id] });
      qc.invalidateQueries({ queryKey: ["admin-contests"] });
      toast({ title: "赛道已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  function openAddTrack() {
    setEditTrack(null);
    setTrackForm({ catCategoryId: "", testQuestionId: "", aQuestionId: "", bQuestionId: "", cQuestionId: "", testDurationHours: "72", aDurationHours: "72", bDurationHours: "72", cDurationHours: "72", quotaTotal: "0" });
    setTrackErr(null);
    setDrawerOpen(true);
  }
  function openEditTrack(t: ContestTrack) {
    setEditTrack(t);
    setTrackForm({
      catCategoryId: String(t.catCategoryId),
      testQuestionId: t.testQuestionId ? String(t.testQuestionId) : "",
      aQuestionId: t.aQuestionId ? String(t.aQuestionId) : "",
      bQuestionId: t.bQuestionId ? String(t.bQuestionId) : "",
      cQuestionId: t.cQuestionId ? String(t.cQuestionId) : "",
      testDurationHours: String(t.testDurationHours),
      aDurationHours: String(t.aDurationHours),
      bDurationHours: String(t.bDurationHours),
      cDurationHours: String(t.cDurationHours),
      quotaTotal: String(t.quotaTotal),
    });
    setTrackErr(null);
    setDrawerOpen(true);
  }

  function handleDeleteTrack(t: ContestTrack) {
    askConfirm({ title: "确认删除", description: `删除「${t.catName ?? "该"}」赛道配置？`, confirmLabel: "删除", confirmVariant: "destructive", onConfirm: () => deleteMut.mutate(t.id) });
  }

  function handleSaveTrack() {
    setTrackErr(null);
    if (!trackForm.catCategoryId) { setTrackErr("请选择赛道分类"); return; }
    const payload: Record<string, number | null> = {
      catCategoryId: Number(trackForm.catCategoryId),
      testQuestionId: trackForm.testQuestionId ? Number(trackForm.testQuestionId) : null,
      aQuestionId: trackForm.aQuestionId ? Number(trackForm.aQuestionId) : null,
      bQuestionId: trackForm.bQuestionId ? Number(trackForm.bQuestionId) : null,
      cQuestionId: trackForm.cQuestionId ? Number(trackForm.cQuestionId) : null,
      testDurationHours: Number(trackForm.testDurationHours) || 72,
      aDurationHours: Number(trackForm.aDurationHours) || 72,
      bDurationHours: Number(trackForm.bDurationHours) || 72,
      cDurationHours: Number(trackForm.cDurationHours) || 72,
      quotaTotal: Number(trackForm.quotaTotal) || 0,
    };
    saveMut.mutate(payload);
  }

  const qList = questions?.items ?? [];

  type QRow = { label: string; qKey: "testQuestionId" | "aQuestionId" | "bQuestionId" | "cQuestionId"; dKey: "testDurationHours" | "aDurationHours" | "bDurationHours" | "cDurationHours"; badge: string };
  const Q_ROWS: QRow[] = [
    { label: "测试题",         qKey: "testQuestionId", dKey: "testDurationHours", badge: "试" },
    { label: "A 级题（测试单）", qKey: "aQuestionId",    dKey: "aDurationHours",    badge: "A" },
    { label: "B 级题（测试单）", qKey: "bQuestionId",    dKey: "bDurationHours",    badge: "B" },
    { label: "C 级题（测试单）", qKey: "cQuestionId",    dKey: "cDurationHours",    badge: "C" },
  ];

  return (
    <div>
      {trackConfirmDialog}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-blue-900">赛道配置</h3>
        <button onClick={openAddTrack} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors">
          <Plus size={14} /> 添加赛道
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 size={18} className="animate-spin mr-2" /> 加载中…</div>
      ) : !tracks?.length ? (
        <div className="text-center py-8 text-sm text-slate-400">暂无赛道配置</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3">赛道</th>
                <th className="px-4 py-3">名额</th>
                <th className="px-4 py-3">已报名</th>
                <th className="px-4 py-3">测试题时长</th>
                <th className="px-4 py-3">A/B/C 时长</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tracks.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3"><CatBadge name={t.catName} colorHex={t.catColorHex} /></td>
                  <td className="px-4 py-3 text-sm">{t.quotaTotal}</td>
                  <td className="px-4 py-3 text-sm">{t.quotaUsed}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{t.testDurationHours}h</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{t.aDurationHours}h / {t.bDurationHours}h / {t.cDurationHours}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditTrack(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteTrack(t)} disabled={t.quotaUsed > 0} className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editTrack ? "编辑赛道" : "添加赛道"}>
        <div className="flex flex-col gap-5">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">赛道分类 *</label>
              <div className="relative">
                <select value={trackForm.catCategoryId} onChange={e => setTrackForm(f => ({ ...f, catCategoryId: e.target.value, testQuestionId: "", aQuestionId: "", bQuestionId: "", cQuestionId: "" }))}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">请选择赛道分类</option>
                  {cats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">报名名额（0 = 不限）</label>
              <input type="number" min="0" value={trackForm.quotaTotal} onChange={e => setTrackForm(f => ({ ...f, quotaTotal: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
            </div>
          </div>

          {/* 题目 + 完成时长（每行一组）*/}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[auto_1fr_160px] items-center gap-x-3 px-1 mb-1">
              <div className="w-6" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">题目</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">完成时长（小时）</span>
            </div>
            {Q_ROWS.map(({ label, qKey, dKey, badge }) => (
              <div key={qKey} className="grid grid-cols-[auto_1fr_160px] items-center gap-x-3 py-2 px-1 rounded-xl hover:bg-slate-50 transition-colors">
                <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-[11px] font-extrabold shrink-0">{badge}</span>
                <div className="relative min-w-0">
                  <select value={trackForm[qKey]} onChange={e => setTrackForm(f => ({ ...f, [qKey]: e.target.value }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 truncate"
                    disabled={!selectedCatId} title={label}>
                    <option value="" disabled hidden>{selectedCatId ? `选择${label}` : "请先选择赛道"}</option>
                    {qList.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <input type="number" min="1" value={trackForm[dKey]} onChange={e => setTrackForm(f => ({ ...f, [dKey]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
              </div>
            ))}
          </div>

          {trackErr && <div className="text-sm text-destructive bg-red-50 rounded-xl px-4 py-3">{trackErr}</div>}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSaveTrack} disabled={saveMut.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saveMut.isPending && <Loader2 size={15} className="animate-spin" />}
              {editTrack ? "保存修改" : "添加赛道"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

/* ─── Main Component ─── */
export default function ContestActivities() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm: askConfirmContest, confirmDialog } = useConfirm();

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contest | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const blankForm = { title: "", details: "", status: "draft", announcementAt: "", registrationAt: "", publicAt: "", benefitAt: "", deadlineAt: "" };
  const [form, setForm] = useState(blankForm);

  const [detailContest, setDetailContest] = useState<Contest | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (statusFilter) params.set("status", statusFilter);

  const { data, isLoading } = useQuery<{ items: Contest[]; total: number; page: number; pageSize: number }>({
    queryKey: ["admin-contests", statusFilter, page],
    queryFn: () => adminGet(`/api/admin/contests?${params}`),
  });

  const saveMut = useMutation({
    mutationFn: async (payload: typeof blankForm) => {
      if (editTarget) return adminPut(`/api/admin/contests/${editTarget.id}`, payload);
      return adminPost("/api/admin/contests", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-contests"] });
      toast({ title: editTarget ? "大赛已更新" : "大赛已创建" });
      setDrawerOpen(false);
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/contests/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-contests"] }); toast({ title: "大赛已删除" }); },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const [qrContest, setQrContest] = useState<Contest | null>(null);

  function contestUrl(c: Contest) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${base}/contest/${c.id}`;
  }

  function copyLink(c: Contest) {
    navigator.clipboard.writeText(contestUrl(c)).then(
      () => toast({ title: "链接已复制" }),
      () => toast({ title: "复制失败，请手动复制", variant: "destructive" }),
    );
  }

  function openCreate() {
    setEditTarget(null);
    setForm(blankForm);
    setFormErr(null);
    setDrawerOpen(true);
  }

  function openEdit(c: Contest) {
    setEditTarget(c);
    setForm({
      title: c.title, details: c.details, status: c.status,
      announcementAt: fmtDtInput(c.announcementAt), registrationAt: fmtDtInput(c.registrationAt),
      publicAt: fmtDtInput(c.publicAt), benefitAt: fmtDtInput(c.benefitAt), deadlineAt: fmtDtInput(c.deadlineAt),
    });
    setFormErr(null);
    setDrawerOpen(true);
  }

  function handleDelete(c: Contest) {
    askConfirmContest({ title: "确认删除", description: `删除大赛「${c.title}」？仅草稿状态可删除。`, confirmLabel: "删除", confirmVariant: "destructive", onConfirm: () => deleteMut.mutate(c.id) });
  }

  function handleSubmit() {
    setFormErr(null);
    const { title, announcementAt, registrationAt, publicAt, benefitAt, deadlineAt } = form;
    if (!title.trim()) { setFormErr("请输入大赛标题"); return; }
    if (!announcementAt || !registrationAt || !publicAt || !benefitAt || !deadlineAt) { setFormErr("请填写所有时间节点"); return; }
    saveMut.mutate(form);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  if (detailContest) {
    return (
      <div>
        <button onClick={() => setDetailContest(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-700 mb-6 font-semibold transition-colors">
          <ArrowLeft size={16} /> 返回大赛列表
        </button>
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-extrabold text-blue-900">{detailContest.title}</h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_LABELS[detailContest.status]?.color ?? ""}`}>
                  {STATUS_LABELS[detailContest.status]?.label}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-500 mb-4">
                {[
                  ["公告开始", detailContest.announcementAt],
                  ["报名开始", detailContest.registrationAt],
                  ["公示开始", detailContest.publicAt],
                  ["权益发放", detailContest.benefitAt],
                  ["活动截止", detailContest.deadlineAt],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span className="font-semibold text-slate-600">{label}：</span>{fmtDate(val)}
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span className="font-semibold text-slate-600">报名总数：</span>{detailContest.registrationCount}
                </div>
              </div>
              {detailContest.details && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <RichTextView html={detailContest.details} />
                </div>
              )}
            </div>
            <button onClick={() => openEdit(detailContest)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <Edit2 size={15} /> 编辑
            </button>
          </div>
        </div>
        <ContestTrackManager contest={detailContest} />

        <FormDialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title="编辑大赛">
          <div className="flex flex-col gap-4">
            <ContestFormFields form={form} setForm={setForm} />
            {formErr && <div className="text-sm text-destructive bg-red-50 rounded-xl px-4 py-3">{formErr}</div>}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSubmit} disabled={saveMut.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saveMut.isPending && <Loader2 size={15} className="animate-spin" />} 保存修改
              </button>
              <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
            </div>
          </div>
        </FormDialog>
      </div>
    );
  }

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-900">大赛活动</h2>
          <p className="text-slate-500 text-sm mt-1">管理 OPC 月度大赛</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
          <Plus size={16} /> 新建大赛
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">进行中</option>
            <option value="ended">已结束</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <tr>
              <th className="px-6 py-4">大赛标题</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">公告时间</th>
              <th className="px-6 py-4">报名时间</th>
              <th className="px-6 py-4">赛道数</th>
              <th className="px-6 py-4">报名数</th>
              <th className="px-6 py-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400"><div className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-sm">加载中…</span></div></td></tr>
            ) : !data?.items?.length ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">暂无大赛</td></tr>
            ) : data.items.map(c => {
              const st = STATUS_LABELS[c.status];
              return (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <button onClick={() => setDetailContest(c)} className="text-sm font-bold text-blue-700 hover:underline text-left">{c.title}</button>
                  </td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st?.color ?? ""}`}>{st?.label}</span></td>
                  <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(c.announcementAt)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(c.registrationAt)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.trackCount}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.registrationCount}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setDetailContest(c)} title="管理赛道" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors"><Settings size={15} /></button>
                      <button onClick={() => openEdit(c)} title="编辑" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => copyLink(c)} title="复制详情链接" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Link2 size={15} /></button>
                      <button onClick={() => setQrContest(c)} title="显示二维码" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><QrCode size={15} /></button>
                      <button onClick={() => handleDelete(c)} title="删除" className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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

      <FormDialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editTarget ? "编辑大赛" : "新建大赛"}>
        <div className="flex flex-col gap-4">
          <ContestFormFields form={form} setForm={setForm} />
          {formErr && <div className="text-sm text-destructive bg-red-50 rounded-xl px-4 py-3">{formErr}</div>}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSubmit} disabled={saveMut.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saveMut.isPending && <Loader2 size={15} className="animate-spin" />}
              {editTarget ? "保存修改" : "创建大赛"}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
          </div>
        </div>
      </FormDialog>

      {/* QR Code modal */}
      {qrContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQrContest(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 w-80">
            <button onClick={() => setQrContest(null)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
            <h3 className="font-extrabold text-blue-900 text-base text-center line-clamp-2">{qrContest.title}</h3>
            <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-inner">
              <QRCodeSVG value={contestUrl(qrContest)} size={180} bgColor="#ffffff" fgColor="#1e293b" level="M" />
            </div>
            <div className="w-full">
              <div className="text-[11px] text-slate-400 mb-1 text-center">详情链接</div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <span className="text-xs text-slate-600 truncate flex-1">{contestUrl(qrContest)}</span>
                <button onClick={() => copyLink(qrContest)} className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="复制链接"><Copy size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
