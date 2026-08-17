import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Search, Megaphone, Building2 } from "lucide-react";

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

export default function CommunityHub() {
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");

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
      {/* Hero:蓝色渐变 + 搜索 */}
      <section className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 -mt-20 sm:-mt-24 pt-32 sm:pt-36 pb-12">
        <div className="max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-wide">社区</h1>
          <p className="mt-3 text-blue-100 text-sm sm:text-base">
            连接平台、渠道社区与 OPC 交流,统一查看活动、政策与公告信息
          </p>
          <form
            className="mt-6 max-w-2xl flex items-center bg-white rounded-2xl shadow-lg overflow-hidden"
            onSubmit={(e) => { e.preventDefault(); setApplied(keyword); }}
          >
            <Search size={18} className="ml-4 text-slate-400 shrink-0" />
            <input
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); if (!e.target.value.trim()) setApplied(""); }}
              placeholder="搜索社区名称"
              className="flex-1 px-3 py-3.5 text-sm text-slate-700 outline-none"
            />
            <button
              type="submit"
              className="m-1.5 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Search size={15} /> 搜索社区
            </button>
          </form>
        </div>
      </section>

      {/* 主体:社区中心 + 平台公告 */}
      <section className="max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* 社区中心 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-lg font-bold text-slate-800">社区中心</h2>
              {applied.trim() && (
                <span className="text-xs text-slate-400">搜索「{applied.trim()}」,共 {communities.length} 个</span>
              )}
            </div>
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">加载中…</div>
            ) : communities.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                {applied.trim() ? "没有找到匹配的社区" : "暂无社区"}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {communities.map(c => (
                  <div key={c.id} className="border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-md transition">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-blue-50 border border-slate-100 shrink-0 flex items-center justify-center">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 size={26} className="text-blue-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
                        <div className="mt-2 space-y-1.5">
                          {c.announcements.length === 0 ? (
                            <p className="text-xs text-slate-400">暂无公告</p>
                          ) : c.announcements.map((a, i) => (
                            <div key={a.id} className="flex items-center gap-2 text-xs">
                              {i === 0 && <span className="text-red-500 font-semibold shrink-0">最新:</span>}
                              <span className={`px-1.5 py-0.5 rounded shrink-0 ${categoryClass(a.categoryName)}`}>
                                {a.categoryName ?? "公告"}
                              </span>
                              <span className="text-slate-600 truncate">{a.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 平台官方通知公告 */}
          <aside className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={18} className="text-primary" />
              <h2 className="text-base font-bold text-slate-800">平台官方通知公告</h2>
            </div>
            {isLoading ? (
              <div className="py-10 text-center text-slate-400 text-sm">加载中…</div>
            ) : platformAnns.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">暂无平台公告</div>
            ) : (
              <ul className="space-y-3">
                {platformAnns.map(a => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-600 leading-snug flex-1 min-w-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 mr-2 align-middle" />
                      {a.title}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 mt-0.5">{fmtDate(a.publishedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
        )}
      </section>
    </Layout>
  );
}
