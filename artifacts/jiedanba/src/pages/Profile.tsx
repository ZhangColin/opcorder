import { User as UserIcon, Star, Award, Briefcase } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListPortfolios } from "@workspace/api-client-react";

export default function Profile() {
  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id || 1, { query: { enabled: !!user?.id } });
  const { data: portfolios } = useListPortfolios({ userId: user?.id || 1 }, { query: { enabled: !!user?.id } });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Profile Header Card */}
      <div className="bg-card rounded-3xl p-8 md:p-12 border border-border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden shrink-0 bg-primary/10">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-primary font-black">
                {user?.nickname?.[0] || <UserIcon size={48} />}
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
              <h1 className="text-3xl font-black font-display text-foreground">{user?.nickname || profile?.nickname}</h1>
              {profile?.level && (
                <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-xs rounded-full shadow-md mx-auto md:mx-0 w-max">
                  Lv.{profile.level} 认证专家
                </span>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm font-medium mb-6 max-w-2xl leading-relaxed">
              {profile?.bio || "暂无简介，完善您的个人资料可以大幅提升接单率。"}
            </p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
              {profile?.skillTags?.map(tag => (
                <span key={tag} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-md text-xs font-bold">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div className="shrink-0 flex gap-4 md:flex-col justify-center w-full md:w-auto">
            <div className="bg-background p-4 rounded-2xl border border-border min-w-[120px] text-center">
              <span className="block text-xs text-muted-foreground font-bold uppercase mb-1">信用分</span>
              <span className="text-2xl font-black text-secondary">{profile?.creditScore || 100}</span>
            </div>
            <div className="bg-background p-4 rounded-2xl border border-border min-w-[120px] text-center">
              <span className="block text-xs text-muted-foreground font-bold uppercase mb-1">综合评分</span>
              <span className="text-2xl font-black text-amber-500 flex items-center justify-center gap-1">
                {profile?.avgRating || "5.0"} <Star size={16} className="fill-amber-500" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolios Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black font-display text-foreground flex items-center gap-2">
            <Briefcase className="text-primary" /> 我的作品集
          </h3>
          <button className="bg-primary text-white font-bold px-6 py-2.5 rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm">
            上传作品
          </button>
        </div>
        
        {portfolios?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map(p => (
              <div key={p.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                <div className="h-48 bg-muted relative">
                  {p.coverImage ? (
                    <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 font-bold text-lg">暂无封面</div>
                  )}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded">
                    {p.type}
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-lg mb-2 text-foreground truncate">{p.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border p-16 text-center flex flex-col items-center">
            <Briefcase size={40} className="text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium mb-4">您还没有上传任何作品，优秀的作品集能带来更多邀约。</p>
          </div>
        )}
      </div>
    </div>
  );
}
