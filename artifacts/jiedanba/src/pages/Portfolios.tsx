import { useState } from "react";
import { Link } from "wouter";
import { Plus, Pencil, Cpu, Bot, Globe, Lock, ArrowLeft, ExternalLink, Star, Trash2, Trophy } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListPortfolios } from "@workspace/api-client-react";
import { PortfolioDrawer, TYPE_LABEL } from "@/components/PortfolioDrawer";
import type { Portfolio } from "@workspace/api-client-react";

const PORTFOLIO_ICONS = [Cpu, Bot, Globe, Lock];
const PORTFOLIO_GRAD  = [
  "from-blue-700 to-indigo-900",
  "from-emerald-700 to-teal-900",
  "from-violet-700 to-purple-900",
  "from-slate-600 to-blue-900",
  "from-rose-700 to-pink-900",
  "from-amber-600 to-orange-800",
];

const TYPE_COLORS: Record<string, string> = {
  ai_education:     "bg-blue-100 text-blue-700",
  gov_training:     "bg-green-100 text-green-700",
  ai_research:      "bg-violet-100 text-violet-700",
  party_building:   "bg-red-100 text-red-700",
  livestream_media: "bg-pink-100 text-pink-700",
  ai_tool_dev:      "bg-amber-100 text-amber-700",
  other:            "bg-slate-100 text-slate-600",
};

const LEVEL_STATUS_BADGE: Record<string, { text: string; color: string }> = {
  pending:    { text: "认证审核中",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  approved:   { text: "认证已通过",   color: "bg-green-100 text-green-700 border-green-200" },
  downgraded: { text: "降级认证通过", color: "bg-blue-100 text-blue-700 border-blue-200" },
  rejected:   { text: "认证未通过",   color: "bg-red-100 text-red-700 border-red-200" },
};

export default function Portfolios() {
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [editingItem,    setEditingItem]    = useState<Portfolio | null>(null);
  const [filterType,     setFilterType]     = useState<string>("all");

  const { data: user }    = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: portfolios = [] } = useListPortfolios(
    { userId: user?.id ?? 1 },
    { query: { enabled: !!user?.id } }
  );

  const name = profile?.nickname ?? user?.nickname ?? "我";

  const types = Array.from(new Set(portfolios.map(p => p.type)));
  const filtered = filterType === "all"
    ? portfolios
    : portfolios.filter(p => p.type === filterType);

  const openAdd  = () => { setEditingItem(null); setDrawerOpen(true); };
  const openEdit = (p: Portfolio) => { setEditingItem(p); setDrawerOpen(true); };

  return (
    <>
      <PortfolioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userId={user?.id ?? 1}
        initial={editingItem}
        currentLevel={profile?.level}
      />

      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/profile"
              className="w-10 h-10 rounded-xl border border-border hover:bg-muted flex items-center justify-center text-slate-500 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-blue-900 font-display">{name} 的案例作品集</h1>
              <p className="text-slate-500 text-sm mt-0.5">{portfolios.length} 个项目案例</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-colors">
            <Plus size={16} /> 添加案例
          </button>
        </div>

        {/* Filter chips */}
        {types.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filterType === "all" ? "bg-primary text-white" : "bg-white border border-border text-slate-600 hover:border-primary/40"}`}>
              全部 ({portfolios.length})
            </button>
            {types.map(t => (
              <button key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filterType === t ? "bg-primary text-white" : "bg-white border border-border text-slate-600 hover:border-primary/40"}`}>
                {TYPE_LABEL[t] ?? t} ({portfolios.filter(p => p.type === t).length})
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((p, idx) => {
              const Icon = PORTFOLIO_ICONS[idx % PORTFOLIO_ICONS.length];
              const grad = PORTFOLIO_GRAD[idx % PORTFOLIO_GRAD.length];
              const typeColor = TYPE_COLORS[p.type] ?? "bg-slate-100 text-slate-600";
              return (
                <div key={p.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-border/40 flex flex-col">
                  {/* Cover */}
                  <div className={`h-48 bg-gradient-to-br ${grad} relative overflow-hidden flex items-center justify-center flex-shrink-0`}>
                    {p.coverImage ? (
                      <img src={p.coverImage} alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <>
                        <div className="absolute inset-0 opacity-20"
                          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                        <Icon size={48} className="text-white/60 group-hover:scale-110 transition-transform duration-500" />
                      </>
                    )}
                    {/* Edit overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-900 rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-transform">
                        <Pencil size={14} /> 编辑
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider w-fit ${typeColor}`}>
                        {TYPE_LABEL[p.type] ?? p.type}
                      </span>
                      {p.levelApplyStatus && LEVEL_STATUS_BADGE[p.levelApplyStatus] && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border w-fit ${LEVEL_STATUS_BADGE[p.levelApplyStatus].color}`}>
                          <Trophy size={10} />
                          {p.applyLevel} 级 · {LEVEL_STATUS_BADGE[p.levelApplyStatus].text}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-blue-900 mb-2 font-display leading-snug">{p.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed flex-1">{p.description}</p>

                    {/* Rating */}
                    {p.rating && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={13}
                            className={i <= Math.round(p.rating!) ? "fill-secondary text-secondary" : "text-slate-200"} />
                        ))}
                        <span className="text-xs font-bold text-slate-600 ml-1">{p.rating.toFixed(1)}</span>
                      </div>
                    )}

                    {/* Client feedback */}
                    {p.clientFeedback && (
                      <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border-l-2 border-secondary">
                        <p className="text-xs text-slate-500 italic line-clamp-2">"{p.clientFeedback}"</p>
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      {p.projectUrl ? (
                        <a href={p.projectUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary text-sm font-bold hover:underline">
                          查看项目 <ExternalLink size={13} />
                        </a>
                      ) : <span />}
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1 text-slate-400 hover:text-primary text-xs font-medium transition-colors">
                        <Pencil size={12} /> 编辑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Cpu size={28} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-2 font-display">
              {filterType === "all" ? "还没有案例作品" : `暂无「${TYPE_LABEL[filterType]}」类型案例`}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {filterType === "all"
                ? "添加您的第一个项目案例，展示专业能力给发单方"
                : "尝试其他类型筛选，或添加新案例"}
            </p>
            {filterType === "all" && (
              <button onClick={openAdd}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors">
                <Plus size={16} className="inline mr-2" />添加第一个案例
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
