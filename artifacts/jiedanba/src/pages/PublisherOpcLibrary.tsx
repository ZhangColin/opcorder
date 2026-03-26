import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Search, Bell, Settings, Users, Star, BadgeCheck,
  ChevronRight, X, ExternalLink, Zap, AlertCircle,
  Award, TrendingUp, Clock, Send, ChevronDown,
} from "lucide-react";
import {
  useGetOpcLeaderboard,
  useGetOpcProfile,
  useListPortfolios,
  useListDemands,
} from "@workspace/api-client-react";
import type { OpcProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";

const LEVEL_COLOR: Record<string, string> = {
  C: "bg-slate-100 text-slate-600 border-slate-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  A: "bg-amber-100 text-amber-700 border-amber-200",
};

const LEVEL_BADGE: Record<string, string> = {
  C: "C级·新手",
  B: "B级·进阶",
  A: "A级·专家",
};

const SKILL_TAGS_ALL = [
  "PPT设计", "视频剪辑", "AI应用开发", "Vibe Coding", "提示词工程",
  "教案设计", "文案撰写", "直播运营", "短视频制作", "数据处理",
  "Web开发", "小程序开发",
];

function StarRow({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={11}
          className={s <= Math.round(score) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
      ))}
      <span className="text-xs text-slate-500 ml-0.5">{score.toFixed(1)}</span>
    </div>
  );
}

function OpcDetailDrawer({
  opcId,
  publisherId,
  onClose,
}: {
  opcId: number;
  publisherId?: number;
  onClose: () => void;
}) {
  const { data: opc, isLoading: opcLoading } = useGetOpcProfile(opcId, {
    query: { enabled: opcId > 0 },
  });
  const { data: portfolios = [], isLoading: portLoading } = useListPortfolios(
    { userId: opcId },
    { query: { enabled: opcId > 0 } },
  );
  const { data: demandsData } = useListDemands(
    { status: "published", limit: 10, ...( publisherId ? { publisherId } : {} ) } as any,
    { query: { enabled: !!publisherId } },
  );
  const demands = demandsData?.items ?? [];
  const [selectedDemandId, setSelectedDemandId] = useState<number | "">("");
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!selectedDemandId || !publisherId) return;
    setInviting(true);
    try {
      const resp = await fetch(`/api/demands/${selectedDemandId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opcId, publisherId }),
      });
      if (!resp.ok) throw new Error("邀请失败");
      toast({ title: "邀约已发送", description: "OPC 将在通知中心收到您的邀约" });
      setSelectedDemandId("");
    } catch {
      toast({ title: "发送失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-primary text-lg">OPC 详情</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {opcLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : !opc ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <AlertCircle size={36} className="mb-2 text-slate-200" />
              <p>OPC 信息加载失败</p>
            </div>
          ) : (
            <>
              {/* OPC Profile Card */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center font-extrabold text-2xl text-primary shrink-0">
                    {opc.avatar ? (
                      <img src={opc.avatar} alt={opc.nickname} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      opc.nickname?.[0] ?? "O"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-extrabold text-foreground text-lg">{opc.nickname}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[opc.level] ?? LEVEL_COLOR.C}`}>
                        {LEVEL_BADGE[opc.level] ?? opc.level}
                      </span>
                    </div>
                    {opc.title && (
                      <p className="text-sm text-slate-500 font-medium">{opc.title}</p>
                    )}
                    {opc.creditScore !== undefined && (
                      <div className="mt-2">
                        <StarRow score={opc.creditScore} />
                      </div>
                    )}
                  </div>
                </div>
                {opc.bio && (
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">{opc.bio}</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                <div className="p-4 text-center">
                  <p className="text-2xl font-extrabold text-primary">{opc.totalOrders ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">接单总数</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-extrabold text-green-600">
                    {opc.completionRate != null ? `${Math.round(opc.completionRate * 100)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">完成率</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-extrabold text-amber-500">
                    {opc.avgRating != null ? opc.avgRating.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">平均评分</p>
                </div>
              </div>

              {/* Skill Tags */}
              {opc.skillTags && opc.skillTags.length > 0 && (
                <div className="p-6 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">技能标签</p>
                  <div className="flex flex-wrap gap-2">
                    {opc.skillTags.map((tag) => (
                      <span key={tag} className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Industry Tags */}
              {opc.industryTags && opc.industryTags.length > 0 && (
                <div className="px-6 pb-6 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">行业标签</p>
                  <div className="flex flex-wrap gap-2">
                    {opc.industryTags.map((tag) => (
                      <span key={tag} className="text-xs bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolios */}
              <div className="p-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">作品集</p>
                {portLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="w-5 h-5 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : (portfolios as any[]).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">暂无作品集</p>
                ) : (
                  <div className="space-y-3">
                    {(portfolios as any[]).map((p: any) => (
                      <div key={p.id} className="rounded-xl border border-slate-100 p-4 hover:border-primary/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground">{p.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{p.type}</p>
                            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{p.description}</p>
                          </div>
                          {p.rating && (
                            <div className="shrink-0 flex items-center gap-1">
                              <Star size={12} className="fill-amber-400 text-amber-400" />
                              <span className="text-xs font-bold text-slate-600">{p.rating}</span>
                            </div>
                          )}
                        </div>
                        {p.clientFeedback && (
                          <p className="text-xs text-emerald-700 mt-2 italic">"{p.clientFeedback}"</p>
                        )}
                        {p.projectUrl && (
                          <a
                            href={p.projectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                          >
                            <ExternalLink size={10} /> 查看项目
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Invite Footer */}
        {publisherId && demands.length > 0 && (
          <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">定向邀约</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedDemandId}
                  onChange={e => setSelectedDemandId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-8"
                >
                  <option value="">选择需求…</option>
                  {demands.map(d => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={handleInvite}
                disabled={!selectedDemandId || inviting}
                className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
              >
                {inviting ? "发送中…" : <><Send size={14} /> 邀约</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublisherOpcLibrary() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSkill, setFilterSkill] = useState<string>("");
  const [selectedOpcId, setSelectedOpcId] = useState<number | null>(null);

  const { userId: publisherId, nickname, avatarChar, roleLabel } = useCurrentUser();
  const { data: opcs = [], isLoading } = useGetOpcLeaderboard({ limit: 100 });

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  const filtered = (opcs as OpcProfile[]).filter((opc) => {
    const matchSearch =
      !search ||
      opc.nickname.toLowerCase().includes(search.toLowerCase()) ||
      (opc.bio ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (opc.skillTags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchLevel = filterLevel === "all" || opc.level === filterLevel;
    const matchSkill =
      !filterSkill ||
      (opc.skillTags ?? []).includes(filterSkill);
    return matchSearch && matchLevel && matchSkill;
  });

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} />

      {selectedOpcId !== null && (
        <OpcDetailDrawer opcId={selectedOpcId} publisherId={publisherId || undefined} onClose={() => setSelectedOpcId(null)} />
      )}

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="搜索 OPC 昵称、技能…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">{nickname || "发单方"}</p>
                <p className="text-[10px] text-slate-500 font-medium">{roleLabel}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                {avatarChar}
              </div>
            </div>
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[1280px] mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-primary font-display flex items-center gap-3">
              <Users size={26} /> OPC 人才库
            </h1>
            <p className="text-slate-500 text-sm mt-1">浏览平台 OPC 生态池，查看作品集与评分，支持定向邀约</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Level Filter */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { key: "all", label: "全部等级" },
                { key: "C",   label: "C级·新手" },
                { key: "B",   label: "B级·进阶" },
                { key: "A",   label: "A级·专家" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilterLevel(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterLevel === opt.key
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Skill Tag Filter */}
            <div className="flex-1 min-w-[200px]">
              <select
                value={filterSkill}
                onChange={(e) => setFilterSkill(e.target.value)}
                className="w-full max-w-xs text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none text-slate-700"
              >
                <option value="">所有技能标签</option>
                {SKILL_TAGS_ALL.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Active Filter Chips */}
            <div className="flex items-center gap-2">
              {filterSkill && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  {filterSkill}
                  <button onClick={() => setFilterSkill("")} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              )}
              {search && (
                <span className="flex items-center gap-1 bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  搜索：{search}
                  <button onClick={() => setSearch("")} className="hover:text-slate-900">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>

            <span className="text-xs text-slate-400 ml-auto">共 {filtered.length} 位 OPC</span>
          </div>

          {/* OPC Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 h-64 text-slate-400">
              <AlertCircle size={44} className="mb-4 text-slate-200" />
              <p className="font-medium">没有符合筛选条件的 OPC</p>
              <button
                onClick={() => { setSearch(""); setFilterLevel("all"); setFilterSkill(""); }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((opc) => (
                <div
                  key={opc.id}
                  onClick={() => setSelectedOpcId(opc.userId)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group p-6"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center font-extrabold text-lg text-primary shrink-0">
                      {opc.avatar ? (
                        <img src={opc.avatar} alt={opc.nickname} className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        opc.nickname?.[0] ?? "O"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {opc.nickname}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${LEVEL_COLOR[opc.level] ?? LEVEL_COLOR.C}`}>
                          {opc.level}级
                        </span>
                      </div>
                      {opc.title && (
                        <p className="text-xs text-slate-500">{opc.title}</p>
                      )}
                      {opc.creditScore !== undefined && (
                        <div className="mt-1">
                          <StarRow score={opc.creditScore} />
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>

                  {/* Bio */}
                  {opc.bio && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">{opc.bio}</p>
                  )}

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} className="text-primary" />
                      {opc.totalOrders ?? 0} 单
                    </span>
                    {opc.completionRate != null && (
                      <span className="flex items-center gap-1">
                        <Award size={12} className="text-green-500" />
                        {Math.round(opc.completionRate * 100)}% 完成率
                      </span>
                    )}
                    {opc.avgRating != null && (
                      <span className="flex items-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        {opc.avgRating.toFixed(1)} 评分
                      </span>
                    )}
                  </div>

                  {/* Skill Tags */}
                  {opc.skillTags && opc.skillTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {opc.skillTags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                      {opc.skillTags.length > 4 && (
                        <span className="text-[11px] text-slate-400 px-2 py-0.5">
                          +{opc.skillTags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
