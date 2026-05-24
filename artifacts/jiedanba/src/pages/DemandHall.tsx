import { useState, useEffect } from "react";
import { useListDemands } from "@workspace/api-client-react";
import { DemandCard, type OpcTrackCertMap } from "@/components/DemandCard";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { OPC_LEVELS } from "@/lib/constants";
import type { ListDemandsParams, ListDemandsStatus } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getAccessToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DemandHall() {
  const { role } = useCurrentUser();
  const [filters, setFilters] = useState<ListDemandsParams>({
    page: 1,
    limit: 12,
    status: 'published' as ListDemandsStatus,
    sortBy: 'newest'
  });

  const [searchInput, setSearchInput] = useState("");
  const [catCategories, setCatCategories] = useState<Array<{id: number; name: string}>>([]);
  const [opcCerts, setOpcCerts] = useState<OpcTrackCertMap>(new Map());

  useEffect(() => {
    fetch(`${API_BASE}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setCatCategories(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== "opc") return;
    const token = getAccessToken();
    fetch(`${API_BASE}/api/opc/track-certs`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ cat_category_id: number; level: string; status: string }>) => {
        const map: OpcTrackCertMap = new Map();
        rows.forEach(row => map.set(row.cat_category_id, { level: row.level, status: row.status }));
        setOpcCerts(map);
      })
      .catch(() => {});
  }, [role]);

  const { data, isLoading } = useListDemands(filters);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10 w-full md:w-1/2">
          <h1 className="text-3xl font-black font-display text-foreground mb-2">抢单大厅</h1>
          <p className="text-muted-foreground font-medium">海量优质数字建设需求，实时更新匹配。</p>
        </div>

        <form onSubmit={handleSearch} className="relative z-10 w-full md:w-1/2 max-w-md flex relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索需求名称、技能标签..."
            className="w-full bg-background border-2 border-border rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-xl hover:bg-primary/90 transition-colors">
            搜索
          </button>
        </form>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 sticky top-28 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-foreground mb-6 border-b border-border pb-4">
              <Filter size={18} className="text-primary" /> 筛选条件
            </div>

            <div className="space-y-6">
              {/* Type Filter */}
              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-widest">需求类型</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="type"
                      checked={!filters.catCategoryId}
                      onChange={() => setFilters(p => ({ ...p, catCategoryId: undefined, type: undefined, page: 1 }))}
                      className="w-4 h-4 text-primary focus:ring-primary border-border"
                    />
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">全部</span>
                  </label>
                  {catCategories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="type"
                        checked={filters.catCategoryId === cat.id}
                        onChange={() => setFilters(p => ({ ...p, catCategoryId: cat.id, type: undefined, page: 1 }))}
                        className="w-4 h-4 text-primary focus:ring-primary border-border"
                      />
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border"></div>

              {/* Level Filter */}
              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-widest">要求 OPC 等级</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(OPC_LEVELS).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setFilters(p => ({ ...p, opcLevel: (filters.opcLevel === key ? undefined : key) as any, page: 1 }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        filters.opcLevel === key
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* OPC: eligible-only quick filter */}
              {role === "opc" && opcCerts.size > 0 && (
                <>
                  <div className="h-px bg-border"></div>
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-widest">我的资质</h4>
                    {catCategories
                      .filter(cat => {
                        const cert = opcCerts.get(cat.id);
                        return cert && cert.status === "active";
                      })
                      .map(cat => (
                        <label key={cat.id} className="flex items-center gap-3 cursor-pointer group mb-2">
                          <input
                            type="radio"
                            name="type"
                            checked={filters.catCategoryId === cat.id}
                            onChange={() => setFilters(p => ({ ...p, catCategoryId: cat.id, type: undefined, page: 1 }))}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-border"
                          />
                          <span className="text-sm font-medium group-hover:text-emerald-600 transition-colors text-emerald-700">
                            ✓ {cat.name}
                          </span>
                        </label>
                      ))
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between bg-card px-6 py-4 rounded-2xl border border-border shadow-sm">
            <span className="text-sm font-bold text-muted-foreground">
              找到 <span className="text-foreground text-lg mx-1">{data?.total || 0}</span> 个匹配需求
            </span>

            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-muted-foreground" />
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(p => ({ ...p, sortBy: e.target.value as any }))}
                className="bg-transparent border-none text-sm font-bold text-foreground focus:ring-0 cursor-pointer"
              >
                <option value="newest">最新发布</option>
                <option value="budget_high">预算最高</option>
                <option value="deadline">即将截止</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-72 bg-card rounded-2xl border border-border animate-pulse"></div>
              ))}
            </div>
          ) : data?.items?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.items.map(demand => (
                <DemandCard
                  key={demand.id}
                  demand={demand}
                  opcCerts={role === "opc" ? opcCerts : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <Search className="text-muted-foreground" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">未找到匹配需求</h3>
              <p className="text-muted-foreground max-w-md">尝试调整搜索关键词或筛选条件，获取更多需求信息。</p>
              <button
                onClick={() => setFilters({ page: 1, limit: 12, status: 'published' })}
                className="mt-6 px-6 py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
