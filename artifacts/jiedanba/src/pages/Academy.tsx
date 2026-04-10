import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Star, Lock, Trophy, FileText,
  Download, Zap, Cpu, ShieldCheck,
  BookOpen, ArrowRight, PlayCircle, Loader2, Award,
  CreditCard, BadgeCheck, AlertCircle, X, Clock,
  Users, GraduationCap, CheckCircle,
} from "lucide-react";
import {
  useGetCurrentUser, useGetOpcProfile,
  useListCourses, useListMyEnrollments, useEnrollCourse,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Course } from "@workspace/api-client-react";
import { QRCodeSVG } from "qrcode.react";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

/* ─── Shared Types ───────────────────────────────── */

type EnrollmentInfo = {
  progressPct: number;
  paymentStatus: string;
  certIssued: boolean;
};

type PaymentModalData = {
  courseId: number;
  courseName: string;
  qrCodeUrl: string;
  paymentOrderNo: string;
  amount: number;
};

/* ─── Payment Modal ──────────────────────────────── */

function PaymentModal({
  data,
  onClose,
  onPaid,
}: {
  data: PaymentModalData;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [closing, setClosing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paid) return;

    const poll = async () => {
      // Immediate first poll for faster feedback (e.g. near-instant payments)
      // then repeats every 5s via interval
      const token = getAccessToken();
      try {
        const res = await fetch(`${BASE}/api/courses/${data.courseId}/payment-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const result = await res.json() as { paid: boolean; terminal: boolean };
        if (result.paid) {
          setPaid(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            setClosing(true);
            setTimeout(() => {
              onPaid();
              onClose();
            }, 500);
          }, 2000);
        } else if (result.terminal) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // silent
      }
    };

    poll(); // immediate first check for faster feedback
    intervalRef.current = setInterval(poll, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data.courseId, data.paymentOrderNo, paid]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity ${closing ? "opacity-0" : "opacity-100"}`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {paid ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-extrabold font-display text-foreground mb-2">支付成功！</h3>
            <p className="text-sm text-muted-foreground">课程已解锁，即将为您跳转…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight line-clamp-1">{data.courseName}</h3>
                <p className="text-2xl font-extrabold text-primary mt-0.5">¥{data.amount.toFixed(0)}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col items-center py-6 px-6 space-y-4">
              <div className="p-3 bg-white border-2 border-border rounded-xl">
                <QRCodeSVG value={data.qrCodeUrl} size={200} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">请使用微信或支付宝扫码支付</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  等待支付确认中…
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center">
                支付完成后页面将自动更新 · 订单号 {data.paymentOrderNo}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Course Detail Modal ────────────────────────── */

const LEVEL_LABELS: Record<string, string> = { C: "C 级·新手", B: "B 级·进阶", A: "A 级·专家" };

function CourseDetailModal({ course, enrollment, onClose, onEnroll, onPay, isEnrolling, isPaying }: {
  course: Course;
  enrollment: EnrollmentInfo | null;
  onClose: () => void;
  onEnroll: (id: number) => void;
  onPay: (id: number) => void;
  isEnrolling: boolean;
  isPaying: boolean;
}) {
  const Icon = COURSE_ICONS[course.category] ?? Cpu;
  const grad = COURSE_GRADS[course.category] ?? "from-blue-700 to-indigo-900";
  const catLabel = CATEGORY_LABELS[course.category] ?? "其他";
  const coursePrice = course.price ?? 0;
  const syllabusUrl = course.syllabusUrl;
  const instructor = course.instructor;
  const reqLevel = course.requiredLevel;
  const isEnrolled = enrollment !== null;
  const certIssued = enrollment?.certIssued ?? false;
  const needsPay = enrollment?.paymentStatus === "pending";
  const isPaid = enrollment?.paymentStatus === "paid" || enrollment?.paymentStatus === "free";

  const getFileLabel = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
      pdf: "PDF 文档", doc: "Word 文档", docx: "Word 文档",
      ppt: "PPT 演示", pptx: "PPT 演示", xls: "Excel 表格", xlsx: "Excel 表格",
    };
    return map[ext] ?? "课纲文件";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`relative h-48 bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden rounded-t-2xl`}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <Icon size={72} className="text-white/40" />
          {course.badge && (
            <div className="absolute top-4 right-14 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
              {course.badge}
            </div>
          )}
          {certIssued && (
            <div className="absolute top-4 left-4 bg-[#4dffb2] text-[#002112] text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1">
              <Award size={11} /> 已认证
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-7 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="bg-secondary/15 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{catLabel}</span>
              {reqLevel && reqLevel !== "any" && (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100">
                  需 {LEVEL_LABELS[reqLevel] ?? reqLevel}
                </span>
              )}
              {course.isRequired && (
                <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100">必修</span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold font-display text-foreground leading-tight">{course.title}</h2>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><Clock size={14} /> {durationLabel(course.durationMinutes)}</span>
            {instructor && <span className="flex items-center gap-1.5"><GraduationCap size={14} /> {instructor}</span>}
            {course.learnersCount ? <span className="flex items-center gap-1.5"><Users size={14} /> {course.learnersCount.toLocaleString()} 学员</span> : null}
            {course.rating != null && (
              <span className="flex items-center gap-1.5 text-secondary font-bold">
                <Star size={14} className="fill-secondary" /> {course.rating}
              </span>
            )}
          </div>

          {course.description && (
            <div className="bg-muted/40 rounded-xl p-4 text-sm text-foreground leading-relaxed">
              {course.description}
            </div>
          )}

          {syllabusUrl && (
            <div className="border border-border rounded-xl p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">课纲资料</p>
              <a
                href={syllabusUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 bg-primary/5 hover:bg-primary/10 border border-primary/15 rounded-xl transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{getFileLabel(syllabusUrl)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">点击下载课纲文件</p>
                </div>
                <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </a>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {coursePrice > 0 ? (
                <p className="text-2xl font-extrabold text-primary">¥{coursePrice.toFixed(0)}</p>
              ) : (
                <p className="text-lg font-bold text-secondary">免费</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {needsPay ? (
                <button
                  onClick={() => onPay(course.id)}
                  disabled={isPaying}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
                >
                  {isPaying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  立即支付
                </button>
              ) : isPaid && isEnrolled ? (
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-5 py-2.5 bg-muted text-foreground font-bold text-sm rounded-xl hover:bg-muted/70 transition-all"
                >
                  <X size={14} />
                  关闭
                </button>
              ) : (
                <button
                  onClick={() => onEnroll(course.id)}
                  disabled={isEnrolling}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isEnrolling ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {isEnrolling ? "处理中…" : "立即报名"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Course Card ────────────────────────────────── */

function CourseCard({
  course,
  enrollment,
  isEnrolling,
  isPaying,
  onEnroll,
  onPay,
  onViewDetail,
}: {
  course: Course;
  enrollment: EnrollmentInfo | null;
  isEnrolling: boolean;
  isPaying: boolean;
  onEnroll: (courseId: number) => void;
  onPay: (courseId: number) => void;
  onViewDetail: (course: Course) => void;
}) {
  const Icon = COURSE_ICONS[course.category] ?? Cpu;
  const grad = COURSE_GRADS[course.category] ?? "from-blue-700 to-indigo-900";
  const catLabel = CATEGORY_LABELS[course.category] ?? "其他";
  const isEnrolled = enrollment !== null;
  const enrolledPct = enrollment?.progressPct ?? null;
  const paymentStatus = enrollment?.paymentStatus;
  const certIssued = enrollment?.certIssued ?? false;
  const coursePrice = course.price ?? 0;
  const syllabusUrl = course.syllabusUrl;
  const instructor = course.instructor;
  const needsPay = paymentStatus === "pending";
  const isPaid = paymentStatus === "paid" || paymentStatus === "free";

  return (
    <div className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-border/40">
      <button
        className={`relative h-44 w-full bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden cursor-pointer`}
        onClick={() => onViewDetail(course)}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <Icon size={52} className="text-white/50 group-hover:scale-110 transition-transform duration-500" />
        {course.badge && (
          <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
            {course.badge}
          </div>
        )}
        {certIssued && (
          <div className="absolute top-4 left-4 bg-[#4dffb2] text-[#002112] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider flex items-center gap-1">
            <Award size={11} /> 已认证
          </div>
        )}
        {isEnrolled && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
            <div className="h-full bg-[#4dffb2] transition-all" style={{ width: `${enrolledPct}%` }} />
          </div>
        )}
      </button>

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-secondary/15 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{catLabel}</span>
          <span className="text-muted-foreground text-xs font-medium">{durationLabel(course.durationMinutes)}</span>
          {instructor && <span className="text-muted-foreground text-xs">· {instructor}</span>}
          {isEnrolled && <span className="ml-auto text-xs text-secondary font-bold">{enrolledPct}% 已完成</span>}
        </div>
        <button className="text-left w-full" onClick={() => onViewDetail(course)}>
          <h4 className="text-lg font-bold font-display mb-1 leading-tight text-foreground hover:text-primary transition-colors">{course.title}</h4>
        </button>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{course.description}</p>

        {needsPay && (
          <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <AlertCircle size={14} className="text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700 font-semibold">已报名，请完成支付以解锁课程</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {coursePrice > 0 ? (
              <span className="text-base font-extrabold text-primary">¥{coursePrice.toFixed(0)}</span>
            ) : (
              <span className="text-sm font-bold text-secondary">免费</span>
            )}
            {syllabusUrl && (
              <button
                onClick={() => onViewDetail(course)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                title="查看课程详情">
                <Download size={12} /> 课纲
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {certIssued && (
              <div className="flex items-center gap-1 text-secondary text-xs font-bold">
                <BadgeCheck size={14} /> 持证
              </div>
            )}
            {needsPay ? (
              <button
                onClick={() => onPay(course.id)}
                disabled={isPaying}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
              >
                {isPaying ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                立即支付
              </button>
            ) : isEnrolled && isPaid ? (
              <button
                onClick={() => onViewDetail(course)}
                className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
              >
                <PlayCircle size={14} /> 继续学习
              </button>
            ) : (
              <button
                onClick={() => onEnroll(course.id)}
                disabled={isEnrolling}
                className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all disabled:opacity-50"
              >
                {isEnrolling ? (
                  <><Loader2 size={14} className="animate-spin" /> 报名中</>
                ) : (
                  <>开始学习 <ArrowRight size={14} /></>
                )}
              </button>
            )}
          </div>
        </div>
        {course.rating != null && (
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-1 text-xs text-secondary font-bold">
            <Star size={11} className="fill-secondary" />
            {course.rating} {course.learnersCount ? `(${course.learnersCount.toLocaleString()} 学员)` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */

type CourseFilter = "all" | "tech" | "strategy" | "compliance" | "operations";

export default function Academy() {
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const [enrollingId, setEnrollingId]   = useState<number | null>(null);
  const [payingId, setPayingId]         = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalData | null>(null);
  const qc = useQueryClient();

  const { data: user }    = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });

  const { data: learningResources = [] } = useQuery<{
    id: number; title: string; fileUrl: string; fileType: string; fileSize: number | null; description: string | null;
  }[]>({
    queryKey: ["learning-resources"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/learning-resources`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const level    = profile?.level ?? "newbie";
  const nickname = user?.nickname || profile?.nickname || "OPC学员";

  const levelOrder  = ["newbie", "C", "B", "A"];
  const userIdx     = levelOrder.indexOf(level);
  const heroProgress = level === "A" ? 100 : level === "B" ? 75 : level === "C" ? 50 : 25;
  const heroLabel    = level === "newbie" ? "新手" : `Lv.${level}`;
  const nextLevel    = level === "A" ? "顶级认证" : level === "B" ? "A 级专家" : level === "C" ? "B 级进阶" : "C 级基础认证";
  const heroCredits  = level === "A" ? "600 / 600" : level === "B" ? "450 / 600" : level === "C" ? "150 / 300" : "0 / 100";

  const { data: courses = [], isLoading: coursesLoading } = useListCourses(
    courseFilter !== "all" ? { category: courseFilter } : {}
  );

  const { data: enrollments = [] } = useListMyEnrollments(
    { userId: user?.id ?? 1 },
    { query: { enabled: !!user?.id } }
  );

  const enrollmentMap = new Map(enrollments.map(e => [e.courseId, {
    progressPct: e.progressPct,
    paymentStatus: (e as typeof e & { paymentStatus?: string }).paymentStatus ?? "free",
    certIssued: (e as typeof e & { certIssued?: boolean }).certIssued ?? false,
  } as EnrollmentInfo]));

  const { mutateAsync: enrollCourse } = useEnrollCourse();
  const { toast } = useToast();

  /* Open payment QR modal */
  const initiatePayment = async (courseId: number) => {
    if (!user?.id) return;
    setPayingId(courseId);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/courses/${courseId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast({ title: "支付创建失败", description: err.error ?? "请稍后重试", variant: "destructive" });
        return;
      }
      const data = await res.json() as { qrCodeUrl: string; paymentOrderNo: string; amount: number; subject: string };
      const course = courses.find(c => c.id === courseId);
      setPaymentModal({
        courseId,
        courseName: course?.title ?? data.subject,
        qrCodeUrl: data.qrCodeUrl,
        paymentOrderNo: data.paymentOrderNo,
        amount: data.amount,
      });
    } catch {
      toast({ title: "网络错误", description: "无法连接支付服务，请检查网络", variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  const handleEnroll = async (courseId: number) => {
    if (!user?.id) {
      toast({ title: "请先登录", description: "登录后即可报名课程", variant: "destructive" });
      return;
    }
    setEnrollingId(courseId);
    try {
      const result = await enrollCourse({ courseId, data: { userId: user.id } });
      qc.invalidateQueries({ queryKey: ["/api/courses/my-enrollments"] });
      const ps = (result as typeof result & { paymentStatus?: string }).paymentStatus;
      if (ps === "pending") {
        setSelectedCourse(null);
        await initiatePayment(courseId);
      } else {
        toast({ title: "报名成功", description: "已加入课程，开始学习吧" });
        setSelectedCourse(null);
      }
    } finally {
      setEnrollingId(null);
    }
  };

  const handlePay = async (courseId: number) => {
    setSelectedCourse(null);
    await initiatePayment(courseId);
  };

  const handlePaymentPaid = () => {
    qc.invalidateQueries({ queryKey: ["/api/courses/my-enrollments"] });
    toast({ title: "支付成功！", description: "课程已解锁，开始学习吧" });
  };

  const inProgress = enrollments.filter(e => e.progressPct > 0 && e.progressPct < 100).slice(0, 2);

  return (
    <div className="space-y-12">

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          data={paymentModal}
          onClose={() => setPaymentModal(null)}
          onPaid={handlePaymentPaid}
        />
      )}

      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          enrollment={(enrollmentMap.get(selectedCourse.id) as EnrollmentInfo | undefined) ?? null}
          onClose={() => setSelectedCourse(null)}
          onEnroll={(id) => { handleEnroll(id); }}
          onPay={(id) => { handlePay(id); }}
          isEnrolling={enrollingId === selectedCourse.id}
          isPaying={payingId === selectedCourse.id}
        />
      )}

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
                    enrollment={(enrollmentMap.get(course.id) as EnrollmentInfo | undefined) ?? null}
                    isEnrolling={enrollingId === course.id}
                    isPaying={payingId === course.id}
                    onEnroll={handleEnroll}
                    onPay={handlePay}
                    onViewDetail={setSelectedCourse}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Technical Resources */}
          <section>
            <h2 className="text-2xl font-extrabold font-display mb-6 text-primary">学习资源</h2>
            {learningResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-white rounded-2xl border border-border/40">
                <BookOpen size={32} className="mb-3 opacity-30" />
                <p className="text-sm">暂无学习资源</p>
              </div>
            ) : (
              <div className="space-y-3">
                {learningResources.map(r => {
                  const isVideo = r.fileType === "mp4" || r.fileType === "video";
                  const isPdf = r.fileType === "pdf";
                  const Icon = isVideo ? PlayCircle : FileText;
                  const iconColor = isVideo ? "text-green-500" : isPdf ? "text-red-500" : "text-blue-500";
                  const typeLabel = isVideo ? "视频" : isPdf ? "PDF 文档" : r.fileType.toUpperCase();
                  const sizeLabel = r.fileSize
                    ? r.fileSize >= 1024 * 1024
                      ? ` · ${(r.fileSize / 1024 / 1024).toFixed(1)} MB`
                      : ` · ${(r.fileSize / 1024).toFixed(0)} KB`
                    : "";
                  return (
                    <a
                      key={r.id}
                      href={r.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${iconColor}`}><Icon size={20} /></div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.description}</p>}
                          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-0.5">{typeLabel}{sizeLabel}</p>
                        </div>
                      </div>
                      {isVideo
                        ? <PlayCircle size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        : <Download size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />}
                    </a>
                  );
                })}
              </div>
            )}
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
                {level === "A" ? "专家级架构师" : level === "B" ? "进阶级架构师" : level === "C" ? "基础认证 OPC" : "新手（待认证）"}
              </p>
              <p className="text-xs text-white/60 mb-4">{level === "newbie" ? "新手 · 待认证" : `Lv.${level} 认证`} · {profile?.completionRate ?? 96}% 履约率</p>
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
