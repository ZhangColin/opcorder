import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Link, useParams } from "wouter";
import {
  AlertCircle, ArrowLeft, Building2, CalendarDays, FileText, Megaphone, RefreshCw, Tag,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AnnouncementDetailData {
  id: number;
  title: string;
  content: string;
  coverUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  categoryName: string | null;
  communityId: number | null;
  communityName: string | null;
  communityLogoUrl: string | null;
  source: "platform" | "community";
}

/** 库内以 UTC 数值保存北京时间，展示时固定用 UTC 取数。 */
function formatDateTime(iso: string | null): string {
  if (!iso) return "暂未标注";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "暂未标注";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function isSafeColor(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|hsla?\([\d\s,.%deg]+\)|transparent|currentcolor)$/i.test(value);
}

function isSafeFontSize(value: string): boolean {
  const match = value.match(/^(\d+(?:\.\d+)?)(px|rem|em|%)$/i);
  if (!match) return false;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (unit === "px") return amount <= 72;
  if (unit === "rem" || unit === "em") return amount <= 4.5;
  return amount <= 450;
}

function sanitizeInlineStyle(element: HTMLElement): void {
  const allowed: string[] = [];
  for (let index = 0; index < element.style.length; index += 1) {
    const property = element.style.item(index).toLowerCase();
    const value = element.style.getPropertyValue(property).trim();
    if ((property === "color" || property === "background-color") && isSafeColor(value)) {
      allowed.push(`${property}: ${value}`);
    } else if (property === "font-size" && isSafeFontSize(value)) {
      allowed.push(`${property}: ${value}`);
    } else if (property === "text-align" && /^(left|right|center|justify|start|end)$/i.test(value)) {
      allowed.push(`${property}: ${value}`);
    }
  }
  if (allowed.length > 0) element.setAttribute("style", allowed.join("; "));
  else element.removeAttribute("style");
}

function isSafeLinkUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return /^(https:\/\/|mailto:|tel:)/i.test(url);
}

function safeStorageImageUrl(value: string | null): string | null {
  if (!value) return null;
  const url = value.trim();
  if (/^\/api\/storage\/objects\/[a-z0-9/_-]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:"
      && parsed.origin === window.location.origin
      && /^\/api\/storage\/objects\/[a-z0-9/_-]+$/i.test(parsed.pathname)
    ) {
      return parsed.href;
    }
  } catch {
    // Invalid URLs are intentionally hidden.
  }
  return null;
}

function sanitizeAnnouncementContent(content: string): string {
  const source = content.trim();
  if (!source) return "";

  const richHtml = /<\/?[a-z][\s\S]*>/i.test(source);
  const safeSource = richHtml
    ? source
    : source
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br />");

  const sanitized = DOMPurify.sanitize(safeSource, {
    ALLOWED_TAGS: [
      "a", "b", "blockquote", "br", "code", "col", "colgroup", "div", "em", "figcaption", "figure",
      "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "span",
      "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "mark",
    ],
    ALLOWED_ATTR: [
      "alt", "colspan", "height", "href", "rel", "rowspan", "src", "style", "target",
      "title", "width",
    ],
    FORBID_TAGS: ["embed", "iframe", "object", "script", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });

  const template = document.createElement("template");
  template.innerHTML = sanitized;

  template.content.querySelectorAll<HTMLElement>("[style]").forEach(sanitizeInlineStyle);
  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!isSafeLinkUrl(href)) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }
    if (anchor.target === "_blank") {
      anchor.rel = "noopener noreferrer";
    } else {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }
  });
  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const safeSrc = safeStorageImageUrl(image.getAttribute("src"));
    if (!safeSrc) {
      image.remove();
      return;
    }
    image.src = safeSrc;
    image.loading = "lazy";
    image.decoding = "async";
  });

  return template.innerHTML;
}

export default function AnnouncementDetail() {
  const { id: rawId } = useParams<{ id: string }>();
  const announcementId = Number(rawId);
  const validId = Number.isInteger(announcementId) && announcementId > 0;
  const { data, error, isLoading, isError, refetch } = useQuery<AnnouncementDetailData>({
    queryKey: ["community-announcement", announcementId],
    enabled: validId,
    queryFn: async () => {
      const response = await fetch(`${BASE}/api/community-announcements/${announcementId}`);
      if (response.status === 404) throw new Error("NOT_FOUND");
      if (!response.ok) throw new Error("加载失败");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const cleanContent = useMemo(() => sanitizeAnnouncementContent(data?.content ?? ""), [data?.content]);
  const isMissing = !validId || error?.message === "NOT_FOUND";
  const isPlatform = data?.source === "platform";
  const returnHref = data?.communityId ? `/community/${data.communityId}` : "/community";
  const returnLabel = data?.communityName ? `返回${data.communityName}` : "返回社区中心";
  const safeCoverUrl = safeStorageImageUrl(data?.coverUrl ?? null);

  useEffect(() => {
    if (data?.title) document.title = `${data.title}｜接单吧`;
    return () => { document.title = "接单吧"; };
  }, [data?.title]);

  return (
    <Layout>
      <main className="mx-auto max-w-5xl pb-16 pt-2 px-4 md:px-0">
        <Link
          href={returnHref}
          className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white transition-all group-hover:border-primary/30 group-hover:shadow-sm">
            <ArrowLeft size={15} />
          </span>
          {returnLabel}
        </Link>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <section className="h-56 rounded-[24px] bg-slate-100" />
            <section className="h-[480px] rounded-[24px] bg-slate-100" />
          </div>
        ) : isMissing ? (
          <NoticeState
            icon={<FileText size={36} />}
            title="公告未找到"
            description="该公告可能尚未发布、已下线，或链接无效。"
          />
        ) : isError ? (
          <NoticeState
            icon={<AlertCircle size={36} />}
            title="公告加载失败"
            description="请检查网络后重新加载。"
            action={<button type="button" onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"><RefreshCw size={15} />重新加载</button>}
          />
        ) : data ? (
          <article className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
            <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(115deg,#00327d_0%,#0755c7_58%,#0878dc_100%)] px-6 py-10 text-white shadow-lg shadow-blue-900/10 md:px-12 md:py-12">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px", maskImage: "linear-gradient(to bottom right, black, transparent 80%)" }}
              />
              <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-4 -top-10 h-44 w-44 rounded-full border border-white/10" />

              <div className="relative max-w-4xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md border border-white/10 shadow-sm">
                    {isPlatform ? <Megaphone size={13} /> : <Building2 size={13} />}
                    {isPlatform ? "官方公告" : data.communityName ?? "社区公告"}
                  </span>
                  {data.categoryName && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90">
                      <Tag size={12} />{data.categoryName}
                    </span>
                  )}
                </div>
                <h1 className="mt-6 text-2xl font-bold leading-[1.35] tracking-tight text-white md:text-[38px] drop-shadow-sm">{data.title}</h1>
                <div className="mt-8 flex items-center gap-2 text-sm text-blue-50/85 font-medium">
                  <CalendarDays size={16} className="opacity-80" />
                  <time dateTime={data.publishedAt ?? data.createdAt}>发布于 {formatDateTime(data.publishedAt ?? data.createdAt)}</time>
                </div>
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm">
              {safeCoverUrl && (
                <div className="border-b border-slate-100 bg-slate-50">
                  <img src={safeCoverUrl} alt="公告封面" className="max-h-[400px] w-full object-cover" />
                </div>
              )}
              <div className="px-6 py-10 md:px-16 md:py-14">
                {cleanContent ? (
                  <div
                    className="prose prose-slate md:prose-lg max-w-3xl mx-auto prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-primary hover:prose-a:text-primary/80 prose-a:font-medium prose-a:underline prose-a:underline-offset-4 prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:bg-slate-50 prose-blockquote:px-6 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-slate-600 prose-img:mx-auto prose-img:rounded-xl prose-img:shadow-sm prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-3 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-3"
                    dangerouslySetInnerHTML={{ __html: cleanContent }}
                  />
                ) : (
                  <div className="py-20 text-center">
                    <FileText size={40} className="mx-auto text-slate-200" />
                    <p className="mt-4 text-sm font-medium text-slate-400">本公告暂无正文内容。</p>
                  </div>
                )}
              </div>
            </section>
          </article>
        ) : null}
      </main>
    </Layout>
  );
}

function NoticeState({
  icon, title, description, action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white py-24 text-center shadow-sm">
      <div className="mx-auto flex justify-center text-slate-300">{icon}</div>
      <h1 className="mt-5 text-lg font-bold text-slate-800">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-6">{action ?? <Link href="/community" className="inline-flex rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90">返回社区中心</Link>}</div>
    </section>
  );
}