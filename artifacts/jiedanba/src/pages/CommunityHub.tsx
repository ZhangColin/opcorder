import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  Search, Megaphone, Building2, LayoutGrid, List as ListIcon,
  ChevronRight, Users,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PortalAnnouncement {
  id: number;
  title: string;
  publishedAt: string | null;
  categoryName: string | null;
}

interface PortalCommunity {
  id: number;
  name: string;
  description: string | null;
  logoUrl: string | null;
  announcements: PortalAnnouncement[];
}

interface PortalData {
  communities: PortalCommunity[];
  platformAnnouncements: PortalAnnouncement[];
}

/** 北京时间日期 yyyy-MM-dd(库内为 naive 北京时间存 UTC,用 UTC 取数) */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

const CATEGORY_COLORS = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
  "bg-amber-50 text-amber-600",
];
function categoryClass(name: string | null): string {
  if (!name) return "bg-slate-100 text-slate-500";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

/* 卡片内的最新公告行(标题超长省略,悬停可看全称) */
function AnnLines({ anns }: { anns: PortalAnnouncement[] }) {
  if (anns.length === 0) {
    return <p className="text-xs text-slate-400">暂无公告,敬请期待</p>;
  }
  return (
    <div className="space-y-2">
      {anns.map((a, i) => (
        <div key={a.id} className="flex items-center gap-2 text-xs min-w-0">
          {i === 0 ? (
            <span className="text-red-500 font-semibold shrink-0">最新</span>
          ) : (
            <span className="w-[24px] shrink-0" />
          )}
          <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${categoryClass(a.categoryName)}`}>
            {a.categoryName ?? "公告"}
          </span>
          <span className="text-slate-600 truncate" title={a.title}>{a.title}</span>
        </div>
      ))}
    </div>
  );
}

export default function CommunityHub() {
  const [, navigate] = useLocation();
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data, isLoading, isError, refetch } = useQuery<PortalData>({
    queryKey: ["community-portal"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/community-portal`);
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const communities = useMemo(() => {
    const list = data?.communities ?? [];
    const kw = applied.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(c => c.name.toLowerCase().includes(kw));
  }, [data, applied]);

  const platformAnns = data?.platformAnnouncements ?? [];

  return (
    <Layout>
      <div className="space-y-8 pb-12">
      {/* ── Hero:圆角渐变卡片(对齐培训进阶风格) ─────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#0047ab] p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
        {/* 点阵纹理 */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 space-y-4 w-full max-w-2xl">
          <span className="inline-block px-3 py-1 bg-[#4dffb2] text-[#002112] font-bold text-xs rounded-full uppercase tracking-wider">社区中心</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-display">社区</h1>
          <p className="text-white/80 text-lg leading-relaxed">
            连接平台、渠道社区与 OPC 交流，统一查看活动、政策与公告信息。
          </p>
          <form
            className="flex items-center bg-white rounded-2xl shadow-lg shadow-black/20 overflow-hidden"
            onSubmit={(e) => { e.preventDefault(); setApplied(keyword); }}
          >
            <Search size={18} className="ml-4 text-slate-400 shrink-0" />
            <input
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); if (!e.target.value.trim()) setApplied(""); }}
              placeholder="搜索社区名称"
              className="flex-1 min-w-0 px-3 py-3.5 text-sm text-slate-700 outline-none"
            />
            <button
              type="submit"
              className="m-1.5 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Search size={15} /> 搜索社区
            </button>
          </form>
        </div>
        {/* 右侧玻璃卡片(对齐培训进阶 Hero 右卡) */}
        <div className="relative z-10 hidden md:flex flex-col gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-full md:w-96 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Building2 size={18} className="text-white" /></div>
            <div>
              <p className="text-sm font-bold">渠道社区</p>
              <p className="text-xs text-white/60">汇聚各地社区,活动政策一站直达</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Megaphone size={18} className="text-white" /></div>
            <div>
              <p className="text-sm font-bold">官方公告</p>
              <p className="text-xs text-white/60">平台通知公告实时更新</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Users size={18} className="text-white" /></div>
            <div>
              <p className="text-sm font-bold">OPC 交流</p>
              <p className="text-xs text-white/60">与同行伙伴互通资源与经验</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 主体 ─────────────────────────────────────────── */}
      <section>
        {isError ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <p className="text-slate-500 text-sm">社区信息加载失败,请稍后重试</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* 社区中心 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-lg font-bold text-slate-800">社区中心</h2>
              {applied.trim() && (
                <span className="text-xs text-slate-400">搜索「{applied.trim()}」,共 {communities.length} 个</span>
              )}
              <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  type="button" title="卡片视图" onClick={() => setView("grid")}
                  className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button" title="列表视图" onClick={() => setView("list")}
                  className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <ListIcon size={15} />
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="border border-slate-100 rounded-2xl p-5 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-3 py-1">
                        <div className="w-1/2 h-4 bg-slate-100 rounded" />
                        <div className="w-full h-3 bg-slate-100 rounded" />
                        <div className="w-2/3 h-3 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : communities.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                {applied.trim() ? "没有找到匹配的社区" : "暂无社区"}
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {communities.map(c => (
                  <div key={c.id} className="group border border-slate-100 rounded-2xl p-5 hover:border-primary/20 hover:shadow-md transition flex flex-col">
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-slate-100 shrink-0 flex items-center justify-center">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 size={26} className="text-blue-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 truncate" title={c.name}>{c.name}</h3>
                        {c.description && (
                          <p className="mt-0.5 text-xs text-slate-400 truncate" title={c.description}>{c.description}</p>
                        )}
                        <div className="mt-2.5">
                          <AnnLines anns={c.announcements} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/community/${c.id}`)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors"
                      >
                        进入社区 <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {communities.map(c => (
                  <div key={c.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 min-w-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-slate-100 shrink-0 flex items-center justify-center">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={20} className="text-blue-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-800 text-sm truncate" title={c.name}>{c.name}</h3>
                      <div className="mt-1.5 hidden sm:block">
                        <AnnLines anns={c.announcements.slice(0, 1)} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/community/${c.id}`)}
                      className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors shrink-0"
                    >
                      进入社区 <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 平台官方通知公告 */}
          <aside className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone size={15} className="text-primary" />
              </span>
              <h2 className="text-base font-bold text-slate-800">平台官方通知公告</h2>
            </div>
            <div className="p-6 pt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : platformAnns.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">暂无平台公告</div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {platformAnns.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm min-w-0">
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span className="text-slate-600 truncate" title={a.title}>{a.title}</span>
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{fmtDate(a.publishedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
        )}
      </section>
      </div>
    </Layout>
  );
}
