import { useState } from "react";
import { Link } from "wouter";
import { TrendingUp, Award, ArrowRight, Activity, Zap, BarChart2, X, Star, CheckCircle2, Trophy } from "lucide-react";
import { useGetOverviewStats, useListDemands, useGetOpcLeaderboard, useGetCurrentUser, useGetOpcProfile } from "@workspace/api-client-react";
import { DemandCard } from "@/components/DemandCard";
import { OPC_LEVELS } from "@/lib/constants";

const RANK_STYLES = [
  { bg: "bg-amber-400",  text: "text-amber-950", border: "border-amber-300",  ring: "ring-amber-300"  },
  { bg: "bg-slate-300",  text: "text-slate-800",  border: "border-slate-200", ring: "ring-slate-200"  },
  { bg: "bg-orange-300", text: "text-orange-950", border: "border-orange-200",ring: "ring-orange-200" },
];

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const { data: top10, isLoading } = useGetOpcLeaderboard({ limit: 10 });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="primary-gradient px-8 py-7 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white font-display">活跃 OPC 完整榜单</h2>
              <p className="text-white/70 text-xs font-medium mt-0.5">按活跃积分排名 · 实时更新</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {(top10 ?? []).map((opc, idx) => {
                const rank = idx + 1;
                const style = RANK_STYLES[idx] ?? { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-100", ring: "ring-slate-100" };
                const levelInfo = OPC_LEVELS[opc.level] ?? { label: opc.level, color: "text-primary" };
                const isTop3 = idx < 3;

                return (
                  <div key={opc.id} className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${isTop3 ? "bg-gradient-to-r from-primary/5 to-transparent border-primary/15" : "bg-slate-50/60 border-slate-100 hover:border-primary/20 hover:bg-white"}`}>
                    {/* Rank */}
                    <div className={`shrink-0 w-9 h-9 rounded-xl ${isTop3 ? style.bg : "bg-slate-200"} ${isTop3 ? style.text : "text-slate-500"} flex items-center justify-center font-black text-sm`}>
                      {rank}
                    </div>

                    {/* Avatar */}
                    <div className={`relative shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 ${isTop3 ? style.border : "border-slate-200"} ${isTop3 ? `ring-2 ${style.ring}` : ""}`}>
                      {opc.avatar ? (
                        <img src={opc.avatar} alt={opc.nickname} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                          {(opc.nickname ?? "O")[0]}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm truncate">{opc.nickname}</span>
                        <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-primary/10 ${levelInfo.color}`}>
                          {levelInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                          <Star size={11} className="fill-amber-400" />
                          {(opc.avgRating ?? 5.0).toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <CheckCircle2 size={11} className="text-emerald-500" />
                          {opc.totalOrders ?? 0} 单
                        </span>
                      </div>
                    </div>

                    {/* Activity Score */}
                    <div className="shrink-0 text-right">
                      <div className={`text-lg font-black ${isTop3 ? "text-primary" : "text-slate-700"}`}>
                        {(opc.activityScore ?? 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">活跃积分</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-muted/30 text-center text-xs text-muted-foreground font-medium">
          积分根据接单量、好评率、完成率综合计算 · 每日更新
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { data: stats, isLoading: statsLoading } = useGetOverviewStats();
  const { data: currentUser } = useGetCurrentUser();
  const { data: opcProfile } = useGetOpcProfile(currentUser?.id ?? 0, {
    query: { enabled: !!currentUser?.id },
  });
  const eligibleLevel = opcProfile?.level as "C" | "B" | "A" | undefined;
  const { data: demandsResponse, isLoading: demandsLoading } = useListDemands({
    limit: 8,
    status: 'published',
    ...(eligibleLevel ? { eligibleLevel } : {}),
  });
  const { data: leaderboard, isLoading: leaderboardLoading } = useGetOpcLeaderboard({ limit: 3 });

  return (
    <div className="space-y-12">
      {/* Big KPIs Section */}
      <section className="primary-gradient rounded-3xl p-8 lg:p-10 text-white grid grid-cols-1 md:grid-cols-3 gap-8 shadow-2xl shadow-primary/20 relative overflow-hidden">
        {/* Decorative architectural background */}
        <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay">
          <img 
            className="w-full h-full object-cover" 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Architecture Background" 
          />
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 flex flex-col justify-center md:border-r border-white/20 md:pr-8">
          <div className="flex items-center gap-2 text-primary-foreground/70 text-sm font-bold uppercase tracking-widest mb-3">
            <Zap size={16} /> 累计结算金额
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl lg:text-5xl font-black tracking-tighter font-display">
              {statsLoading ? "..." : `¥${(stats?.totalPayout ?? 0).toLocaleString()}`}
            </span>
            <span className="text-accent flex items-center text-sm font-bold bg-accent/10 px-2 py-1 rounded-md">
              <TrendingUp size={14} className="mr-1" />+{statsLoading ? "0" : (stats?.payoutGrowth ?? 0).toFixed(1)}%
            </span>
          </div>
          <p className="text-white/60 text-sm mt-3 font-medium">企业级资金托管，安全合规的支付保障。</p>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center md:border-r border-white/20 md:pr-8 pl-0 md:pl-4">
          <div className="flex items-center gap-2 text-primary-foreground/70 text-sm font-bold uppercase tracking-widest mb-3">
            <Award size={16} /> 活跃 OPC
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl lg:text-5xl font-black tracking-tighter font-display">
              {statsLoading ? "..." : `${stats?.activeOpcs ?? 0}`}
            </span>
            <span className="bg-white/20 text-white text-[10px] px-2 py-1 rounded border border-white/30 uppercase tracking-tighter font-bold">
              已认证
            </span>
          </div>
          <p className="text-white/60 text-sm mt-3 font-medium">经过严格筛选的超级个体生态池。</p>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center pl-0 md:pl-4">
          <div className="flex items-center gap-2 text-primary-foreground/70 text-sm font-bold uppercase tracking-widest mb-3">
            <Activity size={16} /> 本月订单数
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl lg:text-5xl font-black tracking-tighter font-display">
              {statsLoading ? "..." : (stats?.monthlyOrders ?? 0)}
            </span>
            <span className="bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded font-bold">
              高频流转
            </span>
          </div>
          <p className="text-white/60 text-sm mt-3 font-medium">高效精准的数字化任务撮合与交付。</p>
        </div>
      </section>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-10">
        
        {/* Left Column: Recommended Demands */}
        <section className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex items-end justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-2xl font-black text-foreground font-display flex items-center gap-2">
                <BarChart2 className="text-primary" /> 推荐需求
              </h3>
              <p className="text-muted-foreground text-sm font-medium mt-1">基于您的能力模型智能推荐</p>
            </div>
            <Link href="/order-hall" className="text-primary font-bold text-sm flex items-center group hover:underline underline-offset-4">
              查看全部 <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          {demandsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 bg-card rounded-2xl border border-border animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {demandsResponse?.items?.map(demand => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
              {(!demandsResponse?.items || demandsResponse.items.length === 0) && (
                <div className="col-span-2 py-20 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground font-medium">暂无推荐需求</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Leaderboard */}
          <div className="bg-card rounded-3xl shadow-lg shadow-black/5 border border-border p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-foreground font-display">活跃 OPC 榜单</h3>
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <Award size={20} />
              </div>
            </div>
            
            <div className="space-y-6">
              {leaderboardLoading ? (
                 <div className="space-y-6">
                   {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl"></div>)}
                 </div>
              ) : (
                leaderboard?.map((opc, index) => (
                  <div key={opc.id} className="flex items-center gap-4 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full border-2 p-0.5 ${index === 0 ? 'border-amber-400' : index === 1 ? 'border-slate-300' : 'border-orange-300'}`}>
                        {/* developer portrait */}
                        <img 
                          className="w-full h-full rounded-full object-cover" 
                          src={opc.avatar || `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&q=${index}`} 
                          alt={opc.nickname} 
                        />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full font-black text-[11px] border-2 border-card ${index === 0 ? 'bg-amber-400 text-amber-950' : index === 1 ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-950'}`}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{opc.nickname}</h5>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-bold">{opc.level === "newbie" ? "新手" : `Lv.${opc.level}`}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border"></div>
                        <div className="flex items-center text-xs font-bold text-secondary">
                          ★ {(opc.avgRating || 5.0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button
              onClick={() => setShowLeaderboard(true)}
              className="w-full mt-8 py-3.5 bg-muted text-foreground font-bold text-sm rounded-xl hover:bg-border/60 active:scale-[0.98] transition-all"
            >
              查看完整榜单
            </button>
          </div>

          {/* Insights Block */}
          <div className="bg-secondary rounded-3xl p-8 text-white relative overflow-hidden group shadow-lg shadow-secondary/20">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700"></div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/20 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                <Activity size={24} className="text-accent" />
              </div>
              <h4 className="text-xl font-black font-display mb-3">AI市场需求洞察</h4>
              <p className="text-white/80 text-sm mb-6 leading-relaxed">
                本月企业级AI应用开发与大模型微调需求激增 34%，单均预算提升。
              </p>
              <button className="text-accent font-bold text-sm flex items-center hover:text-white transition-colors bg-black/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10 w-max">
                下载分析报告 <ArrowRight size={16} className="ml-2" />
              </button>
            </div>
          </div>

        </aside>
      </div>

      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
    </div>
  );
}
