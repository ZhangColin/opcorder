import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, AlertCircle, ArrowLeft, Clock, CheckCircle2, Paperclip,
  Link2, X, UploadCloud, Trophy, BookOpen,
} from "lucide-react";
import { uploadFile } from "@/lib/v2api";
import { getAccessToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Grade = "A" | "B" | "C" | "fail" | null;
type RegistrationStatus =
  | "registered" | "test_submitted" | "test_passed" | "test_failed"
  | "assignment_submitted" | "assignment_passed" | "assignment_failed";

interface Question {
  id: number;
  title: string;
  content: string;
  attachments?: Array<{ name: string; url: string }>;
}

interface RegistrationDetail {
  id: number;
  contestId: number;
  trackId: number;
  status: RegistrationStatus;
  createdAt: string;
  contestTitle: string | null;
  contestRegistrationAt: string | null;
  contestPublicAt: string | null;
  contestBenefitAt: string | null;
  contestDeadlineAt: string | null;
  catName: string | null;
  catColorHex: string | null;
  testDurationHours: number;
  aDurationHours: number;
  bDurationHours: number;
  cDurationHours: number;
  testGrade: Grade;
  assignmentGrade: Grade;
  testSubmittedAt: string | null;
  testContent: string | null;
  testAttachments: Array<{ name: string; url: string }> | null;
  testUrls: string[] | null;
  assignmentSubmittedAt: string | null;
  assignmentContent: string | null;
  assignmentAttachments: Array<{ name: string; url: string }> | null;
  assignmentUrls: string[] | null;
  testQuestion: Question | null;
  assignmentQuestion: Question | null;
}

/* ─── Countdown ─── */
function useCountdown(deadlineIso: string | null) {
  const [ms, setMs] = useState(() => deadlineIso ? Math.max(0, new Date(deadlineIso).getTime() - Date.now()) : 0);
  useEffect(() => {
    if (!deadlineIso) return;
    const t = setInterval(() => setMs(Math.max(0, new Date(deadlineIso).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [deadlineIso]);
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { ms, d, h: pad(h), m: pad(m), s: pad(s), expired: ms === 0 };
}

/* ─── Status badge ─── */
const STATUS_CFG: Record<RegistrationStatus, { label: string; cls: string }> = {
  registered:           { label: "已报名",      cls: "bg-blue-100 text-blue-700" },
  test_submitted:       { label: "测试题已提交", cls: "bg-amber-100 text-amber-700" },
  test_passed:          { label: "测试题已通过", cls: "bg-emerald-100 text-emerald-700" },
  test_failed:          { label: "测试题未通过", cls: "bg-red-100 text-red-600" },
  assignment_submitted: { label: "测试单已提交", cls: "bg-violet-100 text-violet-700" },
  assignment_passed:    { label: "测试单已通过", cls: "bg-emerald-100 text-emerald-700" },
  assignment_failed:    { label: "测试单未通过", cls: "bg-red-100 text-red-600" },
};

const GRADE_CFG: Record<string, { label: string; cls: string }> = {
  A:    { label: "A 级", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  B:    { label: "B 级", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  C:    { label: "C 级", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  fail: { label: "不通过", cls: "bg-red-50 text-red-600 border-red-200" },
};

/* ─── Attachment list (read-only) ─── */
function AttachmentList({ items }: { items: Array<{ name: string; url: string }> }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {items.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
          <Paperclip size={11} className="text-slate-400 shrink-0" /> {a.name}
        </a>
      ))}
    </div>
  );
}

/* ─── Countdown block ─── */
function CountdownBlock({ deadline, label }: { deadline: string; label: string }) {
  const cd = useCountdown(deadline);
  if (cd.expired) {
    return <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold"><AlertCircle size={13} />提交已截止</div>;
  }
  const urgent = cd.d === 0 && Number(cd.h) < 2;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock size={14} className={urgent ? "text-red-500" : "text-amber-500"} />
      <span className="text-slate-500 text-xs">{label}剩余：</span>
      <span className={`font-black tabular-nums ${urgent ? "text-red-600" : "text-amber-600"}`}>
        {cd.d > 0 ? `${cd.d}天 ` : ""}{cd.h}:{cd.m}:{cd.s}
      </span>
    </div>
  );
}

/* ─── Section card ─── */
function SectionCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">{title}</div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* ─── Submitted view ─── */
function SubmittedView({ content, attachments, urls }: {
  content: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  urls: string[] | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
        <CheckCircle2 size={16} /> 已提交，不可修改
      </div>
      {content ? (
        <div className="bg-slate-50 rounded-xl p-4">
          <MarkdownContent content={content} />
        </div>
      ) : <p className="text-sm text-slate-400">无文字描述</p>}
      {attachments && attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1">附件</p>
          <AttachmentList items={attachments} />
        </div>
      )}
      {urls && urls.filter(u => u.trim()).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1">在线地址</p>
          {urls.filter(u => u.trim()).map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1.5 mb-1">
              <Link2 size={10} /> {u}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Submission form ─── */
function SubmissionForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (data: { content: string; attachments: Array<{ name: string; url: string }>; urls: string[] }) => void;
  submitting: boolean;
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [urls, setUrls] = useState<string[]>([""]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setAttachments(prev => [...prev, { name: file.name, url }]);
    } catch {
      toast({ title: "附件上传失败", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function doSubmit() {
    setConfirming(false);
    onSubmit({ content, attachments, urls: urls.filter(u => u.trim()) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">答题内容（Markdown）</label>
        <MarkdownEditor value={content} onChange={setContent} placeholder="请详细描述您的解题思路和答案…" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">附件</label>
        <div className="flex flex-col gap-1.5">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Paperclip size={11} className="text-slate-400 shrink-0" />
              <span className="truncate flex-1">{a.name}</span>
              <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                className="text-slate-300 hover:text-red-500 shrink-0"><X size={11} /></button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {uploading ? <><Loader2 size={11} className="animate-spin" />上传中…</> : <><UploadCloud size={11} />点击上传附件</>}
          </button>
          <input ref={inputRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">在线地址（可选）</label>
        <div className="flex flex-col gap-2">
          {urls.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={u}
                  onChange={e => setUrls(p => p.map((v, j) => j === i ? e.target.value : v))}
                  placeholder="https://github.com/..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                />
              </div>
              {urls.length > 1 && (
                <button type="button" onClick={() => setUrls(p => p.filter((_, j) => j !== i))}
                  className="text-slate-300 hover:text-red-500 p-1"><X size={14} /></button>
              )}
            </div>
          ))}
          {urls.length < 5 && (
            <button type="button" onClick={() => setUrls(p => [...p, ""])}
              className="text-xs text-primary hover:underline text-left">+ 添加链接</button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-slate-800">确认提交</h3>
            <p className="text-sm text-slate-500">提交后不可修改，请确认您的答案已完整填写。</p>
            <div className="flex gap-3">
              <button onClick={doSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <><Loader2 size={14} className="animate-spin" />提交中…</> : "确认提交"}
              </button>
              <button onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setConfirming(true)}
        disabled={submitting || uploading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? <><Loader2 size={15} className="animate-spin" />提交中…</> : "提交答案"}
      </button>
    </div>
  );
}

/* ─── Question section ─── */
function QuestionSection({ question }: { question: Question }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
        <BookOpen size={15} className="text-primary" /> {question.title}
      </h3>
      {question.content && (
        <div className="bg-slate-50 rounded-xl p-4 mb-3 prose prose-sm prose-slate max-w-none">
          <MarkdownContent content={question.content} />
        </div>
      )}
      {question.attachments && question.attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <Paperclip size={11} /> 题目附件
          </p>
          <AttachmentList items={question.attachments} />
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function ContestRegistrationDetail() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = getAccessToken();

  const { data: reg, isLoading, isError } = useQuery<RegistrationDetail>({
    queryKey: ["contest-reg-detail", registrationId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/contests/my/${registrationId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "加载失败"); }
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  async function submit(type: "test" | "assignment", data: { content: string; attachments: Array<{ name: string; url: string }>; urls: string[] }) {
    const res = await fetch(`${BASE}/api/contests/registrations/${registrationId}/${type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "提交失败");
    return json;
  }

  const testMut = useMutation({
    mutationFn: (data: Parameters<typeof submit>[1]) => submit("test", data),
    onSuccess: () => {
      toast({ title: "测试题提交成功！" });
      qc.invalidateQueries({ queryKey: ["contest-reg-detail", registrationId] });
      qc.invalidateQueries({ queryKey: ["my-contests"] });
    },
    onError: (e: Error) => toast({ title: "提交失败", description: e.message, variant: "destructive" }),
  });

  const assignMut = useMutation({
    mutationFn: (data: Parameters<typeof submit>[1]) => submit("assignment", data),
    onSuccess: () => {
      toast({ title: "测试单提交成功！" });
      qc.invalidateQueries({ queryKey: ["contest-reg-detail", registrationId] });
      qc.invalidateQueries({ queryKey: ["my-contests"] });
    },
    onError: (e: Error) => toast({ title: "提交失败", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" /><span className="text-sm">加载中…</span>
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !reg) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <AlertCircle size={36} className="opacity-30" />
          <p className="text-sm">报名记录不存在或无权查看</p>
          <button onClick={() => navigate("/profile")} className="text-xs text-primary hover:underline">返回个人中心</button>
        </div>
        <Footer />
      </div>
    );
  }

  const statusCfg = STATUS_CFG[reg.status] ?? { label: reg.status, cls: "bg-slate-100 text-slate-600" };

  const testDeadline = reg.contestRegistrationAt && reg.testDurationHours
    ? new Date(new Date(reg.contestRegistrationAt).getTime() + reg.testDurationHours * 3600_000).toISOString()
    : null;
  const testExpired = testDeadline ? Date.now() > new Date(testDeadline).getTime() : false;

  const assignDurationHours = reg.testGrade === "A" ? reg.aDurationHours : reg.testGrade === "B" ? reg.bDurationHours : reg.cDurationHours;
  const assignDeadline = reg.contestBenefitAt && assignDurationHours
    ? new Date(new Date(reg.contestBenefitAt).getTime() + assignDurationHours * 3600_000).toISOString()
    : null;
  const assignExpired = assignDeadline ? Date.now() > new Date(assignDeadline).getTime() : false;

  const benefitUnlocked = reg.contestBenefitAt ? Date.now() >= new Date(reg.contestBenefitAt).getTime() : false;
  const showAssignment = benefitUnlocked && reg.testGrade && reg.testGrade !== "fail";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        {/* Back + Header */}
        <div>
          <button onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors mb-4">
            <ArrowLeft size={15} /> 返回个人中心
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold text-blue-900">{reg.contestTitle ?? "OPC 大赛"}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {reg.catName && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: reg.catColorHex || "#6b7280" }}>
                    {reg.catName}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusCfg.cls}`}>
                  {statusCfg.label}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(reg.createdAt).toLocaleDateString("zh-CN")} 报名
                </span>
              </div>
            </div>
            <Trophy size={28} className="text-amber-400 mt-1 shrink-0" />
          </div>
        </div>

        {/* ── 测试题区块 ── */}
        <SectionCard
          title={
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <span className="font-bold text-blue-900 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">1</span>
                测试题
              </span>
              {!reg.testSubmittedAt && testDeadline && !testExpired && (
                <CountdownBlock deadline={testDeadline} label="提交" />
              )}
              {reg.testSubmittedAt && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> 已提交 · {new Date(reg.testSubmittedAt).toLocaleString("zh-CN")}
                </span>
              )}
              {!reg.testSubmittedAt && testExpired && (
                <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                  <AlertCircle size={13} /> 已截止
                </span>
              )}
            </div>
          }
        >
          {reg.testQuestion ? (
            <QuestionSection question={reg.testQuestion} />
          ) : (
            <p className="text-sm text-slate-400 mb-4">题目信息加载中或暂未公开</p>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">我的答案</p>
            {reg.testSubmittedAt ? (
              <SubmittedView content={reg.testContent} attachments={reg.testAttachments} urls={reg.testUrls} />
            ) : testExpired ? (
              <div className="flex items-center gap-2 text-sm text-red-500 font-semibold">
                <AlertCircle size={15} /> 提交时间已截止
              </div>
            ) : (
              <SubmissionForm onSubmit={data => testMut.mutate(data)} submitting={testMut.isPending} />
            )}
          </div>
        </SectionCard>

        {/* ── 测试单区块 ── */}
        {showAssignment && (
          <SectionCard
            title={
              <div className="flex items-center justify-between w-full flex-wrap gap-2">
                <span className="font-bold text-blue-900 text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 text-xs font-black flex items-center justify-center">2</span>
                  测试单
                </span>
                {!reg.assignmentSubmittedAt && assignDeadline && !assignExpired && (
                  <CountdownBlock deadline={assignDeadline} label="提交" />
                )}
                {reg.assignmentSubmittedAt && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> 已提交 · {new Date(reg.assignmentSubmittedAt).toLocaleString("zh-CN")}
                  </span>
                )}
              </div>
            }
          >
            {reg.assignmentQuestion ? (
              <QuestionSection question={reg.assignmentQuestion} />
            ) : (
              <p className="text-sm text-slate-400 mb-4">题目信息加载中…</p>
            )}

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">我的答案</p>
              {reg.assignmentSubmittedAt ? (
                <SubmittedView content={reg.assignmentContent} attachments={reg.assignmentAttachments} urls={reg.assignmentUrls} />
              ) : assignExpired ? (
                <div className="flex items-center gap-2 text-sm text-red-500 font-semibold">
                  <AlertCircle size={15} /> 提交时间已截止
                </div>
              ) : (
                <SubmissionForm onSubmit={data => assignMut.mutate(data)} submitting={assignMut.isPending} />
              )}
            </div>
          </SectionCard>
        )}

        {/* ── 评级结果 ── */}
        {(reg.testGrade || reg.assignmentGrade) && (
          <SectionCard
            title={
              <span className="font-bold text-blue-900 text-base flex items-center gap-2">
                <Trophy size={16} className="text-amber-400" /> 评级结果
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4">
              {reg.testGrade && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">测试题</p>
                  <span className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black border w-fit ${GRADE_CFG[reg.testGrade]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                    {GRADE_CFG[reg.testGrade]?.label ?? reg.testGrade}
                  </span>
                </div>
              )}
              {reg.assignmentGrade && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">测试单</p>
                  <span className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black border w-fit ${GRADE_CFG[reg.assignmentGrade]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                    {GRADE_CFG[reg.assignmentGrade]?.label ?? reg.assignmentGrade}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        )}

      </div>
      <Footer />
    </div>
  );
}
