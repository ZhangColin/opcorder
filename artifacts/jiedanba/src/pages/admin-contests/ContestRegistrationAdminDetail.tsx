import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ExternalLink, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { MarkdownContent } from "@/components/MarkdownContent";
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

type ContestQuestion = { id: number; title: string; content: string };
type Attachment = { name: string; url: string };

type RegistrationDetail = {
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
  createdAt: string;
  track: {
    id: number;
    catCategoryId: number;
    catName: string | null;
    catColorHex: string | null;
    testQuestion: ContestQuestion | null;
    aQuestion: ContestQuestion | null;
    bQuestion: ContestQuestion | null;
    cQuestion: ContestQuestion | null;
  } | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered:           { label: "已报名",       color: "bg-blue-100 text-blue-700" },
  test_submitted:       { label: "测试题已提交",  color: "bg-amber-100 text-amber-700" },
  test_passed:          { label: "测试题通过",    color: "bg-green-100 text-green-700" },
  test_failed:          { label: "测试题未通过",  color: "bg-red-100 text-red-700" },
  assignment_submitted: { label: "测试单已提交",  color: "bg-purple-100 text-purple-700" },
  assignment_passed:    { label: "已完成",        color: "bg-emerald-100 text-emerald-700" },
  assignment_failed:    { label: "未通过",        color: "bg-slate-200 text-slate-500" },
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-");
}

function CatBadge({ name, colorHex }: { name?: string | null; colorHex?: string | null }) {
  if (!name) return null;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorHex || "#6b7280" }}>{name}</span>;
}

function GradeTag({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-slate-400 text-xs">—</span>;
  const color = grade === "A" ? "bg-green-100 text-green-700" : grade === "B" ? "bg-blue-100 text-blue-700" : grade === "C" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{grade === "fail" ? "不通过" : grade}</span>;
}

function TestGradeForm({ onSubmit, loading, disabled, notSubmitted }: {
  onSubmit: (grade: "A" | "B" | "C" | "fail", note: string) => void;
  loading: boolean;
  disabled: boolean;
  notSubmitted?: boolean;
}) {
  const [grade, setGrade] = useState<"A" | "B" | "C" | "fail" | "">("");
  const [note, setNote] = useState("");

  if (notSubmitted) return <div className="text-sm text-slate-400 mt-3 italic">（用户尚未提交，无法操作）</div>;
  if (disabled) return <div className="text-sm text-slate-400 mt-3 italic">（已评级，只读）</div>;

  return (
    <div className="flex flex-col gap-3 mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs font-bold text-slate-600">定级操作</p>
      <div className="flex items-center gap-2 flex-wrap">
        {(["A", "B", "C", "fail"] as const).map(g => (
          <button key={g} type="button" onClick={() => setGrade(g)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${grade === g ? (g === "fail" ? "bg-red-600 text-white border-red-600" : "bg-primary text-white border-primary") : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"}`}>
            {g === "fail" ? "不通过" : `${g} 级`}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="运营备注（可选）" rows={2}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white resize-none" />
      <button onClick={() => { if (grade) onSubmit(grade, note); }} disabled={!grade || loading}
        className="py-2 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />} 提交定级
      </button>
    </div>
  );
}

function AssignmentReviewForm({ onSubmit, loading, disabled, notSubmitted }: {
  onSubmit: (pass: boolean, note: string) => void;
  loading: boolean;
  disabled: boolean;
  notSubmitted?: boolean;
}) {
  const [pass, setPass] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  if (notSubmitted) return <div className="text-sm text-slate-400 mt-3 italic">（用户尚未提交，无法操作）</div>;
  if (disabled) return <div className="text-sm text-slate-400 mt-3 italic">（已审核，只读）</div>;

  return (
    <div className="flex flex-col gap-3 mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-xs font-bold text-slate-600">审核操作</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setPass(true)}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${pass === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600"}`}>
          通过
        </button>
        <button type="button" onClick={() => setPass(false)}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${pass === false ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-500"}`}>
          不通过
        </button>
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={pass === false ? "请填写不通过原因（将通知用户）" : "运营备注（可选）"} rows={2}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white resize-none" />
      <button onClick={() => { if (pass !== null) onSubmit(pass, note); }} disabled={pass === null || loading}
        className="py-2 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />} 提交审核
      </button>
    </div>
  );
}

function SubmissionContent({ content, attachments, urls }: {
  content: string | null;
  attachments: Attachment[] | null;
  urls: string[] | null;
}) {
  if (!content && !attachments?.length && !urls?.length) {
    return <p className="text-sm text-slate-400 py-4 text-center">尚未提交</p>;
  }
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 mb-3">OPC 提交内容</p>
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
  );
}

function TestSubmissionBlock({ question, content, attachments, urls, grade, onGrade, grading }: {
  question: ContestQuestion | null | undefined;
  content: string | null;
  attachments: Attachment[] | null;
  urls: string[] | null;
  grade: string | null;
  onGrade: (grade: "A" | "B" | "C" | "fail", note: string) => void;
  grading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-blue-900">测试题提交</h3>
        <GradeTag grade={grade} />
      </div>
      {question && (
        <div className="bg-blue-50 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-blue-600 mb-2">题目：{question.title}</p>
          {question.content && <MarkdownContent content={question.content} />}
        </div>
      )}
      <SubmissionContent content={content} attachments={attachments} urls={urls} />
      <TestGradeForm onSubmit={onGrade} loading={grading} disabled={!!grade} notSubmitted={!content && !attachments?.length && !urls?.length} />
    </div>
  );
}

function AssignmentSubmissionBlock({ question, content, attachments, urls, grade, onReview, reviewing, testGrade }: {
  question: ContestQuestion | null | undefined;
  content: string | null;
  attachments: Attachment[] | null;
  urls: string[] | null;
  grade: string | null;
  onReview: (pass: boolean, note: string) => void;
  reviewing: boolean;
  testGrade: string | null;
}) {
  // Test failed → flow ended, no assignment
  if (testGrade === "fail") {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]">
        <p className="text-slate-400 text-sm font-semibold">测试题未通过</p>
        <p className="text-slate-400 text-xs">流程已结束，无需进行测试单</p>
      </div>
    );
  }
  // Test not graded yet
  if (!testGrade) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]">
        <p className="text-slate-400 text-sm">等待测试题定级后开放</p>
      </div>
    );
  }
  // testGrade is A/B/C → show assignment block
  const passTag = grade === "fail"
    ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">不通过</span>
    : grade
    ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">通过（{grade}级认定）</span>
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-blue-900">测试单提交</h3>
          <p className="text-xs text-slate-400 mt-0.5">{testGrade} 级对应测试单</p>
        </div>
        {passTag}
      </div>
      {question && (
        <div className="bg-blue-50 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-blue-600 mb-2">题目：{question.title}</p>
          {question.content && <MarkdownContent content={question.content} />}
        </div>
      )}
      <SubmissionContent content={content} attachments={attachments} urls={urls} />
      <AssignmentReviewForm onSubmit={onReview} loading={reviewing} disabled={!!grade} notSubmitted={!content && !attachments?.length && !urls?.length} />
    </div>
  );
}

export default function ContestRegistrationAdminDetail({ inlineId }: { inlineId: number }) {
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();

  const { data: detail, isLoading, refetch } = useQuery<RegistrationDetail>({
    queryKey: ["admin-contest-registration", inlineId],
    queryFn: () => adminGet(`/api/admin/contests/registrations/${inlineId}`),
  });

  const [gradingTest, setGradingTest] = useState(false);
  const [gradingAssign, setGradingAssign] = useState(false);

  async function gradeTest(grade: "A" | "B" | "C" | "fail", note: string) {
    setGradingTest(true);
    try {
      await adminPost(`/api/admin/contests/registrations/${inlineId}/grade-test`, { grade, note });
      toast({ title: "测试题评级已提交" });
      refetch();
    } catch (e: unknown) {
      toast({ title: "评级失败", description: e instanceof Error ? e.message : "未知错误", variant: "destructive" });
    } finally {
      setGradingTest(false);
    }
  }

  async function reviewAssignment(pass: boolean, note: string) {
    setGradingAssign(true);
    try {
      await adminPost(`/api/admin/contests/registrations/${inlineId}/grade-assignment`, { pass, note });
      toast({ title: pass ? "测试单审核：通过" : "测试单审核：不通过" });
      refetch();
    } catch (e: unknown) {
      toast({ title: "审核失败", description: e instanceof Error ? e.message : "未知错误", variant: "destructive" });
    } finally {
      setGradingAssign(false);
    }
  }

  const st = STATUS_MAP[detail?.status ?? ""] ?? { label: detail?.status ?? "", color: "bg-slate-100 text-slate-600" };

  const assignQuestion = detail?.testGrade === "A" ? detail?.track?.aQuestion
    : detail?.testGrade === "B" ? detail?.track?.bQuestion
    : detail?.testGrade === "C" ? detail?.track?.cQuestion
    : null;

  return (
    <div>
      {/* Back */}
      <button onClick={() => inlineNav?.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-700 mb-6 font-semibold transition-colors">
        <ArrowLeft size={16} /> 返回报名列表
      </button>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : !detail ? (
        <div className="text-center py-24 text-slate-400 text-sm">报名记录不存在</div>
      ) : (
        <>
          {/* Header card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl font-extrabold text-blue-900">{detail.userNickname ?? "—"}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span>
                  <CatBadge name={detail.track?.catName} colorHex={detail.track?.catColorHex} />
                </div>
                {detail.userPhone && <p className="text-sm text-slate-400 mt-1">{detail.userPhone}</p>}
                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3 text-xs text-slate-500">
                  {detail.contestTitle && (
                    <div><span className="font-semibold text-slate-600 block mb-0.5">大赛</span>{detail.contestTitle}</div>
                  )}
                  <div><span className="font-semibold text-slate-600 block mb-0.5">报名时间</span>{fmtDate(detail.createdAt)}</div>
                  {detail.contestPublicAt && (
                    <div>
                      <span className="font-semibold text-slate-600 block mb-0.5">公示日期</span>
                      {fmtDate(detail.contestPublicAt)}
                      {detail.daysToPublic !== null && detail.daysToPublic >= 0 && (
                        <span className={`ml-1 font-bold ${detail.daysToPublic <= 1 ? "text-red-500" : detail.daysToPublic <= 3 ? "text-amber-500" : "text-slate-400"}`}>
                          （{detail.daysToPublic}天后）
                        </span>
                      )}
                    </div>
                  )}
                  {detail.gradeNote && <div><span className="font-semibold text-slate-600 block mb-0.5">运营备注</span>{detail.gradeNote}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Submissions */}
          <div className="flex flex-col gap-6">
            <TestSubmissionBlock
              question={detail.track?.testQuestion}
              content={detail.testContent ?? null}
              attachments={detail.testAttachments as Attachment[] | null}
              urls={detail.testUrls as string[] | null}
              grade={detail.testGrade ?? null}
              onGrade={gradeTest}
              grading={gradingTest}
            />
            <AssignmentSubmissionBlock
              question={assignQuestion}
              content={detail.assignmentContent ?? null}
              attachments={detail.assignmentAttachments as Attachment[] | null}
              urls={detail.assignmentUrls as string[] | null}
              grade={detail.assignmentGrade ?? null}
              onReview={reviewAssignment}
              reviewing={gradingAssign}
              testGrade={detail.testGrade ?? null}
            />
          </div>
        </>
      )}
    </div>
  );
}
