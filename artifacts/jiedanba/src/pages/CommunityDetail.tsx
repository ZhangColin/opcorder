import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, Building2, CalendarDays, ClipboardPenLine, Headphones,
  Megaphone, MessageCircleMore, Send, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OFFICIAL_OPERATOR_AVATAR = `${BASE}/community/official-operator.png`;

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
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

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
  return (
    <Layout>
      <div className="space-y-5 pb-14">
        <Link href="/community" className="group inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white transition-all group-hover:border-primary/30 group-hover:shadow-sm">
            <ArrowLeft size={15} />
          </span>
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
            <section className="relative min-h-[210px] overflow-hidden rounded-[28px] bg-[linear-gradient(115deg,#00327d_0%,#0755c7_58%,#0878dc_100%)] px-6 py-8 text-white shadow-[0_20px_55px_-28px_rgba(0,67,160,0.8)] md:px-11 md:py-10">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                  backgroundSize: "23px 23px",
                  maskImage: "linear-gradient(to left, black, transparent 72%)",
                }}
              />
              <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute -right-4 -top-10 h-44 w-44 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute bottom-0 right-10 hidden h-24 items-end gap-2 opacity-20 md:flex">
                {[42, 70, 54, 88, 64, 102, 78].map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="w-6 rounded-t-md border border-white/50 bg-white/20"
                    style={{ height }}
                  />
                ))}
              </div>

              <div className="relative flex min-h-[130px] items-center gap-5 md:gap-7">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white shadow-[0_14px_35px_rgba(0,20,80,0.35)] md:h-32 md:w-32">
                  {data?.logoUrl && !logoLoadFailed ? (
                    <img
                      src={data.logoUrl}
                      alt={data.name ?? "社区 Logo"}
                      className="h-full w-full object-cover"
                      onError={() => setLogoLoadFailed(true)}
                    />
                  ) : (
                    <Building2 size={38} className="text-primary/45" />
                  )}
                </div>
                <div className="min-w-0 max-w-2xl">
                  <h1 className="truncate text-3xl font-black tracking-tight drop-shadow-sm md:text-[42px] md:leading-tight">{data?.name}</h1>
                  {data?.description && (
                    <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-blue-50/90 md:text-base">
                      {data.description}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
              <section className="overflow-hidden rounded-[24px] border border-blue-100/70 bg-white shadow-[0_18px_55px_-38px_rgba(15,58,120,0.55)]">
                <div className="flex items-center gap-3 border-b border-slate-100 bg-[linear-gradient(90deg,#f1f7ff_0%,#ffffff_62%)] px-5 py-5 md:px-7">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
                    <Megaphone size={18} />
                  </span>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">社区公告</h2>
                    <p className="mt-0.5 text-xs text-slate-400">及时了解社区动态、活动与运营信息</p>
                  </div>
                  {!isError && (
                    <span className="ml-auto rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                      {data?.announcements.length ?? 0} 条
                    </span>
                  )}
                </div>
                <div className="px-5 md:px-7">
                  {data?.announcements.length ? (
                    <ul className="divide-y divide-slate-100/90">
                      {data.announcements.map((announcement, index) => (
                        <li key={announcement.id} className="group flex min-w-0 items-center gap-3 py-[18px]">
                          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:flex">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${categoryClass(announcement.categoryName)}`}>
                            {announcement.categoryName ?? "社区公告"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 transition-colors group-hover:text-primary" title={announcement.title}>
                            {announcement.title}
                          </span>
                          <time className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                            <CalendarDays size={13} />
                            {fmtDate(announcement.publishedAt)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden py-14 text-center">
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-50/80 blur-2xl" />
                      <div className="relative">
                        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-blue-100 bg-[linear-gradient(145deg,#ffffff,#e8f2ff)] shadow-[0_18px_35px_-22px_rgba(0,75,175,0.65)]">
                          <Megaphone size={38} className="text-primary/65" strokeWidth={1.7} />
                          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-white bg-[#4dffb2]" />
                        </div>
                        <h3 className="mt-6 text-base font-black text-slate-700">社区公告即将发布</h3>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                          管理员发布的活动通知、政策解读和社区动态将在这里统一呈现
                        </p>
                        <div className="mt-6 flex items-center justify-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/20" />
                          <span className="h-1.5 w-8 rounded-full bg-primary/45" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/20" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <aside className="overflow-hidden rounded-[24px] border border-blue-100/70 bg-white shadow-[0_18px_55px_-38px_rgba(15,58,120,0.55)] lg:sticky lg:top-24">
                <div className="flex items-center gap-3 border-b border-slate-100 bg-[linear-gradient(90deg,#f1f7ff_0%,#ffffff_100%)] px-5 py-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Headphones size={19} />
                  </span>
                  <div>
                    <h2 className="font-black text-slate-800">管理员官方运营入口</h2>
                    <p className="mt-0.5 text-xs text-slate-400">社区专属运营服务</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#f7fbff,#edf5ff)] p-5">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5" />
                    <div className="relative flex items-center gap-4">
                      <div className="relative">
                        <div className="h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-white bg-white shadow-lg shadow-blue-900/10">
                          <img src={OFFICIAL_OPERATOR_AVATAR} alt="官方运营头像" className="h-full w-full object-cover object-top" />
                        </div>
                        <span className="absolute bottom-1 right-0 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500" title="在线" />
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-800">官方运营</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">社区管理员 / 运营支持</p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                          <ShieldCheck size={11} />
                          官方认证
                        </span>
                      </div>
                    </div>
                    <p className="relative mt-5 border-t border-blue-100/70 pt-4 text-xs leading-6 text-slate-500">
                      为社区成员提供活动协同、资源对接、内容反馈与日常运营支持。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#0758c9,#00439e)] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-900/20 active:translate-y-0"
                  >
                    <MessageCircleMore size={17} />
                    联系官方运营
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-xs text-slate-400">
                    <CalendarDays size={14} className="text-primary/60" />
                    工作时间：9:00–18:00（工作日）
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="bg-[linear-gradient(115deg,#00327d,#0758c9)] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <img src={OFFICIAL_OPERATOR_AVATAR} alt="" className="h-12 w-12 rounded-full border-2 border-white/80 bg-white object-cover object-top" />
              <div>
                <p className="font-black">官方运营</p>
                <p className="mt-0.5 text-xs text-white/70">社区管理员 / 运营支持</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 px-6 pb-6">
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
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}