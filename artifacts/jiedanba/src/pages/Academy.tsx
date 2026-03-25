import { useState } from "react";
import {
  CheckCircle2, Star, Lock, Trophy, FileText, Video,
  Download, ChevronRight, Zap, Cpu, ShieldCheck,
  BookOpen, ArrowRight, PlayCircle, Loader2,
} from "lucide-react";
import {
  useGetCurrentUser, useGetOpcProfile,
  useListCourses, useListMyEnrollments, useEnrollCourse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Course } from "@workspace/api-client-react";

/* ─── Static Data ─────────────────────────────── */

const CERTS = [
  {
    id: "C",
    label: "C 级 · 新手",
    icon: CheckCircle2,
    features: ["接受标准数据标注任务", "基础提示词优化模块", "平台社区支持"],
  },
  {
    id: "B",
    label: "B 级 · 进阶",
    icon: Star,
    features: ["优先获取限时高价值任务", "精准任务完成奖励 +5%", "AI 大模型微调工具 Beta 权限"],
  },
  {
    id: "A",
    label: "A 级 · 专家",
    icon: Trophy,
    features: ["定向邀请高价值政企项目", "专属 AI 培训工作坊", "核心开发团队一对一指导"],
  },
];

const COURSE_ICONS: Record<string, React.ElementType> = {
  tech: Cpu,
  strategy: BookOpen,
  compliance: ShieldCheck,
  operations: Zap,
};

const COURSE_GRADS: Record<string, string> = {
  tech: "from-blue-700 to-indigo-900",
  strategy: "from-emerald-700 to-teal-900",
  compliance: "from-slate-600 to-blue-900",
  operations: "from-violet-700 to-purple-900",
};

const CATEGORY_LABELS: Record<string, string> = {
  tech: "技术",
  strategy: "战略",
  compliance: "合规",
  operations: "运营",
};

const RESOURCES = [
  { icon: FileText, color: "text-red-500", name: "A 级认证考核指南（官方版）", meta: "PDF 文档 · 2.4 MB", action: <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" /> },
  { icon: FileText, color: "text-blue-500", name: "大模型架构与权重全景概览", meta: "DOCX · 1.1 MB", action: <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" /> },
  { icon: Video, color: "text-green-500", name: "工作坊录播：GPU 推理优化实战", meta: "MP4 视频 · 145 MB", action: <PlayCircle size={18} className="text-muted-foreground group-hover:text-primary transition-colors" /> },
];

const ASSESSMENTS = [
  { day: "10", month: "APR", title: "A 级最终认证考核", detail: "10:00 · 远程监考", urgent: true },
  { day: "25", month: "APR", title: "提示词大师工坊",   detail: "14:30 · Zoom 直播", urgent: false },
];

/* ─── Sub-components ────────────────────────────── */

function CircleProgress({ pct, label, sublabel }: { pct: number; label: string; sublabel: string }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/20" />
        <circle cx="64" cy="64" r={r} fill="transparent" stroke="currentColor" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-[#4dffb2] transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold font-display">{label}</span>
        <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">{sublabel}</span>
      </div>
    </div>
  );
}

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} 小时${m > 0 ? ` ${m} 分` : ""}` : `${m} 分钟`;
}

/* ─── Course Card ────────────────────────────────── */

function CourseCard({
  course,
  enrolledPct,
  isEnrolling,
  onEnroll,
}: {
  course: Course;
  enrolledPct: number | null;
  isEnrolling: boolean;
  onEnroll: (courseId: number) => void;
}) {
  const Icon = COURSE_ICONS[course.category] ?? Cpu;
  const grad = COURSE_GRADS[course.category] ?? "from-blue-700 to-indigo-900";
  const catLabel = CATEGORY_LABELS[course.category] ?? "其他";
  const isEnrolled = enrolledPct !== null;

  return (
    <div className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-border/40">
      <div className={`relative h-44 bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <Icon size={52} className="text-white/50 group-hover:scale-110 transition-transform duration-500" />
        {course.badge && (
          <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
            {course.badge}
          </div>
        )}
        {isEnrolled && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
            <div className="h-full bg-[#4dffb2] transition-all" style={{ width: `${enrolledPct}%` }} />
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-secondary/15 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{catLabel}</span>
          <span className="text-muted-foreground text-xs font-medium">{durationLabel(course.durationMinutes)}</span>
          {isEnrolled && <span className="ml-auto text-xs text-secondary font-bold">{enrolledPct}% 已完成</span>}
        </div>
        <h4 className="text-lg font-bold font-display mb-2 leading-tight text-foreground">{course.title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{course.description}</p>

        <div className="flex items-center justify-between">
          <div>
            {course.rating ? (
              <div className="flex items-center gap-1 text-xs text-secondary font-bold">
                <Star size={12} className="fill-secondary" />
                {course.rating} {course.learnersCount ? `(${course.learnersCount.toLocaleString()})` : ""}
              </div>
            ) : course.learnersCount ? (
              <span className="text-xs text-muted-foreground">{course.learnersCount.toLocaleString()} 学员</span>
            ) : null}
          </div>
          <button
            onClick={() => onEnroll(course.id)}
            disabled={isEnrolling}
            className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all disabled:opacity-50"
          >
            {isEnrolling ? (
              <><Loader2 size={14} className="animate-spin" /> 报名中</>
            ) : isEnrolled ? (
              <><PlayCircle size={14} /> 继续学习</>
            ) : (
              <>开始学习 <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */

type CourseFilter = "all" | "tech" | "strategy" | "compliance" | "operations";

export default function Academy() {
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const [enrollingId, setEnrollingId]   = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: user }    = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });

  const level    = profile?.level ?? "B";
  const credits  = profile?.creditScore ?? 4.8;
  const nickname = user?.nickname || profile?.nickname || "OPC学员";

  const levelOrder  = ["C", "B", "A"];
  const userIdx     = levelOrder.indexOf(level);
  const heroProgress = level === "A" ? 100 : level === "B" ? 67 : 33;
  const heroLabel    = `Lv.${level}`;
  const nextLevel    = level === "A" ? "顶级认证" : level === "B" ? "A 级专家" : "B 级进阶";
  const heroCredits  = level === "A" ? "600 / 600" : level === "B" ? "450 / 600" : "150 / 300";

  const { data: courses = [], isLoading: coursesLoading } = useListCourses(
    courseFilter !== "all" ? { category: courseFilter } : {}
  );

  const { data: enrollments = [] } = useListMyEnrollments(
    { userId: user?.id ?? 1 },
    { query: { enabled: !!user?.id } }
  );

  const enrollmentMap = new Map(enrollments.map(e => [e.courseId, e.progressPct]));

  const { mutateAsync: enrollCourse } = useEnrollCourse();

  const handleEnroll = async (courseId: number) => {
    if (!user?.id) return;
    setEnrollingId(courseId);
    try {
      await enrollCourse({ courseId, data: { userId: user.id } });
      qc.invalidateQueries({ queryKey: ["/courses/my-enrollments"] });
    } finally {
      setEnrollingId(null);
    }
  };

  const inProgress = enrollments.filter(e => e.progressPct > 0 && e.progressPct < 100).slice(0, 2);

  return (
    <div className="space-y-12">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#0047ab] p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 space-y-4 max-w-xl">
          <span className="inline-block px-3 py-1 bg-[#4dffb2] text-[#002112] font-bold text-xs rounded-full uppercase tracking-wider">学员档案</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-display">欢迎回来，{nickname}。</h1>
          <p className="text-white/80 text-lg max-w-md leading-relaxed">
            您的高价值政企项目匹配路径已完成{" "}
            <span className="text-[#4dffb2] font-bold">{heroProgress}%</span>。解锁下一等级，获得优先派单资格。
          </p>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 flex flex-col items-center gap-4 w-full md:w-80 shrink-0">
          <CircleProgress pct={heroProgress} label={heroLabel} sublabel="当前等级" />
          <div className="text-center">
            <p className="text-sm font-medium text-white/80">下一阶段：<span className="text-white font-bold">{nextLevel}</span></p>
            <p className="text-xs text-white/60 mt-1">{heroCredits} 积分已获得</p>
          </div>
          <button className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary/90 transition-all text-sm">查看升级要求</button>
        </div>
      </section>

      {/* CERT ROADMAP */}
      <section>
        <h2 className="text-2xl font-extrabold font-display mb-6 text-primary">OPC 专业认证路线图</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CERTS.map((cert, i) => {
            const Icon = cert.icon;
            const isDone    = i < userIdx;
            const isCurrent = i === userIdx;
            const isLocked  = i > userIdx;
            return (
              <div key={cert.id} className={`relative p-8 rounded-2xl overflow-hidden transition-all ${
                isCurrent ? "bg-white border-2 border-primary ring-4 ring-primary/5 shadow-xl"
                : isDone   ? "bg-muted/40 border border-border/40"
                           : "bg-muted/40 border border-border/40 opacity-70 grayscale hover:grayscale-0 hover:opacity-100"
              }`}>
                <div className={`absolute top-4 right-4 ${isCurrent ? "text-primary/10" : "text-muted-foreground/10"}`}><Icon size={64} /></div>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCurrent ? "bg-primary text-white" : isDone ? "bg-secondary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {isLocked ? <Lock size={18} /> : <Icon size={18} />}
                  </div>
                  <h3 className={`text-xl font-bold font-display ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>{cert.label}</h3>
                </div>
                <ul className="space-y-3 mb-8">
                  {cert.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3">
                      {isCurrent ? <Zap size={16} className="text-primary shrink-0 mt-0.5" />
                       : isDone  ? <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" />
                                 : <Trophy size={16} className="text-muted-foreground/40 shrink-0 mt-0.5" />}
                      <span className={`text-sm leading-tight ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-border/40">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrent ? "text-primary" : isDone ? "text-secondary" : "text-muted-foreground"
                  }`}>{isCurrent ? "当前等级" : isDone ? "已完成" : `需 ${cert.id} 级解锁`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="grid grid-cols-12 gap-8 items-start">

        {/* Left 8-col */}
        <div className="col-span-12 lg:col-span-8 space-y-12">

          {/* Course Library */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold font-display text-primary">课程库</h2>
              <div className="flex gap-2">
                {(["all", "tech", "strategy", "compliance"] as CourseFilter[]).map(f => (
                  <button key={f} onClick={() => setCourseFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      courseFilter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}>
                    {f === "all" ? "全部" : CATEGORY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {coursesLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 size={24} className="animate-spin mr-2" /> 加载课程中…
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolledPct={enrollmentMap.has(course.id) ? enrollmentMap.get(course.id)! : null}
                    isEnrolling={enrollingId === course.id}
                    onEnroll={handleEnroll}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Technical Resources */}
          <section>
            <h2 className="text-2xl font-extrabold font-display mb-6 text-primary">学习资源</h2>
            <div className="space-y-3">
              {RESOURCES.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${r.color}`}><Icon size={20} /></div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{r.meta}</p>
                      </div>
                    </div>
                    {r.action}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 4-col */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-muted/40 rounded-2xl p-6 sticky top-28 space-y-8 border border-border/40">
            <h3 className="text-lg font-extrabold font-display text-primary">学习动态</h3>

            {/* Continue Learning */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">继续学习</p>
              {inProgress.length > 0 ? (
                <div className="space-y-4">
                  {inProgress.map((e, i) => (
                    <div key={e.id} className="flex gap-3 items-start">
                      <div className={`w-16 h-12 rounded-lg bg-gradient-to-br ${Object.values(COURSE_GRADS)[i % 4]} flex items-center justify-center shrink-0`}>
                        <BookOpen size={16} className="text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-tight text-foreground line-clamp-1">{(e as any).course?.title ?? `课程 #${e.courseId}`}</p>
                        <div className="w-full bg-border h-1.5 rounded-full mt-2">
                          <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: `${e.progressPct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{e.progressPct}% 已完成</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">暂无进行中的课程，快去报名吧！</div>
              )}
            </div>

            {/* Upcoming Assessments */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">即将到来的考核</p>
              <div className="space-y-3">
                {ASSESSMENTS.map((a, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-border/40 flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-center min-w-[44px] ${a.urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      <span className="block text-sm font-bold leading-none">{a.day}</span>
                      <span className="block text-[8px] uppercase tracking-wider mt-0.5">{a.month}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cert Status */}
            <div className="p-5 bg-primary text-white rounded-2xl text-center">
              <p className="text-xs font-medium mb-1 text-white/70">当前认证状态</p>
              <p className="text-lg font-bold font-display mb-1">
                {level === "A" ? "专家级架构师" : level === "B" ? "进阶级架构师" : "新手级 OPC"}
              </p>
              <p className="text-xs text-white/60 mb-4">Lv.{level} 认证 · {profile?.completionRate ?? 96}% 履约率</p>
              <button className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2">
                <Download size={14} /> 下载认证徽章
              </button>
            </div>

            {/* My enrollments count */}
            {enrollments.length > 0 && (
              <div className="text-center">
                <div className="text-3xl font-extrabold text-primary font-display">{enrollments.length}</div>
                <div className="text-xs text-muted-foreground mt-1">已报名课程</div>
                <div className="text-xs text-secondary font-bold mt-0.5">
                  {enrollments.filter(e => e.progressPct >= 100).length} 门已完成
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
