import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  ShieldCheck, Search, Bell, User, ThumbsUp, MessageSquare,
  Eye, Share2, TrendingUp, Megaphone, CalendarDays, Trophy,
  ArrowRight, Filter, Plus, X, Send, Loader2,
  ChevronDown, LogOut, ArrowLeft,
} from "lucide-react";
import {
  useGetOpcLeaderboard, useGetCurrentUser,
  useListPosts, useCreatePost, useTogglePostLike,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Static sidebar data ────────────────────── */

const ANNOUNCEMENTS = [
  { date: "2026.03.20", text: "接单吧 V2.0 社区激励计划正式启动" },
  { date: "2026.03.15", text: "关于提升社区讨论质量的规范建议" },
  { date: "2026.03.10", text: "OPC 认证体系更新：L3 级别考核标准升级" },
];

const TRENDING = [
  { rank: "01", tag: "#混合算力分配算法", heat: "HOT", heatCls: "bg-red-100 text-red-700" },
  { rank: "02", tag: "#AgenticWorkflow",  heat: "1.2万讨论", heatCls: "text-slate-400" },
  { rank: "03", tag: "#Web3+AI融合之路",  heat: "8.5k讨论",  heatCls: "text-slate-400" },
  { rank: "04", tag: "#VibeCoding",       heat: "6.3k讨论",  heatCls: "text-slate-400" },
];

const LEADERBOARD_MOCK = [
  { score: "15,240", color: "bg-amber-400" },
  { score: "12,800", color: "bg-slate-400" },
  { score: "11,150", color: "bg-amber-700" },
];

const SUGGESTED_TAGS = ["#VibeCoding", "#AIPrompting", "#政企数字化", "#合规", "#接单经验", "#新手攻略"];

/* ─── User badge with dropdown ──────────────────── */

interface UserBadgeProps {
  nickname: string;
  role: string;
}

function UserBadge({ nickname, role }: UserBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("jdb_user_id");
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  const backLabel = role === "publisher" ? "返回发单方端" : "返回OPC端";
  const backHref  = role === "publisher" ? "/publisher" : "/";
  const initials  = nickname.slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-primary/8 hover:bg-primary/14 text-primary px-3 py-1.5 rounded-full transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <span className="text-sm font-bold max-w-[80px] truncate hidden sm:block">{nickname}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-bold text-blue-900 truncate">{nickname}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{role === "publisher" ? "发单方账号" : "OPC 账号"}</p>
          </div>
          <Link href={backHref}>
            <div
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-blue-900 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <ArrowLeft size={15} className="text-primary" />
              {backLabel}
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Login prompt modal ─────────────────────── */

function LoginPrompt({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShieldCheck size={28} className="text-primary" />
        </div>
        <h3 className="text-xl font-extrabold text-primary font-display mb-2">登录后才能参与讨论</h3>
        <p className="text-sm text-slate-500 mb-7 leading-relaxed">
          您目前以访客身份浏览。注册或登录后可以发帖、点赞、评论，并加入社区互动。
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={onLogin} className="w-full py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors">
            立即登录 / 注册
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
            继续浏览
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── New Post Modal ─────────────────────────── */

function NewPostModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState<string[]>([]);
  const qc = useQueryClient();

  const { mutateAsync: createPost, isPending } = useCreatePost();

  const addTag = (tag: string) => {
    const t = tag.startsWith("#") ? tag : `#${tag}`;
    if (t.length > 1 && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    await createPost({ data: { authorId: userId, title: title.trim(), content: content.trim(), tags } });
    await qc.invalidateQueries({ queryKey: ["/posts"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-primary font-display">发布新话题</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">话题标题</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="请输入话题标题（5-50字）"
              maxLength={50}
            />
            <div className="text-right text-xs text-slate-400 mt-1">{title.length}/50</div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">正文内容</label>
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              placeholder="分享你的经验、思考或问题…"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">话题标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {SUGGESTED_TAGS.map(t => (
                <button
                  key={t}
                  onClick={() => addTag(t)}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    tags.includes(t)
                      ? "bg-primary text-white border-primary"
                      : "border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="自定义标签 (按 Enter 添加)"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-secondary/10 text-secondary text-xs font-bold px-2 py-0.5 rounded-full">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-sm">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !content.trim()}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            发布
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────── */

type FeedTab = "latest" | "hot";

function levelLabel(level: string) {
  if (level === "A") return "A级 · 专家";
  if (level === "B") return "B级 · 进阶";
  return "C级 · 新手";
}

function levelCls(level: string) {
  if (level === "A") return "bg-amber-100 text-amber-700";
  if (level === "B") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-500";
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function Community() {
  const [, navigate]          = useLocation();
  const [feedTab, setFeedTab] = useState<FeedTab>("latest");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showNewPost, setShowNewPost]         = useState(false);
  const [likedIds, setLikedIds]               = useState<Set<number>>(new Set());

  const role    = localStorage.getItem("jdb_role");
  const isGuest = !role;

  const { data: user }        = useGetCurrentUser();
  const { data: leaderboard } = useGetOpcLeaderboard({ limit: 3 });

  const { data: postsData, isLoading: postsLoading } = useListPosts({ sort: feedTab });
  const posts = postsData?.items ?? [];

  const { mutateAsync: toggleLike } = useTogglePostLike();
  const qc = useQueryClient();

  const requireLogin = () => {
    if (isGuest) { setShowLoginPrompt(true); return true; }
    return false;
  };

  const handleLike = async (postId: number) => {
    if (requireLogin()) return;
    if (!user?.id) return;
    const { liked } = await toggleLike({ postId, data: { userId: user.id } });
    if (liked) setLikedIds(prev => new Set([...prev, postId]));
    else setLikedIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
    qc.invalidateQueries({ queryKey: ["/posts"] });
  };

  return (
    <div className="min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      {showLoginPrompt && <LoginPrompt onClose={() => setShowLoginPrompt(false)} onLogin={() => navigate("/login")} />}
      {showNewPost && user?.id && <NewPostModal userId={user.id} onClose={() => setShowNewPost(false)} />}

      {/* ── Top Nav ── */}
      <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center h-16 px-6 lg:px-12 max-w-screen-2xl mx-auto">
          <Link href={role === "publisher" ? "/publisher" : "/"}>
            <span className="text-xl font-extrabold tracking-tighter text-blue-900 font-display cursor-pointer">接单吧</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {["话题广场", "动态", "热榜", "活动"].map((label, i) => (
              <span key={label} className={`font-bold text-sm tracking-tight cursor-pointer transition-colors ${
                i === 0 ? "text-blue-700 border-b-2 border-blue-700 pb-1" : "text-slate-500 hover:text-blue-900"
              }`}>{label}</span>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <input className="bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 w-56 outline-none placeholder:text-slate-400" placeholder="搜索讨论…" type="text" />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button onClick={() => requireLogin()} className="p-2 text-blue-900 hover:bg-slate-50 rounded-full transition-colors"><Bell size={20} /></button>
            {!isGuest && user?.nickname ? (
              <UserBadge nickname={user.nickname} role={role ?? "opc"} />
            ) : isGuest ? (
              <Link href="/login">
                <div className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-full text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
                  登录 <ArrowRight size={14} />
                </div>
              </Link>
            ) : (
              <button className="p-2 text-blue-900 hover:bg-slate-50 rounded-full transition-colors"><User size={20} /></button>
            )}
          </div>
        </div>
        <div className="h-px bg-slate-100 w-full" />
      </header>

      {/* ── Hero ── */}
      <section className="relative bg-primary overflow-hidden pt-16">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#0047ab] to-[#005939]/60 opacity-90" />
          <div className="absolute -top-16 -right-16 w-80 h-80 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 py-16 lg:py-24 text-center">
          <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-4 font-display">话题广场</h1>
          <p className="text-lg text-blue-100/80 font-medium mb-10 max-w-2xl mx-auto">
            探索高价值行业讨论，连接顶级 OPC 精英，共建智能化协作新生态。
          </p>
          <div className="max-w-3xl mx-auto relative">
            <input
              className="w-full h-16 px-8 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/60 focus:ring-4 focus:ring-secondary/30 focus:bg-white/15 transition-all text-base outline-none"
              placeholder="搜索你感兴趣的话题或关键词…"
              type="text"
            />
            <button className="absolute right-2 top-2 bottom-2 px-7 bg-secondary text-white rounded-full font-bold flex items-center gap-2 hover:bg-secondary/90 transition-colors text-sm">
              <Search size={16} /> 搜索话题
            </button>
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Left: Feed */}
          <div className="lg:col-span-8 space-y-6">
            {/* Feed controls */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-3">
                {(["latest", "hot"] as FeedTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFeedTab(tab)}
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-colors ${
                      feedTab === tab ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {tab === "latest" ? "最新动态" : "热门推荐"}
                  </button>
                ))}
              </div>
              <div className="hidden sm:flex items-center text-slate-400 text-sm gap-1.5">
                <Filter size={14} /> {postsData?.total ?? 0} 篇话题
              </div>
            </div>

            {/* Guest notice */}
            {isGuest && (
              <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-primary shrink-0" />
                  <p className="text-sm text-primary font-medium">
                    您正在以访客身份浏览，<span className="font-bold">登录后</span>可发帖、点赞、参与讨论。
                  </p>
                </div>
                <Link href="/login">
                  <div className="shrink-0 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-primary/90 transition-colors whitespace-nowrap">立即登录</div>
                </Link>
              </div>
            )}

            {/* Post cards */}
            {postsLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : posts.map(post => {
              const isLiked = likedIds.has(post.id) || post.likedByMe;
              return (
                <article key={post.id} className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all group cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-slate-50 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                      {(post.authorName ?? "匿名").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-primary text-sm">{post.authorName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${levelCls(post.authorLevel ?? "C")}`}>
                          {levelLabel(post.authorLevel ?? "C")}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto shrink-0">
                          {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2">{post.content}</p>
                      <div className="flex flex-wrap gap-2 mb-5">
                        {(post.tags ?? []).map(tag => (
                          <span key={tag} className="text-secondary text-xs font-bold bg-secondary/8 px-3 py-1 rounded-full border border-secondary/15">{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-5 text-slate-400">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 transition-colors ${isLiked ? "text-primary" : "hover:text-primary"}`}
                        >
                          <ThumbsUp size={16} className={isLiked ? "fill-primary" : ""} />
                          <span className="text-xs font-medium">{formatCount(post.likesCount)}</span>
                        </button>
                        <button onClick={() => requireLogin()} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <MessageSquare size={16} />
                          <span className="text-xs font-medium">{formatCount(post.commentsCount)}</span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <Eye size={16} />
                          <span className="text-xs font-medium">{formatCount(post.viewsCount)}</span>
                        </button>
                        <button onClick={() => requireLogin()} className="ml-auto flex items-center gap-1.5 hover:text-primary transition-colors">
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* New post button */}
            <button
              onClick={() => { if (!requireLogin()) setShowNewPost(true); }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 发布新话题
            </button>
          </div>

          {/* Right Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <section className="bg-slate-50 rounded-2xl p-6 border border-primary/5">
              <h2 className="font-extrabold text-primary flex items-center gap-2 mb-5 text-sm">
                <Megaphone size={16} className="fill-primary" /> 官方公告
              </h2>
              <ul className="space-y-4">
                {ANNOUNCEMENTS.map(a => (
                  <li key={a.date} className="group cursor-pointer">
                    <div className="text-[10px] text-slate-400 mb-0.5">{a.date}</div>
                    <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">{a.text}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-5 text-sm">
                <TrendingUp size={16} className="text-secondary" /> 热门话题
              </h2>
              <div className="space-y-4">
                {TRENDING.map(t => (
                  <div key={t.rank} className="flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-slate-200 group-hover:text-primary transition-colors">{t.rank}</span>
                      <span className="font-bold text-sm group-hover:text-primary transition-colors">{t.tag}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.heatCls}`}>{t.heat}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-primary rounded-2xl p-6 text-white">
              <h2 className="font-extrabold mb-5 flex items-center gap-2 text-sm">
                <CalendarDays size={16} /> 近期活动
              </h2>
              <div className="bg-white/10 rounded-xl p-4 mb-5 backdrop-blur-md">
                <div className="text-[10px] text-blue-200 mb-1.5 font-bold uppercase">线上直播</div>
                <h4 className="font-bold text-sm mb-3 leading-snug">《OPC开发者沙龙：从Prompt工程到业务逻辑闭环》</h4>
                <div className="flex items-center justify-between text-xs text-blue-200">
                  <span>4月28日 20:00</span>
                  <span className="flex items-center gap-1"><User size={12} /> 256 已报名</span>
                </div>
              </div>
              <button
                onClick={() => requireLogin()}
                className="w-full py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary/90 transition-colors"
              >
                立即报名
              </button>
            </section>

            <section className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-5 text-sm">
                <Trophy size={16} className="text-amber-400 fill-amber-400" /> 本月贡献榜
              </h2>
              <div className="space-y-4">
                {(leaderboard ?? []).slice(0, 3).map((u, i) => {
                  const mock = LEADERBOARD_MOCK[i];
                  const initials = (u.nickname ?? "OC").slice(0, 2);
                  return (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">{initials}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 ${mock?.color ?? "bg-slate-400"} text-[9px] text-white font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white`}>{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{u.nickname}</div>
                        <div className="text-[10px] text-slate-400">贡献度: {mock?.score ?? "10,000+"}</div>
                      </div>
                      <button onClick={() => requireLogin()} className="text-xs text-primary font-bold hover:underline shrink-0">+ 关注</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <footer className="bg-slate-50 border-t border-slate-200/60 py-10 px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-screen-2xl mx-auto">
          <div className="font-display font-bold text-lg text-slate-900">接单吧社区</div>
          <nav className="flex flex-wrap justify-center gap-8">
            {["隐私政策", "服务条款", "社区准则", "联系支持"].map(link => (
              <a key={link} href="#" className="text-xs font-medium uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">{link}</a>
            ))}
          </nav>
          <div className="text-xs text-slate-400 uppercase tracking-widest">© 2026 接单吧 · OPC 专业平台</div>
        </div>
      </footer>
    </div>
  );
}
