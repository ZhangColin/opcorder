import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Trophy, ChevronRight, AlertCircle, ArrowLeft } from "lucide-react";
import { apiGet } from "@/lib/v2api";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

type RegistrationStatus =
  | "registered"
  | "test_submitted"
  | "test_passed"
  | "test_failed"
  | "assignment_submitted"
  | "assignment_passed"
  | "assignment_failed";

type Grade = "A" | "B" | "C" | "fail" | null;

interface MyRegistration {
  id: number;
  contestId: number;
  trackId: number;
  status: RegistrationStatus;
  testGrade: Grade;
  assignmentGrade: Grade;
  testSubmittedAt: string | null;
  assignmentSubmittedAt: string | null;
  createdAt: string;
  contestTitle: string | null;
  catName: string | null;
  catColorHex: string | null;
}

const STATUS_LABEL: Record<RegistrationStatus, { label: string; cls: string }> = {
  registered:           { label: "已报名",     cls: "bg-blue-100 text-blue-700" },
  test_submitted:       { label: "测试题已提交", cls: "bg-amber-100 text-amber-700" },
  test_passed:          { label: "测试题通过",  cls: "bg-emerald-100 text-emerald-700" },
  test_failed:          { label: "测试题未通过", cls: "bg-red-100 text-red-600" },
  assignment_submitted: { label: "测试单已提交", cls: "bg-violet-100 text-violet-700" },
  assignment_passed:    { label: "测试单通过",  cls: "bg-emerald-100 text-emerald-700" },
  assignment_failed:    { label: "测试单未通过", cls: "bg-red-100 text-red-600" },
};

const GRADE_CLS: Record<string, string> = {
  A:    "bg-green-100 text-green-700 border-green-200",
  B:    "bg-blue-100 text-blue-700 border-blue-200",
  C:    "bg-amber-100 text-amber-700 border-amber-200",
  fail: "bg-red-100 text-red-600 border-red-200",
};

function GradeBadge({ grade }: { grade: Grade }) {
  if (!grade) return null;
  const cls = GRADE_CLS[grade] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-black border ${cls}`}>
      {grade === "fail" ? "不通过" : grade}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function OpcV2ContestList() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<{ items: MyRegistration[]; total: number }>({
    queryKey: ["opc-my-contests"],
    queryFn: () => apiGet("/api/contests/my?pageSize=50"),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pt-24 sm:pt-28 pb-10">

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} /> 个人中心
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Trophy size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-blue-900">我的大赛</h1>
            <p className="text-sm text-slate-400">查看大赛报名记录与测试进度</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">加载中…</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-slate-400">
            <AlertCircle size={36} className="opacity-30" />
            <p className="text-sm">加载失败，请刷新重试</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <Trophy size={48} className="text-slate-200" />
            <p className="text-slate-400 font-semibold">暂无报名记录</p>
            <p className="text-slate-400 text-sm">参加 OPC 大赛，提升赛道认证等级</p>
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              浏览大赛活动
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(reg => {
              const statusCfg = STATUS_LABEL[reg.status] ?? { label: reg.status, cls: "bg-slate-100 text-slate-500" };
              return (
                <button
                  key={reg.id}
                  onClick={() => navigate(`/profile/contests/${reg.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 hover:shadow-md hover:border-slate-200 transition-all flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-900 truncate mb-2">
                      {reg.contestTitle ?? "OPC 大赛"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {reg.catName && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: reg.catColorHex || "#6b7280" }}
                        >
                          {reg.catName}
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                      {reg.testGrade && <GradeBadge grade={reg.testGrade} />}
                      {reg.assignmentGrade && <GradeBadge grade={reg.assignmentGrade} />}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-slate-400">{fmtDate(reg.createdAt)}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
}
