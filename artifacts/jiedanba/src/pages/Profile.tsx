import { Star, ChevronRight, ShieldCheck, BadgeCheck, Cpu, Bot, Globe, Lock } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListPortfolios } from "@workspace/api-client-react";

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education: "AI 教育",
  gov_training: "政企培训",
  ai_research: "AI 研究",
  ai_tool_dev: "AI 工具开发",
  party_building: "党建数字化",
  livestream_media: "直播媒体",
  other: "综合",
};

const CERT_BY_LEVEL: Record<string, { label: string; detail: string; type: "done" | "current" | "locked" }[]> = {
  A: [
    { label: "A 级专家认证", detail: "2023 年 9 月解锁 · 高级 AI 系统架构", type: "current" },
    { label: "B 级进阶开发", detail: "2022 年 2 月解锁 · 云原生迁移专项", type: "done" },
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门", type: "locked" },
  ],
  B: [
    { label: "B 级进阶开发", detail: "2022 年 2 月解锁 · 云原生迁移专项", type: "current" },
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门", type: "done" },
  ],
  C: [
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门", type: "current" },
  ],
};

const PORTFOLIO_ICONS = [Cpu, Bot, Globe, Lock];
const PORTFOLIO_GRAD = [
  "from-blue-700 to-indigo-900",
  "from-emerald-700 to-teal-900",
  "from-violet-700 to-purple-900",
  "from-slate-600 to-blue-900",
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={16}
          className={i <= Math.round(rating) ? "fill-secondary text-secondary" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function CircleGauge({ value, max = 5 }: { value: number; max?: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = value / max;
  const offset = circ * (1 - pct);
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/50" />
        <circle
          cx="48" cy="48" r={r}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-secondary transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black text-foreground">{value}</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: portfolios } = useListPortfolios({ userId: user?.id ?? 1 }, { query: { enabled: !!user?.id } });

  const level = profile?.level ?? "A";
  const certs = CERT_BY_LEVEL[level] ?? CERT_BY_LEVEL["C"];
  const rating = Number(profile?.avgRating ?? 4.9);
  const credits = profile?.creditScore ?? 100;
  const skillTags = profile?.skillTags ?? ["AI 架构设计", "系统集成", "云原生", "大模型应用", "政企项目"];

  const reviewItems = portfolios?.filter(p => p.clientFeedback).slice(0, 2) ?? [];

  return (
    <div className="space-y-10">
      {/* ══════════════════ Profile Header ══════════════════ */}
      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border/40">
        {/* Cover */}
        <div className="h-44 bg-gradient-to-r from-primary to-[#0047ab] relative">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        {/* Info row */}
        <div className="px-8 pb-8 flex flex-col md:flex-row items-end gap-6 -mt-14 relative z-10">
          {/* Avatar */}
          <div className="w-36 h-36 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-primary/10 shrink-0 flex items-center justify-center">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl font-black text-primary">
                {user?.nickname?.[0] ?? "张"}
              </span>
            )}
          </div>

          {/* Name / badges / stats */}
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl font-extrabold text-primary font-display">
                {user?.nickname || profile?.nickname || "张明远"}
              </h1>
              <div className="flex flex-wrap gap-2">
                {level && (
                  <span className="inline-flex items-center gap-1 bg-secondary/15 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                    <BadgeCheck size={12} />
                    Lv.{level} {level === "A" ? "专家认证" : level === "B" ? "进阶认证" : "基础认证"}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 bg-[#4dffb2]/20 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                  <ShieldCheck size={12} />
                  平台认证伙伴
                </span>
              </div>
            </div>

            <p className="text-muted-foreground font-medium text-base mb-4">
              {profile?.bio || "专注于 AI 技术落地与政企数字化转型，精通大模型系统架构设计"}
            </p>

            <div className="flex gap-8 border-t border-border pt-4">
              <div>
                <span className="block text-2xl font-bold text-primary">{portfolios?.length ?? 0}+</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">完成项目</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-primary">{rating}/5.0</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">综合评分</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-primary">{credits}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">信用分</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-primary">98%</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">按时交付率</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pb-1 shrink-0">
            <button className="bg-gradient-to-br from-primary to-[#0047ab] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:brightness-110 transition-all flex items-center gap-2">
              联系报价
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ Two-col layout ══════════════════ */}
      <div className="grid grid-cols-12 gap-8 items-start">

        {/* ── Left sidebar 4-col ── */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Reputation gauge */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
              信誉分析
            </h3>
            <div className="flex items-center gap-6">
              <CircleGauge value={rating} />
              <div>
                <p className="font-bold text-lg text-primary">
                  {rating >= 4.8 ? "大师级信誉" : rating >= 4.5 ? "优秀口碑" : "良好信誉"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  平台前 2% 顶级 OPC，合规记录优秀，履约率高。
                </p>
              </div>
            </div>
          </div>

          {/* Core Skills */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              核心技能
            </h3>
            <div className="flex flex-wrap gap-2">
              {skillTags.map(tag => (
                <span
                  key={tag}
                  className="bg-muted px-3 py-1.5 rounded-lg text-sm font-medium text-primary border border-border/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              职业简介
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {profile?.bio ||
                "深耕 AI 技术与政企数字化领域多年，擅长从 0 到 1 落地 AI 系统架构方案。曾与海创元科技等头部企业深度合作，在微服务编排与企业知识管理方面积累了丰富的实战经验。"}
            </p>
          </div>

          {/* Certification Timeline */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
              认证历史
            </h3>
            <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
              {certs.map((cert, i) => (
                <div key={i} className={`relative pl-8 ${cert.type === "locked" ? "opacity-50" : ""}`}>
                  <div
                    className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${
                      cert.type === "current"
                        ? "bg-secondary"
                        : cert.type === "done"
                        ? "bg-primary"
                        : "bg-muted-foreground/50"
                    }`}
                  >
                    <Star size={10} className="text-white fill-white" />
                  </div>
                  <p className="text-sm font-bold text-foreground">{cert.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cert.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main content 8-col ── */}
        <div className="col-span-12 lg:col-span-8 space-y-10">

          {/* Portfolio Gallery */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-extrabold text-primary font-display">案例作品集</h2>
              <button className="text-secondary font-bold text-sm hover:underline flex items-center gap-1">
                查看全部项目 <ChevronRight size={16} />
              </button>
            </div>

            {portfolios && portfolios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {portfolios.map((p, idx) => {
                  const Icon = PORTFOLIO_ICONS[idx % PORTFOLIO_ICONS.length];
                  const grad = PORTFOLIO_GRAD[idx % PORTFOLIO_GRAD.length];
                  const typeLabel = DEMAND_TYPE_LABELS[p.type] ?? p.type;
                  return (
                    <div
                      key={p.id}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-border/40"
                    >
                      {/* Card image / placeholder */}
                      <div className={`h-48 bg-gradient-to-br ${grad} flex items-center justify-center relative overflow-hidden`}>
                        {p.coverImage ? (
                          <img
                            src={p.coverImage}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <>
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                            <Icon size={48} className="text-white/60 group-hover:scale-110 transition-transform duration-500" />
                          </>
                        )}
                      </div>
                      <div className="p-6">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-3 inline-block">
                          {typeLabel}
                        </span>
                        <h3 className="text-lg font-bold text-foreground mb-2 font-display">{p.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
                        <a
                          href={p.projectUrl ?? "#"}
                          className="inline-flex items-center text-primary font-bold text-sm gap-1 hover:gap-2 transition-all"
                        >
                          查看案例 <ChevronRight size={16} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-border p-16 text-center">
                <p className="text-muted-foreground font-medium">暂无作品，上传案例可大幅提升接单率</p>
              </div>
            )}
          </section>

          {/* Client Reviews */}
          {reviewItems.length > 0 && (
            <section>
              <h2 className="text-2xl font-extrabold text-primary mb-6 font-display">客户评价</h2>
              <div className="space-y-4">
                {reviewItems.map((p, i) => {
                  const borderColors = ["border-secondary", "border-primary"];
                  const initials = ["HT", "LZ"];
                  const bgColors = ["bg-primary/10 text-primary", "bg-secondary/15 text-secondary"];
                  const reviewers = ["海创元运营团队负责人", "政企培训客户代表"];
                  return (
                    <div
                      key={p.id}
                      className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${borderColors[i % borderColors.length]} border border-border/40`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${bgColors[i % bgColors.length]}`}>
                            {initials[i % initials.length]}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{reviewers[i % reviewers.length]}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">已验证合作</p>
                          </div>
                        </div>
                        <StarRating rating={p.rating ?? 5} />
                      </div>
                      <p className="text-muted-foreground italic leading-relaxed text-sm">
                        "{p.clientFeedback}"
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
