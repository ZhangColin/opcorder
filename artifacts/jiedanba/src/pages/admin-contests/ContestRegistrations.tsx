import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronDown, X, ExternalLink, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MarkdownContent } from "@/components/MarkdownContent";
import { getAccessToken } from "@/lib/auth";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

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

type Contest = { id: number; title: string };
type ContestTrack = { id: number; catCategoryId: number; catName: string | null; catColorHex: string | null };
type ContestQuestion = { id: number; title: string; content: string };
type Attachment = { name: string; url: string };

type Registration = {
  id: number;
  contestId: number;
  trackId: number;
  userId: number;
  status: string;
  testSubmittedAt: string | null;
  testContent: string | null;
  testAttachments: Attachment[] | null;
  testUrls: string[] | null;
  testGrade: string | null;
  assignmentSubmittedAt: string | null;
  assignmentContent: string | null;
  assignmentAttachments: Attachment[] | null;
  assignmentUrls: string[] | null;
  assignmentGrade: string | null;
  gradeNote: string | null;
  userNickname: string | null;
  userPhone: string | null;
  contestTitle: string | null;
  contestPublicAt: string | null;
  catName: string | null;
  catColorHex: string | null;
  daysToPublic: number | null;
  daysToDeadline: number | null;
  createdAt: string;
};

type RegistrationDetail = Registration & {
  track: (ContestTrack & {
    testQuestion: ContestQuestion | null;
    aQuestion: ContestQuestion | null;
    bQuestion: ContestQuestion | null;
    cQuestion: ContestQuestion | null;
  }) | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered:           { label: "已报名",     color: "bg-blue-100 text-blue-700" },
  test_submitted:       { label: "测试题已提交", color: "bg-amber-100 text-amber-700" },
  test_passed:          { label: "测试题通过",  color: "bg-green-100 text-green-700" },
  test_failed:          { label: "测试题未通过", color: "bg-red-100 text-red-700" },
  assignment_submitted: { label: "测试单已提交", color: "bg-purple-100 text-purple-700" },
  assignment_passed:    { label: "已完成",      color: "bg-emerald-100 text-emerald-700" },
  assignment_failed:    { label: "未通过",      color: "bg-slate-200 text-slate-500" },
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-");
}

function CatBadge({ name, colorHex }: { name?: string | null; colorHex?: string | null }) {
  if (!name) return <span className="text-slate-400 text-xs">—</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorHex || "#6b7280" }}>{name}</span>;
}

function GradeTag({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-slate-400 text-xs">—</span>;
  const color = grade === "A" ? "bg-green-100 text-green-700" : grade === "B" ? "bg-blue-100 text-blue-700" : grade === "C" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{grade === "fail" ? "不通过" : grade}</span>;
}

function GradeForm({ label, onSubmit, loading, disabled }: {
  label: string;
  onSubmit: (grade: "A" | "B" | "C" | "fail", note: string) => void;
  loading: boolean;
  disabled: boolean;
}) {
  const [grade, setGrade] = useState<"A" | "B" | "C" | "fail" | "">("");
  const [note, setNote] = useState("");

  function submit() {
    if (!grade) return;
    onSubmit(grade, note);
  }

  if (disabled) return <div className="text-sm text-slate-400">（已评级，只读）</div>;

  return (
    <div className="flex flex-col gap-3 mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {(["A", "B", "C", "fail"] as const).map(g => (
          <button
            key={g}
            type="button"
            onClick={() => setGrade(g)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${grade === g ? (g === "fail" ? "bg-red-600 text-white border-red-600" : "bg-primary text-white border-primary") : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"}`}
          >
            {g === "fail" ? "不通过" : `${g} 级`}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="运营备注（可选）"
        rows={2}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white resize-none"
      />
      <button
        onClick={submit}
        disabled={!grade || loading}
        className="py-2 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        {loading && <Loader2 size={14} className="animate-spin" />} 提交评级
      </button>
    </div>
  );
}

function SubmissionBlock({ label, question, content, attachments, urls, grade, onGrade, grading, isGraded }: {
  label: string;
  question: ContestQuestion | null | undefined;
  content: string | null;
  attachments: Attachment[] | null;
  urls: string[] | null;
  grade: string | null;
  onGrade: (grade: "A" | "B" | "C" | "fail", note: string) => void;
  grading: boolean;
  isGraded: boolean;
}) {
  if (!content && !attachments?.length && !urls?.length) {
    return (
      <div className="mb-6">
        <h4 className="text-sm font-bold text-slate-700 mb-2">{label}</h4>
        <p className="text-sm text-slate-400">尚未提交</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h4 className="text-sm font-bold text-slate-700 mb-3">{label}</h4>
      {question && (
        <div className="bg-blue-50 rounded-xl p-4 mb-3">
          <p className="text-xs font-bold text-blue-600 mb-1">题目：{question.title}</p>
          {question.content && <MarkdownContent content={question.content} />}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">OPC 提交内容</span>
          <GradeTag grade={grade} />
        </div>
        {content && <MarkdownContent content={content} />}
        {attachments && attachments.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Paperclip size={12} /> 附件</p>
            {attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Paperclip size={11} /> {a.name}
              </a>
            ))}
          </div>
        )}
        {urls && urls.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><ExternalLink size={12} /> 在线链接</p>
            {urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink size={11} /> {u}
              </a>
            ))}
          </div>
        )}
      </div>
      <GradeForm label="评级操作" onSubmit={onGrade} loading={grading} disabled={isGraded} />
    </div>
  );
}

function DetailModal({ reg, onClose, onRefresh }: { reg: Registration; onClose: () => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const { data: detail, isLoading } = useQuery<RegistrationDetail>({
    queryKey: ["admin-contest-registration", reg.id],
    queryFn: () => adminGet(`/api/admin/contests/registrations/${reg.id}`),
  });

  const [gradingTest, setGradingTest] = useState(false);
  const [gradingAssign, setGradingAssign] = useState(false);

  async function gradeTest(grade: "A" | "B" | "C" | "fail", note: string) {
    setGradingTest(true);
    try {
      await adminPost(`/api/admin/contests/registrations/${reg.id}/grade-test`, { grade, note });
      toast({ title: "测试题评级已提交" });
      onRefresh();
    } catch (e: unknown) {
      toast({ title: "评级失败", description: e instanceof Error ? e.message : "未知错误", variant: "destructive" });
    } finally {
      setGradingTest(false);
    }
  }

  async function gradeAssignment(grade: "A" | "B" | "C" | "fail", note: string) {
    setGradingAssign(true);
    try {
      await adminPost(`/api/admin/contests/registrations/${reg.id}/grade-assignment`, { grade, note });
      toast({ title: "测试单评级已提交" });
      onRefresh();
    } catch (e: unknown) {
      toast({ title: "评级失败", description: e instanceof Error ? e.message : "未知错误", variant: "destructive" });
    } finally {
      setGradingAssign(false);
    }
  }

  const testGraded = !!detail?.testGrade;
  const assignGraded = !!detail?.assignmentGrade;
  const st = STATUS_MAP[reg.status] ?? { label: reg.status, color: "bg-slate-100 text-slate-600" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-extrabold text-blue-900">报名详情</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span>
              <CatBadge name={reg.catName} colorHex={reg.catColorHex} />
              <span className="text-xs text-slate-400">{reg.userNickname}</span>
              {reg.userPhone && <span className="text-xs text-slate-400">· {reg.userPhone}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        {/* Meta row */}
        <div className="px-8 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500 flex-wrap">
          <span><span className="font-semibold text-slate-600">大赛：</span>{reg.contestTitle ?? "—"}</span>
          <span><span className="font-semibold text-slate-600">报名时间：</span>{fmtDate(reg.createdAt)}</span>
          {reg.gradeNote && <span><span className="font-semibold text-slate-600">运营备注：</span>{reg.gradeNote}</span>}
          {reg.contestPublicAt && <span><span className="font-semibold text-slate-600">公示日：</span>{fmtDate(reg.contestPublicAt)}</span>}
        </div>

        {/* Body */}
        <div className="p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin mr-2" /> 加载中…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <SubmissionBlock
                label="测试题提交"
                question={detail?.track?.testQuestion}
                content={detail?.testContent ?? null}
                attachments={detail?.testAttachments as Attachment[] | null}
                urls={detail?.testUrls as string[] | null}
                grade={detail?.testGrade ?? null}
                onGrade={gradeTest}
                grading={gradingTest}
                isGraded={testGraded}
              />
              <SubmissionBlock
                label="测试单提交"
                question={
                  detail?.testGrade === "A" ? detail?.track?.aQuestion :
                  detail?.testGrade === "B" ? detail?.track?.bQuestion :
                  detail?.testGrade === "C" ? detail?.track?.cQuestion : null
                }
                content={detail?.assignmentContent ?? null}
                attachments={detail?.assignmentAttachments as Attachment[] | null}
                urls={detail?.assignmentUrls as string[] | null}
                grade={detail?.assignmentGrade ?? null}
                onGrade={gradeAssignment}
                grading={gradingAssign}
                isGraded={assignGraded}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContestRegistrations() {
  const qc = useQueryClient();
  const inlineNav = useAdminInlineNav();
  const [contestId, setContestId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);

  const { data: contests } = useQuery<{ items: Contest[] }>({
    queryKey: ["admin-contests-simple"],
    queryFn: () => adminGet("/api/admin/contests?pageSize=100"),
    staleTime: 60_000,
  });

  const { data: tracks } = useQuery<ContestTrack[]>({
    queryKey: ["admin-contest-tracks", contestId],
    queryFn: () => adminGet(`/api/admin/contests/${contestId}/tracks`),
    enabled: !!contestId,
  });

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (contestId) params.set("contestId", contestId);
  if (trackId) params.set("trackId", trackId);
  if (statusFilter) params.set("status", statusFilter);

  const { data, isLoading, refetch } = useQuery<{ items: Registration[]; total: number; page: number; pageSize: number }>({
    queryKey: ["admin-contest-registrations", contestId, trackId, statusFilter, page],
    queryFn: () => adminGet(`/api/admin/contests/registrations?${params}`),
  });

  function refresh() {
    refetch();
    if (selectedReg) {
      qc.invalidateQueries({ queryKey: ["admin-contest-registration", selectedReg.id] });
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  function rowBg(reg: Registration) {
    if (reg.status === "test_submitted") {
      const d = reg.daysToPublic;
      if (d !== null && d >= 0 && d <= 1) return "bg-red-50";
      if (d !== null && d >= 0 && d <= 3) return "bg-yellow-50";
    }
    if (reg.status === "assignment_submitted") {
      const d = reg.daysToDeadline;
      if (d !== null && d >= 0 && d <= 1) return "bg-red-50";
      if (d !== null && d >= 0 && d <= 3) return "bg-yellow-50";
    }
    return "";
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-blue-900">报名与评级</h2>
        <p className="text-slate-500 text-sm mt-1">查看报名记录并完成评级操作</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative">
          <select value={contestId} onChange={e => { setContestId(e.target.value); setTrackId(""); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
            <option value="">全部大赛</option>
            {contests?.items?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {contestId && (
          <div className="relative">
            <select value={trackId} onChange={e => { setTrackId(e.target.value); setPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]">
              <option value="">全部赛道</option>
              {tracks?.map(t => <option key={t.id} value={t.id}>{t.catName}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
        <div className="relative">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
            <option value="">全部状态</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" /> 待评·截止 ≤3 天</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> 待评·截止 ≤1 天</span>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <tr>
              <th className="px-5 py-4">OPC</th>
              <th className="px-5 py-4">大赛</th>
              <th className="px-5 py-4">赛道</th>
              <th className="px-5 py-4">状态</th>
              <th className="px-5 py-4">测试题提交</th>
              <th className="px-5 py-4">测试题评级</th>
              <th className="px-5 py-4">测试单提交</th>
              <th className="px-5 py-4">测试单评级</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400"><div className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-sm">加载中…</span></div></td></tr>
            ) : !data?.items?.length ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">暂无报名记录</td></tr>
            ) : data.items.map(r => {
              const st = STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
              return (
                <tr key={r.id} className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${rowBg(r)}`} onClick={() => inlineNav?.push(`/admin/contests/registrations/${r.id}`)}>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-blue-700">{r.userNickname ?? "—"}</div>
                    <div className="text-xs text-slate-400">{r.userPhone ?? ""}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-[130px] truncate">{r.contestTitle ?? "—"}</td>
                  <td className="px-5 py-3"><CatBadge name={r.catName} colorHex={r.catColorHex} /></td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span></td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(r.testSubmittedAt)}</td>
                  <td className="px-5 py-3"><GradeTag grade={r.testGrade} /></td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(r.assignmentSubmittedAt)}</td>
                  <td className="px-5 py-3"><GradeTag grade={r.assignmentGrade} /></td>
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

    </div>
  );
}
