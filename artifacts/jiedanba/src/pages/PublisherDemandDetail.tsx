import { useLocation, Link } from "wouter";
import {
  Search, Bell, Settings,
  CheckCircle2, Clock, Lock, MapPin, Star, BadgeCheck,
  Calendar, Timer, ArrowRight, Download, FileText as FilePdf,
  ImageIcon, Zap,
} from "lucide-react";
import { useGetDemandById } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";

/* ─── Constants ───────────────────────────────── */

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education: "AI 教育",
  gov_training: "政企培训",
  ai_research: "AI 研究",
  ai_tool_dev: "AI 工具开发",
  party_building: "党建数字化",
  livestream_media: "直播媒体",
  other: "综合",
};

const MILESTONES = [
  { label: "阶段一：需求分析",  pct: "30% 付款", status: "done" as const },
  { label: "阶段二：核心开发",  pct: "50% 付款", status: "current" as const },
  { label: "阶段三：集成验收",  pct: "20% 付款", status: "locked" as const },
];

/* ─── Page ────────────────────────────────────── */

export default function PublisherDemandDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const demandId = parseInt(params.id ?? "1", 10);

  const { data: demand, isLoading } = useGetDemandById(demandId);

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  const typeLabel = demand?.type ? (DEMAND_TYPE_LABELS[demand.type] ?? demand.type) : "综合";
  const budgetMin = demand?.budgetMin?.toLocaleString() ?? "45,000";
  const budgetMax = demand?.budgetMax?.toLocaleString() ?? "82,000";

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} />

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索需求 ID、人才、结算记录…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Settings size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">海创元运营团队</p>
                <p className="text-[10px] text-slate-500 font-medium">项目经理</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                海
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="pt-24 pb-20 px-8 max-w-[1280px] mx-auto">

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Header ── */}
              <div className="mb-10">
                <div className="flex items-center gap-3 text-on-surface-variant mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest bg-slate-100 px-2 py-1 rounded text-slate-600">
                    {typeLabel}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-medium text-slate-500">
                    发布日期：{demand?.createdAt ? new Date(demand.createdAt).toLocaleDateString("zh-CN") : "2024年10月24日"}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-4 font-display leading-tight">
                  {demand?.title ?? "AI 驱动的供应链优化引擎开发"}
                </h1>

                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm font-bold">
                    <BadgeCheck size={14} className="mr-1" />
                    需求招募中
                  </div>
                  <div className="text-slate-500 flex items-center gap-1 text-sm">
                    <MapPin size={16} />
                    北京 · 远程协作
                  </div>
                </div>
              </div>

              {/* ── Milestone Roadmap ── */}
              <section className="mb-12 bg-slate-50 rounded-2xl p-8 border border-outline-variant/20">
                <h3 className="text-lg font-bold text-primary mb-8 flex items-center gap-2 font-display">
                  <Zap size={18} /> 项目执行路线图
                </h3>

                <div className="relative">
                  {/* Track */}
                  <div className="absolute top-5 left-0 w-full h-1 bg-slate-200 rounded-full" />
                  <div className="absolute top-5 left-0 w-1/3 h-1 bg-secondary rounded-full" />

                  <div className="relative flex justify-between">
                    {MILESTONES.map((m, i) => (
                      <div key={i} className="flex flex-col items-center text-center max-w-[180px]">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center z-10 mb-4 ring-4 ring-slate-50 ${
                            m.status === "done"
                              ? "bg-secondary text-white"
                              : m.status === "current"
                              ? "bg-primary/20 text-primary"
                              : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {m.status === "done" ? (
                            <CheckCircle2 size={20} />
                          ) : m.status === "current" ? (
                            <Clock size={20} />
                          ) : (
                            <Lock size={16} />
                          )}
                        </div>
                        <span className={`text-sm font-bold ${m.status === "locked" ? "text-slate-400" : "text-foreground"}`}>
                          {m.label}
                        </span>
                        <span className={`text-xs mt-1 font-semibold ${
                          m.status === "done" ? "text-secondary" : "text-slate-400"
                        }`}>
                          {m.pct}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── 3-col main split ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                {/* Left: Description */}
                <div className="lg:col-span-2 space-y-10">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-primary">
                    <h2 className="text-2xl font-bold text-foreground mb-6 font-display">详细需求描述</h2>
                    <div className="text-slate-600 leading-relaxed space-y-5">
                      <p>
                        {demand?.description ?? "海创元科技正在寻求一支资深全栈开发团队，搭建并实现一套 AI 驱动的政企数字化服务引擎。系统将实时处理来自超过 5,000 个政务节点的数据，以优化资源配置效率并缩短服务交付周期。"}
                      </p>

                      <div>
                        <h4 className="text-lg font-bold text-foreground mb-3">核心工作内容：</h4>
                        <ul className="list-disc pl-5 space-y-2 text-sm">
                          {[
                            "使用 Go 或 Java Spring Boot 设计可扩展的微服务架构",
                            "基于 Apache Kafka 和 Flink 实现实时数据接入管道",
                            "使用 TensorFlow 或 PyTorch 开发预测性路由优化算法",
                            "使用 React 与 D3.js 构建高性能可视化数据分析仪表盘",
                          ].map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-lg font-bold text-foreground mb-3">技术规范标准：</h4>
                        <p className="text-sm">
                          所有代码须遵循 SOE 级安全协议。候选方需具备高并发场景处理经验及静态/传输中数据加密实施能力。最终交付物须通过国家政务数字化合规审查。
                        </p>
                      </div>
                    </div>

                    {/* Reference Files */}
                    <div className="mt-10">
                      <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-5">参考文件下载</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { icon: FilePdf, iconCls: "text-red-500 bg-red-50", name: "技术规范说明书_V2.pdf", meta: "4.2 MB · 2 天前更新" },
                          { icon: ImageIcon, iconCls: "text-primary bg-primary/10", name: "系统架构设计图.jpg",   meta: "1.8 MB · 高分辨率" },
                        ].map(f => (
                          <div key={f.name} className="group flex items-center p-4 rounded-xl bg-slate-50 border border-outline-variant/30 hover:border-primary transition-all cursor-pointer">
                            <div className={`p-3 rounded-xl mr-4 ${f.iconCls}`}>
                              <f.icon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{f.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{f.meta}</p>
                            </div>
                            <Download size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Sidebar */}
                <div className="lg:col-span-1 space-y-6">

                  {/* Client Profile */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-outline-variant/20">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">关于发单方</h3>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-white font-extrabold text-xl shrink-0">
                        海
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground leading-tight">海创元科技</h4>
                        <div className="flex items-center text-amber-400 mt-1">
                          <Star size={14} className="fill-amber-400" />
                          <span className="text-sm font-bold text-slate-700 ml-1">4.9</span>
                          <span className="text-xs text-slate-400 ml-2 font-normal">(128 个订单)</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">加入时间</span>
                        <span className="font-semibold">2021年1月</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">认证状态</span>
                        <span className="text-secondary font-semibold flex items-center gap-1">
                          <BadgeCheck size={14} /> 国企认证
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sticky Apply Box */}
                  <div className="sticky top-24 bg-white p-6 rounded-2xl shadow-[0_12px_40px_-15px_rgba(0,50,125,0.12)] border border-primary/10">
                    <div className="mb-6">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">预算区间</p>
                      <p className="text-3xl font-extrabold text-primary">
                        ¥{budgetMin} - ¥{budgetMax}
                      </p>
                      <p className="text-xs text-secondary font-semibold mt-1 flex items-center gap-1">
                        <Zap size={12} /> 资金托管已激活
                      </p>
                    </div>

                    <div className="mb-8 space-y-3">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                        <Calendar size={18} className="text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">报名截止时间</p>
                          <p className="text-sm font-bold">2025年11月15日</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                        <Timer size={18} className="text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">预计工期</p>
                          <p className="text-sm font-bold">3 - 4 个月</p>
                        </div>
                      </div>
                    </div>

                    <button className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg" style={{ background: "linear-gradient(to right, #00327d, #0047ab)" }}>
                      确认发布此需求
                      <ArrowRight size={18} />
                    </button>
                    <p className="text-[10px] text-center text-slate-400 mt-4">
                      点击发布即表示您同意《数字架构师风险披露条款》
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-slate-50 border-t border-slate-200/60 py-10 px-8 ml-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-[1280px] mx-auto">
            <div className="col-span-1">
              <div className="font-display font-bold text-lg text-slate-900 mb-3">接单吧</div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
                © 2026 接单吧 · 海创元数字交易平台 · 国企监管实体
              </p>
            </div>
            {[
              { title: "平台", links: ["服务条款", "隐私政策", "风险披露"] },
              { title: "资源", links: ["API 文档", "关于数字架构师"] },
              { title: "联系", links: ["联系支持", "全球办事处"] },
            ].map(col => (
              <div key={col.title} className="col-span-1">
                <h4 className="text-[10px] font-bold text-primary mb-3 uppercase tracking-widest">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
