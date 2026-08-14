import { useLocation } from "wouter";
import {
  Bot, Database, Wrench, Store, LayoutTemplate, Puzzle, Wallet, Receipt,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import AgentsModule from "@/components/tools/AgentsModule";
import KnowledgeModule from "@/components/tools/KnowledgeModule";
import ToolMgmtModule from "@/components/tools/ToolMgmtModule";
import MarketModule from "@/components/tools/MarketModule";
import TemplatesModule from "@/components/tools/TemplatesModule";
import PluginsModule from "@/components/tools/PluginsModule";
import EarningsModule from "@/components/tools/EarningsModule";
import SubscriptionsModule from "@/components/tools/SubscriptionsModule";

type ModuleKey =
  | "agents" | "knowledge" | "toolmgmt"
  | "market" | "templates" | "plugins" | "earnings" | "subscriptions";

interface NavItem { key: ModuleKey; label: string; icon: React.ReactNode; }

const WORKSPACE: NavItem[] = [
  { key: "agents", label: "智能体管理", icon: <Bot size={17} /> },
  { key: "knowledge", label: "知识库", icon: <Database size={17} /> },
  { key: "toolmgmt", label: "工具管理", icon: <Wrench size={17} /> },
];

const MARKET: NavItem[] = [
  { key: "market", label: "智能体市场", icon: <Store size={17} /> },
  { key: "templates", label: "模板市场", icon: <LayoutTemplate size={17} /> },
  { key: "plugins", label: "工具市场", icon: <Puzzle size={17} /> },
  { key: "earnings", label: "我的收益", icon: <Wallet size={17} /> },
  { key: "subscriptions", label: "订阅与账单", icon: <Receipt size={17} /> },
];

const VALID = new Set<string>([...WORKSPACE, ...MARKET].map((i) => i.key));

function renderModule(key: ModuleKey) {
  switch (key) {
    case "agents": return <AgentsModule />;
    case "knowledge": return <KnowledgeModule />;
    case "toolmgmt": return <ToolMgmtModule />;
    case "market": return <MarketModule />;
    case "templates": return <TemplatesModule />;
    case "plugins": return <PluginsModule />;
    case "earnings": return <EarningsModule />;
    case "subscriptions": return <SubscriptionsModule />;
  }
}

export default function ToolsPlatform() {
  const [location, navigate] = useLocation();

  // location within this route, e.g. "/tools/market" -> "market"
  const seg = location.replace(/^\/tools\/?/, "").split("/")[0];
  const current: ModuleKey = (VALID.has(seg) ? seg : "market") as ModuleKey;

  const go = (key: ModuleKey) => navigate(`/tools/${key}`);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex pt-16 sm:pt-20">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-border/60 flex-col py-6 sticky top-16 sm:top-20 h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] overflow-y-auto">
        <div className="px-6 mb-6">
          <h2 className="text-lg font-extrabold text-primary font-display">工具平台</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">智能体 · 知识库 · 工具</p>
        </div>

        <NavGroup title="工作区" items={WORKSPACE} current={current} onGo={go} />
        <NavGroup title="市场" items={MARKET} current={current} onGo={go} />
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px]">
        {/* 移动端横向导航 */}
        <div className="md:hidden mb-4 overflow-x-auto">
          <div className="flex gap-1 w-max">
            {[...WORKSPACE, ...MARKET].map((it) => {
              const active = current === it.key;
              return (
                <button
                  key={it.key}
                  onClick={() => go(it.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    active ? "text-primary bg-primary/5" : "text-slate-500"
                  }`}
                >
                  {it.icon}
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
        {renderModule(current)}
      </main>
      </div>
    </div>
  );
}

function NavGroup({
  title, items, current, onGo,
}: {
  title: string; items: NavItem[]; current: ModuleKey; onGo: (k: ModuleKey) => void;
}) {
  return (
    <div className="mb-6 px-3">
      <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = current === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onGo(it.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                active ? "bg-primary/8 text-primary" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={active ? "text-primary" : "text-slate-400"}>{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
