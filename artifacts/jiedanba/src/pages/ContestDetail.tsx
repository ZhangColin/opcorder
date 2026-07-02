import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Users, Trophy, ChevronRight, Loader2, AlertCircle,
  Zap, Star, CheckCircle2, Medal, BookOpen, X,
} from "lucide-react";
import { getAccessToken, getStoredUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { RichTextView } from "@/components/RichTextEditor";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Phase = "pre_announcement" | "pre_registration" | "registration" | "pre_public" | "public" | "benefit" | "ended";

interface TrackQuestion {
  id: number;
  title: string;
  content: string | null;
  attachments?: unknown[];
}

interface Track {
  id: number;
  catName: string | null;
  catColorHex: string | null;
  testDurationHours: number;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  testQuestion: TrackQuestion | null;
}

interface Contest {
  id: number;
  title: string;
  details: string | null;
  announcementAt: string;
  registrationAt: string;
  publicAt: string;
  benefitAt: string;
  deadlineAt: string;
  phase: Phase;
  tracks: Track[];
}

interface PassedUser { nickname: string | null; avatar: string | null; }
interface PublicTrack {
  trackId: number;
  catName: string | null;
  catColorHex: string | null;
  passedUsers: PassedUser[];
}

/* ─── Countdown hook ─── */
function useCountdown(targetIso: string | undefined) {
  const [ms, setMs] = useState(() => targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0);
  useEffect(() => {
    if (!targetIso) return;
    const timer = setInterval(() => {
      setMs(Math.max(0, new Date(targetIso).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = pad(Math.floor((total % 86400) / 3600));
  const m = pad(Math.floor((total % 3600) / 60));
  const s = pad(total % 60);
  return { ms, d, h, m, s, expired: ms === 0 };
}

/* ─── Phase label ─── */
function phaseBadge(phase: Phase) {
  const map: Record<Phase, { label: string; cls: string }> = {
    pre_announcement: { label: "未公告", cls: "bg-slate-100 text-slate-500" },
    pre_registration: { label: "待报名", cls: "bg-amber-100 text-amber-700" },
    registration:     { label: "报名中", cls: "bg-emerald-100 text-emerald-700" },
    pre_public:       { label: "已截止", cls: "bg-slate-100 text-slate-500" },
    public:           { label: "公示中", cls: "bg-blue-100 text-blue-700" },
    benefit:          { label: "权益发放", cls: "bg-violet-100 text-violet-700" },
    ended:            { label: "已结束", cls: "bg-slate-100 text-slate-500" },
  };
  const cfg = map[phase];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

/* ─── Format date ─── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─── Timeline ─── */
function Timeline({ contest }: { contest: Contest }) {
  const now = Date.now();
  const nodes = [
    { label: "公告",   at: contest.announcementAt },
    { label: "开始报名", at: contest.registrationAt },
    { label: "公示",   at: contest.publicAt },
    { label: "权益发放", at: contest.benefitAt },
    { label: "活动截止", at: contest.deadlineAt },
  ];

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {nodes.map((n, i) => {
          const isPast = now >= new Date(n.at).getTime();
          const isCurrent = i < nodes.length - 1 && isPast && now < new Date(nodes[i + 1].at).getTime();
          return (
            <div key={i} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  isPast ? "bg-white text-primary shadow-md" : "bg-white/20 text-white/60"
                } ${isCurrent ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""}`}>
                  {isPast ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <div className={`mt-1.5 text-center ${isPast ? "text-white" : "text-white/50"}`}>
                  <div className="text-[10px] font-black whitespace-nowrap">{n.label}</div>
                  <div className="text-[9px] font-medium whitespace-nowrap opacity-80">{fmtDate(n.at)}</div>
                </div>
              </div>
              {i < nodes.length - 1 && (
                <div className={`h-0.5 flex-1 mt-3.5 mx-1 min-w-[24px] ${isPast && now >= new Date(nodes[i + 1].at).getTime() ? "bg-white" : "bg-white/20"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Question Modal ─── */
function QuestionModal({
  track,
  onConfirm,
  onClose,
  registering,
  isRegistered,
}: {
  track: Track;
  onConfirm: () => void;
  onClose: () => void;
  registering: boolean;
  isRegistered: boolean;
}) {
  const q = track.testQuestion!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <span className="font-extrabold text-blue-900 text-base">测试题目</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        {/* Track badge */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <span
            className="px-3 py-1 rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: track.catColorHex || "#6b7280" }}
          >
            {track.catName ?? "未知赛道"}
          </span>
          <span className="ml-3 text-xs text-slate-400 flex items-center gap-1 inline-flex">
            <Clock size={11} /> 测试时限 {track.testDurationHours} 小时
          </span>
        </div>
        {/* Question content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="font-extrabold text-blue-900 text-base mb-4">{q.title}</h3>
          {q.content ? (
            <RichTextView html={q.content} />
          ) : (
            <p className="text-sm text-slate-400 italic">题目内容暂未公开，报名后可见。</p>
          )}
        </div>
        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            {isRegistered ? "关闭" : "取消"}
          </button>
          {isRegistered ? (
            <button
              disabled
              className="flex-1 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2 cursor-default"
            >
              <CheckCircle2 size={14} /> 已报名
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={registering}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {registering ? <><Loader2 size={14} className="animate-spin" />报名中…</> : <><Zap size={14} />确认报名</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Track Card ─── */
function TrackCard({
  track,
  phase,
  contest,
  onRegister,
  registering,
  isRegistered,
}: {
  track: Track;
  phase: Phase;
  contest: Contest;
  onRegister: (trackId: number) => void;
  registering: number | null;
  isRegistered: boolean;
}) {
  const [showQuestion, setShowQuestion] = useState(false);
  const countdown = useCountdown(phase === "pre_registration" ? contest.registrationAt : undefined);
  const quotaPct = Math.min(100, Math.round(((track.quotaTotal - track.quotaRemaining) / Math.max(1, track.quotaTotal)) * 100));
  const isRegistering = registering === track.id;

  function ButtonArea() {
    if (phase === "pre_registration") {
      return (
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">距报名开始</p>
          <div className="flex items-center justify-center gap-1 text-sm font-black text-primary">
            <span>{countdown.d}天</span>
            <span>{countdown.h}:{countdown.m}:{countdown.s}</span>
          </div>
          <button disabled className="mt-2 w-full py-2 rounded-xl bg-slate-100 text-slate-400 text-sm font-bold cursor-not-allowed">
            即将开放
          </button>
        </div>
      );
    }
    if (phase === "registration") {
      if (isRegistered) {
        if (track.testQuestion) {
          return (
            <button
              onClick={() => setShowQuestion(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} /> 已报名 · 查看题目
            </button>
          );
        }
        return (
          <button disabled className="w-full py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2 cursor-default">
            <CheckCircle2 size={14} /> 已报名
          </button>
        );
      }
      if (track.quotaRemaining <= 0) {
        return <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-bold cursor-not-allowed">报名已满</button>;
      }
      if (track.testQuestion) {
        return (
          <button
            onClick={() => setShowQuestion(true)}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <BookOpen size={14} /> 查看题目
          </button>
        );
      }
      return (
        <button
          onClick={() => onRegister(track.id)}
          disabled={isRegistering}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isRegistering ? <><Loader2 size={14} className="animate-spin" />报名中…</> : <><Zap size={14} />立即报名</>}
        </button>
      );
    }
    if (phase === "pre_public" || phase === "public" || phase === "benefit" || phase === "ended") {
      return null;
    }
    return null;
  }

  return (
    <>
      {showQuestion && (
        <QuestionModal
          track={track}
          onConfirm={() => { setShowQuestion(false); onRegister(track.id); }}
          onClose={() => setShowQuestion(false)}
          registering={isRegistering}
          isRegistered={isRegistered}
        />
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <span
              className="px-3 py-1 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: track.catColorHex || "#6b7280" }}
            >
              {track.catName ?? "未知赛道"}
            </span>
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <Clock size={11} /> 测试时限 {track.testDurationHours} 小时
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-blue-900">{track.quotaRemaining}</div>
            <div className="text-xs text-slate-400">剩余名额</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>名额进度</span>
            <span>{track.quotaTotal - track.quotaRemaining} / {track.quotaTotal}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        </div>
        <ButtonArea />
      </div>
    </>
  );
}

/* ─── Public list ─── */
function PublicList({ contestId, benefitAt }: { contestId: number; benefitAt: string }) {
  const { data, isLoading } = useQuery<PublicTrack[]>({
    queryKey: ["contest-public-list", contestId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/contests/${contestId}/public-list`);
      if (!res.ok) throw new Error("获取公示名单失败");
      return res.json();
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" />加载公示名单…</div>;
  if (!data?.length) return null;

  return (
    <section>
      <h2 className="text-xl font-extrabold text-blue-900 mb-1 flex items-center gap-2">
        <Medal size={20} className="text-amber-500" /> 通过公示名单
      </h2>
      <p className="text-xs text-slate-400 mb-4">权益发放时间：{fmtDate(benefitAt)}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(track => (
          <div key={track.trackId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: track.catColorHex || "#6b7280" }}>
                {track.catName ?? "未知"}
              </span>
              <span className="text-xs text-slate-400">{track.passedUsers.length} 人通过</span>
            </div>
            {track.passedUsers.length === 0 ? (
              <p className="text-sm text-slate-400">暂无通过人员</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {track.passedUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.nickname ?? ""} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                        {(u.nickname ?? "?")[0]}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-700">{u.nickname ?? "匿名"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Main page ─── */
export default function ContestDetail() {
  const { id } = useParams<{ id: string }>();
  const [currentPath, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [registering, setRegistering] = useState<number | null>(null);

  const { data: contest, isLoading, isError } = useQuery<Contest>({
    queryKey: ["contest-detail", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/contests/${id}`);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "大赛不存在"); }
      return res.json();
    },
    retry: false,
  });

  const token = getAccessToken();
  const { data: myRegs } = useQuery<{ items: Array<{ trackId: number }> }>({
    queryKey: ["contest-my-regs", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/contests/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : { items: [] };
    },
    enabled: !!token,
    staleTime: 30_000,
  });
  const registeredTrackIds = new Set((myRegs?.items ?? []).map(r => r.trackId));

  async function handleRegister(trackId: number) {
    const user = getStoredUser();
    const token = getAccessToken();
    if (!user || !token) {
      sessionStorage.setItem("returnTo", currentPath);
      navigate("/login");
      return;
    }
    setRegistering(trackId);
    try {
      const res = await fetch(`${BASE}/api/contests/${id}/tracks/${trackId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "报名失败");
      toast({ title: "报名成功！即将跳转至个人中心" });
      qc.invalidateQueries({ queryKey: ["contest-detail", id] });
      qc.invalidateQueries({ queryKey: ["contest-my-regs", id] });
      setTimeout(() => navigate(`/profile/contests/${data.id}`), 800);
    } catch (e: any) {
      toast({ title: "报名失败", description: e.message, variant: "destructive" });
    } finally {
      setRegistering(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm">正在加载大赛信息…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !contest) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <AlertCircle size={48} className="text-slate-300" />
            <h1 className="text-2xl font-extrabold text-slate-700">大赛不存在</h1>
            <p className="text-slate-400 text-sm">该活动页面可能尚未开放或链接有误</p>
            <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showPublicList = ["public", "benefit", "ended"].includes(contest.phase);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ── Hero gradient ── */}
      <div
        className="relative overflow-hidden pt-16"
        style={{ background: "linear-gradient(135deg, #00327d 0%, #0047ab 50%, #1565c0 100%)" }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #fff 0%, transparent 50%), radial-gradient(circle at 80% 20%, #60a5fa 0%, transparent 40%)" }} />
        <div className="relative max-w-5xl mx-auto px-6 py-12 lg:py-16">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={18} className="text-amber-300" />
                <span className="text-amber-200 text-xs font-bold uppercase tracking-widest">OPC 月度大赛</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight">{contest.title}</h1>
            </div>
            {phaseBadge(contest.phase)}
          </div>
          <Timeline contest={contest} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-6 py-10 w-full flex flex-col gap-10">

        {/* Contest details */}
        {contest.details && (
          <section>
            <h2 className="text-xl font-extrabold text-blue-900 mb-4 flex items-center gap-2">
              <Star size={18} className="text-primary" /> 大赛介绍
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <RichTextView html={contest.details} />
            </div>
          </section>
        )}

        {/* Tracks */}
        <section>
          <h2 className="text-xl font-extrabold text-blue-900 mb-2 flex items-center gap-2">
            <Users size={18} className="text-primary" /> 赛道报名
          </h2>
          {["pre_public", "public", "benefit", "ended"].includes(contest.phase) ? (
            <p className="text-sm text-slate-400 mb-4">报名已截止</p>
          ) : contest.phase === "registration" ? (
            <p className="text-sm text-emerald-600 font-semibold mb-4 flex items-center gap-1"><CheckCircle2 size={14} />报名进行中！</p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contest.tracks.map(track => (
              <TrackCard
                key={track.id}
                track={track}
                phase={contest.phase}
                contest={contest}
                onRegister={handleRegister}
                registering={registering}
                isRegistered={registeredTrackIds.has(track.id)}
              />
            ))}
          </div>
        </section>

        {/* Public list */}
        {showPublicList && (
          <PublicList contestId={contest.id} benefitAt={contest.benefitAt} />
        )}

      </div>

      <Footer />
    </div>
  );
}
