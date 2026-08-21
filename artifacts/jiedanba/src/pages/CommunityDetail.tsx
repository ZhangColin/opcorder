import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, Building2, ClipboardPenLine, Megaphone, MessageCircleMore,
  Send, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CommunityAnnouncement {
  id: number;
  title: string;
  publishedAt: string | null;
  categoryName: string | null;
}

interface CommunityDetailData {
  id: number;
  name: string;
  description: string | null;
  logoUrl: string | null;
  announcements: CommunityAnnouncement[];
}

const CATEGORY_COLORS = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
  "bg-amber-50 text-amber-600",
];

function categoryClass(name: string | null): string {
  if (!name) return "bg-slate-100 text-slate-500";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

/** 北京时间日期 yyyy-MM-dd(库内为 naive 北京时间存 UTC,用 UTC 取数) */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export default function CommunityDetail() {
  const params = useParams<{ id: string }>();
  const communityId = Number(params.id);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [validatedLogoUrl, setValidatedLogoUrl] = useState<string | null>(null);

  const { data, error, isLoading, isError, refetch } = useQuery<CommunityDetailData>({
    queryKey: ["community-detail", communityId],
    enabled: Number.isInteger(communityId) && communityId > 0,
    queryFn: async () => {
      const response = await fetch(`${BASE}/api/community-portal/${communityId}`);
      if (response.status === 404) throw new Error("NOT_FOUND");
      if (!response.ok) throw new Error("加载失败");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const submitPlaceholder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.info("表单提交方式将在后续确定后接入");
    setFormOpen(false);
    setMessage("");
  };

  const isMissing = !Number.isInteger(communityId) || communityId <= 0 || error?.message === "NOT_FOUND";
  const showLogo = Boolean(data?.logoUrl && data.logoUrl === validatedLogoUrl);

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        <Link href="/community" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors">
          <ArrowLeft size={16} />
          返回社区中心
        </Link>

        {isLoading ? (
          <>
            <section className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              <section className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
              <aside className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          </>
        ) : isMissing ? (
          <section className="rounded-2xl border border-slate-100 bg-white py-20 text-center">
            <Building2 size={34} className="mx-auto text-slate-300" />
            <h1 className="mt-4 text-lg font-bold text-slate-700">社区未找到</h1>
            <p className="mt-2 text-sm text-slate-400">该社区可能已被删除，或链接无效。</p>
            <Link href="/community" className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
              返回社区中心
            </Link>
          </section>
        ) : isError ? (
          <section className="rounded-2xl border border-slate-100 bg-white py-20 text-center">
            <Megaphone size={34} className="mx-auto text-slate-300" />
            <h1 className="mt-4 text-lg font-bold text-slate-700">社区信息加载失败</h1>
            <p className="mt-2 text-sm text-slate-400">请检查网络后重新加载。</p>
            <button type="button" onClick={() => refetch()} className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
              重新加载
            </button>
          </section>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#0047ab] px-6 py-8 md:px-10 md:py-10 text-white">
              <div
                className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
              />
              <div className="relative flex items-center gap-5 min-w-0">
                {data?.logoUrl && (
                  <img
                    src={data.logoUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute w-px h-px opacity-0 pointer-events-none"
                    onError={() => setValidatedLogoUrl(null)}
                    onLoad={(event) => {
                      const ratio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight;
                      setValidatedLogoUrl(ratio <= 1.35 && ratio >= 0.74 ? data.logoUrl : null);
                    }}
                  />
                )}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-white/15 border-2 border-white/70 shadow-lg shrink-0 flex items-center justify-center">
                  {showLogo ? (
                    <img
                      src={data?.logoUrl ?? ""}
                      alt={data?.name ?? "社区 Logo"}
                      className="w-full h-full object-cover"
                      onError={() => setValidatedLogoUrl(null)}
                    />
                  ) : (
                    <Building2 size={34} className="text-white/80" />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight truncate">{data?.name}</h1>
                  {data?.description && <p className="mt-2 max-w-3xl text-sm md:text-base text-white/80 leading-relaxed">{data.description}</p>}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
              <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent">
                  <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Megaphone size={16} className="text-primary" />
                  </span>
                  <h2 className="font-bold text-slate-800">社区公告</h2>
                  {!isError && <span className="ml-auto text-xs text-slate-400">{data?.announcements.length ?? 0} 条</span>}
                </div>
                <div className="px-6">
                  {data?.announcements.length ? (
                    <ul className="divide-y divide-slate-100">
                      {data.announcements.map((announcement) => (
                        <li key={announcement.id} className="flex items-center gap-3 py-4 min-w-0">
                          <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${categoryClass(announcement.categoryName)}`}>
                            {announcement.categoryName ?? "公告"}
                          </span>
                          <span className="text-sm text-slate-700 font-medium truncate" title={announcement.title}>{announcement.title}</span>
                          <time className="ml-auto text-xs text-slate-400 shrink-0">{fmtDate(announcement.publishedAt)}</time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-16 text-center">
                      <Megaphone size={28} className="mx-auto text-slate-200" />
                      <p className="mt-3 text-sm text-slate-400">暂无社区公告</p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UserRound size={16} className="text-primary" />
                  </span>
                  <h2 className="font-bold text-slate-800">管理员官方运营入口</h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                      <UserRound size={23} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">官方运营</p>
                      <p className="mt-0.5 text-xs text-slate-400">社区管理员 / 运营入口</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="mt-6 w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
                  >
                    <MessageCircleMore size={17} />
                    联系官方运营
                  </button>
                  <p className="mt-3 text-center text-xs text-slate-400">运营入口将持续为社区提供支持</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <ClipboardPenLine size={19} className="text-primary" />
              联系官方运营
            </DialogTitle>
            <DialogDescription>请留下想咨询的内容，具体提交方式将在后续确定。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPlaceholder} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">所属社区</label>
              <input value={data?.name ?? ""} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 outline-none" />
            </div>
            <div>
              <label htmlFor="operation-message" className="block text-sm font-medium text-slate-700 mb-1.5">咨询内容</label>
              <textarea
                id="operation-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="请输入您希望官方运营协助的事项"
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90">
                <Send size={15} />
                提交咨询
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}