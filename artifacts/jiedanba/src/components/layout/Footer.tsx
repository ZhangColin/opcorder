import { ShieldCheck, Mail } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useSiteSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/site-settings`);
      if (!res.ok) throw new Error("获取站点设置失败");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function Footer() {
  const { data: s } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const siteName = s?.site_name ?? "接单吧";
  const slogan   = s?.footer_slogan ?? "引领企业数字生态转型的超级个体撮合交易平台。精准匹配，担保交易，赋能数字建设。";
  const copyright = s?.footer_copyright ?? "© 2026 海创元数字交易中心. 保留所有权利. 国资监管机构.";
  const icp       = s?.icp_number ?? "";

  const resourceLinks = [
    { text: s?.footer_resource1_text ?? "API 开发文档",  href: s?.footer_resource1_url ?? "#" },
    { text: s?.footer_resource2_text ?? "OPC 认证体系", href: s?.footer_resource2_url ?? "#" },
    { text: s?.footer_resource3_text ?? "交易保障协议", href: s?.footer_resource3_url ?? "#" },
  ].filter(l => l.text);

  const aboutLinks = [
    { text: s?.footer_about1_text ?? "海创元生态", href: s?.footer_about1_url ?? "#" },
    { text: s?.footer_about2_text ?? "联系客服",   href: s?.footer_about2_url ?? "#" },
    { text: s?.footer_about3_text ?? "隐私政策",   href: s?.footer_about3_url ?? "#" },
  ].filter(l => l.text);

  function handleSubscribe() {
    if (!email || !email.includes("@")) return;
    setSubscribed(true);
    setEmail("");
  }

  return (
    <footer className="w-full pt-20 pb-10 px-8 bg-white border-t border-border mt-20">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8">
        {/* 品牌区 */}
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="text-primary" size={28} />
            <span className="font-display font-bold text-2xl text-foreground">{siteName}</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            {slogan}
          </p>
        </div>

        {/* 平台资源 */}
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">平台资源</h5>
          <ul className="space-y-4">
            {resourceLinks.map((l, i) => (
              <li key={i}>
                <a
                  href={l.href}
                  target={l.href !== "#" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-sm hover:text-primary transition-colors"
                >
                  {l.text}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* 关于我们 */}
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">关于我们</h5>
          <ul className="space-y-4">
            {aboutLinks.map((l, i) => (
              <li key={i}>
                <a
                  href={l.href}
                  target={l.href !== "#" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-sm hover:text-primary transition-colors"
                >
                  {l.text}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* 订阅 + 版权 */}
        <div>
          <h5 className="font-bold text-sm tracking-wider text-primary mb-6">订阅行业动态</h5>
          {subscribed ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-3">
              <Mail size={16} />
              订阅成功，感谢关注！
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="bg-muted border-none rounded-lg px-4 py-3 text-sm w-full focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="您的邮箱地址"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubscribe()}
              />
              <button
                onClick={handleSubscribe}
                className="bg-primary text-white px-4 rounded-lg font-bold active:scale-95 transition-all shadow-md shadow-primary/20 whitespace-nowrap"
              >
                订阅
              </button>
            </div>
          )}
          <p className="text-muted-foreground text-[11px] mt-6 tracking-wide">
            {copyright}
            {icp && <span className="ml-2">{icp}</span>}
          </p>
        </div>
      </div>
    </footer>
  );
}
