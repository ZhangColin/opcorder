import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Star, Trophy, FileText,
  Zap, Cpu, ShieldCheck, BookOpen, ArrowLeft,
  PlayCircle, Loader2, Award, CreditCard,
  BadgeCheck, AlertCircle, Clock, Users,
  GraduationCap, RotateCcw, RefreshCw,
} from "lucide-react";
import {
  useGetCurrentUser, useGetOpcProfile,
  useListCourses, useListMyEnrollments, useEnrollCourse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Course } from "@workspace/api-client-react";
import { QRCodeSVG } from "qrcode.react";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Types ────────────────────────────────────── */
interface EnrollmentInfo {
  progressPct: number;
  paymentStatus: string;
  certIssued: boolean;
}

interface PaymentModalData {
  courseId: number;
  qrCodeUrl: string;
  paymentOrderNo: string;
}

/* ─── Constants ────────────────────────────────── */
const COURSE_ICONS: Record<string, React.ElementType> = {
  tech: Cpu, strategy: BookOpen, compliance: ShieldCheck, operations: Zap,
};
const COURSE_GRADS: Record<string, string> = {
  tech: "from-blue-700 to-indigo-900",
  strategy: "from-emerald-700 to-teal-900",
  compliance: "from-violet-700 to-purple-900",
  operations: "from-orange-700 to-red-900",
};
const CATEGORY_LABELS: Record<string, string> = {
  tech: "技术", strategy: "策略", compliance: "合规", operations: "运营",
};
const LEVEL_LABELS: Record<string, string> = {
  C: "C 级·新手", B: "B 级·进阶", A: "A 级·专家",
};

function durationLabel(mins?: number | null) {
  if (!mins) return "自定进度";
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} 小时`;
}

/* ─── Inline Syllabus Viewer ───────────────────── */
function InlineSyllabusViewer({ url }: { url: string }) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  const officeExts = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"];

  if (imageExts.includes(ext)) {
    return (
      <img
        src={url}
        alt="课纲资料"
        className="w-full rounded-xl object-contain"
        style={{ maxHeight: 700 }}
      />
    );
  }

  const absolute = url.startsWith("http") ? url : new URL(url, window.location.href).href;

  if (officeExts.includes(ext)) {
    const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absolute)}&embedded=true`;
    return (
      <iframe
        src={gDocsUrl}
        title="课纲资料"
        className="w-full border-0 rounded-xl"
        style={{ height: 700 }}
        allow="fullscreen"
      />
    );
  }

  /* PDF — object tag: renders content without browser toolbar */
  return (
    <object
      data={`${absolute}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
      type="application/pdf"
      className="w-full rounded-xl"
      style={{ height: 700 }}
    >
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <FileText size={32} className="opacity-40" />
        <p className="text-sm">浏览器不支持内嵌 PDF 预览</p>
        <a href={url} target="_blank" rel="noreferrer"
          className="text-xs text-primary underline">点击下载查看</a>
      </div>
    </object>
  );
}

/* ─── Payment QR Modal ─────────────────────────── */
function PaymentModal({ data, onClose }: { data: PaymentModalData; onClose: () => void }) {
  const [status, setStatus] = useState<"pending" | "paid" | "failed">("pending");
  const qc = useQueryClient();

  useEffect(() => {
    const poll = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${BASE}/api/courses/${data.courseId}/payment-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ paymentOrderNo: data.paymentOrderNo }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === 2) {
          setStatus("paid");
          qc.invalidateQueries({ queryKey: ["my-enrollments"] });
          setTimeout(onClose, 1500);
        } else if (json.status === 3 || json.status === 5) {
          setStatus("failed");
        }
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [data.courseId, data.paymentOrderNo, onClose, qc]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5"
        onClick={e => e.stopPropagation()}>
        {status === "paid" ? (
          <>
            <CheckCircle2 size={48} className="text-secondary" />
            <p className="text-lg font-bold text-foreground">支付成功！</p>
            <p className="text-sm text-muted-foreground">课程已解锁，页面将自动刷新…</p>
          </>
        ) : status === "failed" ? (
          <>
            <AlertCircle size={48} className="text-destructive" />
            <p className="text-lg font-bold text-foreground">支付失败或已过期</p>
            <button onClick={onClose}
              className="px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90">关闭</button>
          </>
        ) : (
          <>
            <div className="p-3 bg-muted rounded-2xl">
              <QRCodeSVG value={data.qrCodeUrl} size={160} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-foreground">扫码完成支付</p>
              <p className="text-xs text-muted-foreground">支付完成后页面将自动更新 · 订单号 {data.paymentOrderNo}</p>
            </div>
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */
export default function AcademyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [paymentModal, setPaymentModal] = useState<PaymentModalData | null>(null);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: courses = [], isLoading } = useListCourses({});
  const { data: enrollments = [] } = useListMyEnrollments(
    { userId: user?.id ?? 1 },
    { query: { enabled: !!user?.id } }
  );
  const { mutateAsync: enrollCourse } = useEnrollCourse();

  const courseId = parseInt(id ?? "0", 10);
  const course = courses.find(c => c.id === courseId);

  const enrollmentMap = new Map(enrollments.map(e => [e.courseId, {
    progressPct: e.progressPct,
    paymentStatus: (e as typeof e & { paymentStatus?: string }).paymentStatus ?? "free",
    certIssued: (e as typeof e & { certIssued?: boolean }).certIssued ?? false,
  } as EnrollmentInfo]));

  const enrollment = enrollmentMap.get(courseId) ?? null;
  const isLoggedIn = !!user;
  const isEnrolled = enrollment !== null;
  const isPaid = enrollment?.paymentStatus === "paid" || enrollment?.paymentStatus === "free";
  const needsPay = enrollment?.paymentStatus === "pending";
  const isRefundPending = enrollment?.paymentStatus === "refund_pending";
  const isRefunded = enrollment?.paymentStatus === "refunded";
  const certIssued = enrollment?.certIssued ?? false;

  const handleEnroll = async (cId: number) => {
    if (!user?.id) return navigate("/login");
    setEnrollingId(cId);
    try {
      await enrollCourse({ userId: user.id, courseId: cId } as any);
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      toast({ title: "报名成功！" });
    } catch {
      toast({ title: "报名失败", variant: "destructive" });
    } finally {
      setEnrollingId(null);
    }
  };

  const handlePay = async (cId: number) => {
    if (!user?.id) return;
    setPayingId(cId);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/courses/${cId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPaymentModal({ courseId: cId, qrCodeUrl: json.qrCodeUrl, paymentOrderNo: json.paymentOrderNo });
    } catch {
      toast({ title: "发起支付失败，请稍后重试", variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  const handleRefund = async () => {
    if (!course || !user) return;
    setIsRefunding(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/courses/${course.id}/request-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason: "用户申请退款" }),
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      toast({ title: "退款申请已提交，等待审核" });
    } catch {
      toast({ title: "退款申请失败", variant: "destructive" });
    } finally {
      setIsRefunding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 size={28} className="animate-spin mr-3" /> 加载中…
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-lg font-semibold mb-4">课程未找到</p>
        <button onClick={() => navigate("/academy")}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl mx-auto">
          <ArrowLeft size={14} /> 返回培训进阶
        </button>
      </div>
    );
  }

  const Icon = COURSE_ICONS[course.category] ?? Cpu;
  const grad = COURSE_GRADS[course.category] ?? "from-blue-700 to-indigo-900";
  const catLabel = CATEGORY_LABELS[course.category] ?? "其他";
  const coursePrice = course.price ?? 0;
  const syllabusUrl = course.syllabusUrl;
  const reqLevel = course.requiredLevel;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Back */}
      <button
        onClick={() => navigate("/academy")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-semibold"
      >
        <ArrowLeft size={15} /> 培训进阶
      </button>

      {/* Banner */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${grad} h-52 flex items-end`}>
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <Icon size={120} className="absolute right-10 top-1/2 -translate-y-1/2 text-white/15" />
        {course.badge && (
          <span className="absolute top-5 right-5 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
            {course.badge}
          </span>
        )}
        {certIssued && (
          <span className="absolute top-5 left-5 bg-[#4dffb2] text-[#002112] text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1">
            <Award size={11} /> 已认证
          </span>
        )}
        <div className="relative z-10 p-8 w-full">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{catLabel}</span>
            {reqLevel && reqLevel !== "any" && (
              <span className="bg-white/15 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/30">
                需 {LEVEL_LABELS[reqLevel] ?? reqLevel}
              </span>
            )}
            {course.isRequired && (
              <span className="bg-red-500/30 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-red-300/30">必修</span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">{course.title}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Left: description + syllabus */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock size={14} /> {durationLabel(course.durationMinutes)}</span>
            {course.instructor && <span className="flex items-center gap-1.5"><GraduationCap size={14} /> {course.instructor}</span>}
            {course.learnersCount ? <span className="flex items-center gap-1.5"><Users size={14} /> {course.learnersCount.toLocaleString()} 学员</span> : null}
            {course.rating != null && (
              <span className="flex items-center gap-1.5 text-secondary font-bold">
                <Star size={14} className="fill-secondary" /> {course.rating}
              </span>
            )}
          </div>

          {/* Description */}
          {course.description && (
            <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
              {course.description}
            </div>
          )}

          {/* Syllabus — rendered inline as page content */}
          {syllabusUrl && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <FileText size={18} className="text-primary" /> 课纲资料
              </h2>
              <InlineSyllabusViewer url={syllabusUrl} />
            </div>
          )}
        </div>

        {/* Right: CTA sidebar */}
        <div className="space-y-4 sticky top-6">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
            {/* Price */}
            <div>
              {coursePrice > 0
                ? <p className="text-3xl font-extrabold text-primary">¥{coursePrice.toFixed(0)}</p>
                : <p className="text-xl font-bold text-secondary">免费</p>
              }
            </div>

            {/* Status badges */}
            {certIssued && (
              <div className="flex items-center gap-2 text-secondary text-sm font-bold">
                <BadgeCheck size={16} /> 已持证
              </div>
            )}
            {isRefundPending && (
              <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold bg-amber-50 rounded-xl px-3 py-2">
                <RefreshCw size={13} /> 退款审核中
              </div>
            )}
            {isRefunded && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold bg-muted rounded-xl px-3 py-2">
                <RotateCcw size={13} /> 已退款
              </div>
            )}
            {needsPay && (
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertCircle size={13} /> 已报名，待完成支付
              </div>
            )}

            {/* CTA */}
            {!isLoggedIn ? (
              <a href={`${BASE}/login`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all">
                登录后报名
              </a>
            ) : needsPay ? (
              <button
                onClick={() => handlePay(course.id)}
                disabled={payingId === course.id}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {payingId === course.id ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                立即支付
              </button>
            ) : isEnrolled && isPaid ? (
              <>
                <div className="flex items-center gap-2 text-secondary text-sm font-semibold">
                  <CheckCircle2 size={16} /> 已报名
                  {enrollment?.progressPct ? ` · ${enrollment.progressPct}% 完成` : ""}
                </div>
                <button
                  onClick={() => handleRefund()}
                  disabled={isRefunding}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-destructive border border-border rounded-xl transition-colors"
                >
                  {isRefunding ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  申请退款
                </button>
              </>
            ) : (
              <button
                onClick={() => handleEnroll(course.id)}
                disabled={enrollingId === course.id}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {enrollingId === course.id ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                {coursePrice > 0 ? "立即报名" : "免费报名"}
              </button>
            )}
          </div>
        </div>
      </div>

      {paymentModal && (
        <PaymentModal data={paymentModal} onClose={() => setPaymentModal(null)} />
      )}
    </div>
  );
}
