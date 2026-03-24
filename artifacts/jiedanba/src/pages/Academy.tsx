import { useState } from "react";
import {
  CheckCircle2,
  Star,
  Lock,
  Trophy,
  FileText,
  Video,
  Download,
  ChevronRight,
  Zap,
  Cpu,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile } from "@workspace/api-client-react";

/* ─── Static Data ─────────────────────────────── */

const CERTS = [
  {
    id: "C",
    label: "C 级 · 新手",
    subtitle: "已完成",
    icon: CheckCircle2,
    features: [
      "接受标准数据标注任务",
      "基础提示词优化模块",
      "平台社区支持",
    ],
    status: "done" as const,
  },
  {
    id: "B",
    label: "B 级 · 进阶",
    subtitle: "当前等级",
    icon: Star,
    features: [
      "优先获取限时高价值任务",
      "精准任务完成奖励 +5%",
      "AI 大模型微调工具 Beta 权限",
    ],
    status: "current" as const,
  },
  {
    id: "A",
    label: "A 级 · 专家",
    subtitle: "需再获得 150 积分解锁",
    icon: Trophy,
    features: [
      "定向邀请高价值政企项目",
      "专属 AI 培训工作坊",
      "核心开发团队一对一指导",
    ],
    status: "locked" as const,
  },
];

type CourseFilter = "all" | "tech" | "strategy";

const COURSES = [
  {
    id: 1,
    category: "tech",
    tag: "AI 技术",
    duration: "4 小时 20 分",
    title: "面向政企的提示词工程进阶",
    badge: "A 级必修",
    learners: "1.2k",
    rating: 4.9,
    grad: "from-blue-700 to-indigo-900",
    icon: Cpu,
    action: "开始学习",
  },
  {
    id: 2,
    category: "tech",
    tag: "技术研发",
    duration: "6 小时 45 分",
    title: "大模型微调策略与实战",
    badge: null,
    learners: "856",
    rating: null,
    grad: "from-violet-700 to-purple-900",
    icon: Zap,
    action: "继续学习",
  },
  {
    id: 3,
    category: "strategy",
    tag: "方法论",
    duration: "3 小时 15 分",
    title: "Vibe Coding 实战方法论",
    badge: "A 级必修",
    learners: null,
    rating: 4.9,
    grad: "from-emerald-700 to-teal-900",
    icon: BookOpen,
    action: "开始学习",
  },
  {
    id: 4,
    category: "strategy",
    tag: "安全合规",
    duration: "5 小时 10 分",
    title: "政企安全合规协议实操",
    badge: null,
    learners: "2.4k",
    rating: null,
    grad: "from-slate-600 to-blue-900",
    icon: ShieldCheck,
    action: "开始学习",
  },
];

const RESOURCES = [
  {
    icon: FileText,
    color: "text-red-500",
    name: "A 级认证考核指南（官方版）",
    meta: "PDF 文档 · 2.4 MB",
    action: <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />,
  },
  {
    icon: FileText,
    color: "text-blue-500",
    name: "大模型架构与权重全景概览",
    meta: "DOCX · 1.1 MB",
    action: <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />,
  },
  {
    icon: Video,
    color: "text-green-500",
    name: "工作坊录播：GPU 推理优化实战",
    meta: "MP4 视频 · 145 MB",
    action: <PlayCircle size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />,
  },
];

const IN_PROGRESS = [
  { title: "高级 RAG 架构设计", pct: 65, grad: "from-blue-600 to-indigo-700" },
  { title: "数据完整性验证方法", pct: 22, grad: "from-slate-500 to-blue-700" },
];

const ASSESSMENTS = [
  { day: "10", month: "APR", title: "A 级最终认证考核", detail: "10:00 · 远程监考", urgent: true },
  { day: "25", month: "APR", title: "提示词大师工坊", detail: "14:30 · Zoom 直播", urgent: false },
];

/* ─── Small sub-components ────────────────────── */

function CircleProgress({ pct, label, sublabel }: { pct: number; label: string; sublabel: string }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/20" />
        <circle
          cx="64" cy="64" r={r}
          fill="transparent" stroke="currentColor" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-[#4dffb2] transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold font-display">{label}</span>
        <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">{sublabel}</span>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */

export default function Academy() {
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");

  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });

  const level = profile?.level ?? "B";
  const credits = profile?.creditScore ?? 4.8;
  const nickname = user?.nickname || profile?.nickname || "架构师";

  // Map real level to cert card statuses
  const levelOrder = ["C", "B", "A"];
  const userIdx = levelOrder.indexOf(level);
  const certsWithStatus = CERTS.map((c, i) => ({
    ...c,
    status: i < userIdx ? "done" : i === userIdx ? "current" : "locked",
  })) as typeof CERTS;

  const heroProgress = level === "A" ? 100 : level === "B" ? 67 : 33;
  const heroLabel = level === "A" ? "Lv.A" : level === "B" ? "Lv.B" : "Lv.C";
  const nextLevel = level === "A" ? "顶级认证" : level === "B" ? "A 级专家" : "B 级进阶";
  const heroCredits = level === "A" ? "600 / 600" : level === "B" ? "450 / 600" : "150 / 300";

  const filteredCourses = courseFilter === "all" ? COURSES : COURSES.filter(c => c.category === courseFilter);

  return (
    <div className="space-y-12">

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#0047ab] p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Dot grid overlay */}
        <div
          className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />

        {/* Left text */}
        <div className="relative z-10 space-y-4 max-w-xl">
          <span className="inline-block px-3 py-1 bg-[#4dffb2] text-[#002112] font-bold text-xs rounded-full uppercase tracking-wider">
            学员档案
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-display">
            欢迎回来，{nickname}。
          </h1>
          <p className="text-white/80 text-lg max-w-md leading-relaxed">
            您的高价值政企项目匹配路径已完成{" "}
            <span className="text-[#4dffb2] font-bold">{heroProgress}%</span>。
            解锁下一等级，获得优先派单资格。
          </p>
        </div>

        {/* Right: progress circle card */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 flex flex-col items-center gap-4 w-full md:w-80 shrink-0">
          <CircleProgress pct={heroProgress} label={heroLabel} sublabel="当前等级" />
          <div className="text-center">
            <p className="text-sm font-medium text-white/80">
              下一阶段：<span className="text-white font-bold">{nextLevel}</span>
            </p>
            <p className="text-xs text-white/60 mt-1">{heroCredits} 积分已获得</p>
          </div>
          <button className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary/90 transition-all text-sm">
            查看升级要求
          </button>
        </div>
      </section>

      {/* ══════════════════ CERT ROADMAP ══════════════════ */}
      <section>
        <h2 className="text-2xl font-extrabold font-display mb-6 text-primary">OPC 专业认证路线图</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {certsWithStatus.map(cert => {
            const Icon = cert.icon;
            const isDone = cert.status === "done";
            const isCurrent = cert.status === "current";
            const isLocked = cert.status === "locked";
            return (
              <div
                key={cert.id}
                className={`relative p-8 rounded-2xl overflow-hidden transition-all ${
                  isCurrent
                    ? "bg-white border-2 border-primary ring-4 ring-primary/5 shadow-xl"
                    : isDone
                    ? "bg-muted/40 border border-border/40"
                    : "bg-muted/40 border border-border/40 opacity-70 grayscale hover:grayscale-0 hover:opacity-100"
                }`}
              >
                {/* Watermark icon */}
                <div className={`absolute top-4 right-4 ${isCurrent ? "text-primary/10" : "text-muted-foreground/10"}`}>
                  <Icon size={64} />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCurrent ? "bg-primary text-white" : isDone ? "bg-secondary text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isLocked ? <Lock size={18} /> : <Icon size={18} />}
                  </div>
                  <h3 className={`text-xl font-bold font-display ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                    {cert.label}
                  </h3>
                </div>

                {/* Feature list */}
                <ul className="space-y-3 mb-8">
                  {cert.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      {isCurrent ? (
                        <Zap size={16} className="text-primary shrink-0 mt-0.5" />
                      ) : isDone ? (
                        <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" />
                      ) : (
                        <Trophy size={16} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm leading-tight ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Footer */}
                <div className="pt-4 border-t border-border/40">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isCurrent ? "text-primary" : isDone ? "text-secondary" : "text-muted-foreground"
                    }`}
                  >
                    {isCurrent ? "当前等级" : isDone ? "已完成" : cert.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════ MAIN 12-col ══════════════════ */}
      <div className="grid grid-cols-12 gap-8 items-start">

        {/* ── Left 8-col ── */}
        <div className="col-span-12 lg:col-span-8 space-y-12">

          {/* Course Library */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold font-display text-primary">课程库</h2>
              <div className="flex gap-2">
                {(["all", "tech", "strategy"] as CourseFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setCourseFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      courseFilter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {f === "all" ? "全部" : f === "tech" ? "技术" : "战略"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCourses.map(course => {
                const Icon = course.icon;
                return (
                  <div
                    key={course.id}
                    className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-border/40"
                  >
                    {/* Thumbnail */}
                    <div className={`relative h-44 bg-gradient-to-br ${course.grad} flex items-center justify-center overflow-hidden`}>
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
                      />
                      <Icon size={52} className="text-white/50 group-hover:scale-110 transition-transform duration-500" />
                      {course.badge && (
                        <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
                          {course.badge}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-secondary/15 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          {course.tag}
                        </span>
                        <span className="text-muted-foreground text-xs font-medium">{course.duration}</span>
                      </div>
                      <h4 className="text-lg font-bold font-display mb-4 leading-tight text-foreground">
                        {course.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <div>
                          {course.rating ? (
                            <div className="flex items-center gap-1 text-xs text-secondary font-bold">
                              <Star size={12} className="fill-secondary" />
                              {course.rating} ({course.learners})
                            </div>
                          ) : course.learners ? (
                            <span className="text-xs text-muted-foreground">{course.learners} 学员</span>
                          ) : null}
                        </div>
                        <button className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                          {course.action === "继续学习" ? (
                            <><PlayCircle size={14} /> {course.action}</>
                          ) : (
                            <>{course.action} <ArrowRight size={14} /></>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Technical Resources */}
          <section>
            <h2 className="text-2xl font-extrabold font-display mb-6 text-primary">学习资源</h2>
            <div className="space-y-3">
              {RESOURCES.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${r.color}`}>
                        <Icon size={20} />
                      </div>
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

        {/* ── Right 4-col ── */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-muted/40 rounded-2xl p-6 sticky top-28 space-y-8 border border-border/40">
            <h3 className="text-lg font-extrabold font-display text-primary">学习动态</h3>

            {/* Continue Learning */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">继续学习</p>
              <div className="space-y-4">
                {IN_PROGRESS.map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-16 h-12 rounded-lg bg-gradient-to-br ${item.grad} flex items-center justify-center shrink-0`}>
                      <BookOpen size={16} className="text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-tight text-foreground line-clamp-1">{item.title}</p>
                      <div className="w-full bg-border h-1.5 rounded-full mt-2">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-700"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{item.pct}% 已完成</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Assessments */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">即将到来的考核</p>
              <div className="space-y-3">
                {ASSESSMENTS.map((a, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-border/40 flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg text-center min-w-[44px] ${
                        a.urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}
                    >
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

            {/* Certification Status */}
            <div className="p-5 bg-primary text-white rounded-2xl text-center">
              <p className="text-xs font-medium mb-1 text-white/70">当前认证状态</p>
              <p className="text-lg font-bold font-display mb-1">
                {level === "A" ? "专家级架构师" : level === "B" ? "进阶级架构师" : "新手级 OPC"}
              </p>
              <p className="text-xs text-white/60 mb-4">
                Lv.{level} 认证 · {profile?.completionRate ?? 96}% 履约率
              </p>
              <button className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2">
                <Download size={14} /> 下载认证徽章
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
