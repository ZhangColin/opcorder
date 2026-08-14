import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Code2, Cpu, Zap, HardDrive, Server, Coins,
  KeyRound, Boxes, ShoppingCart, Receipt, Box, Database, Layers, Star,
} from "lucide-react";
import OverviewModule from "@/components/compute/OverviewModule";
import NotebooksModule from "@/components/compute/NotebooksModule";
import TrainingModule from "@/components/compute/TrainingModule";
import InferenceModule from "@/components/compute/InferenceModule";
import StorageModule from "@/components/compute/StorageModule";
import ResourcesModule from "@/components/compute/ResourcesModule";
import TokensModule from "@/components/compute/TokensModule";
import ApiKeysModule from "@/components/compute/ApiKeysModule";
import ImagesModule from "@/components/compute/ImagesModule";
import OrdersModule from "@/components/compute/OrdersModule";
import BillsModule from "@/components/compute/BillsModule";
import RepoModule from "@/components/compute/RepoModule";
import FavoritesModule from "@/components/compute/FavoritesModule";

interface NavGroup {
  title: string;
  items: { key: string; label: string; icon: React.ReactNode }[];
}

const NAV: NavGroup[] = [
  {
    title: "工作台",
    items: [
      { key: "overview", label: "概览", icon: <LayoutDashboard size={17} /> },
      { key: "notebooks", label: "模型开发", icon: <Code2 size={17} /> },
      { key: "training", label: "模型训练", icon: <Cpu size={17} /> },
      { key: "inference", label: "推理服务", icon: <Zap size={17} /> },
    ],
  },
  {
    title: "资源",
    items: [
      { key: "storage", label: "存储管理", icon: <HardDrive size={17} /> },
      { key: "resources", label: "计算资源", icon: <Server size={17} /> },
      { key: "tokens", label: "Token 资源", icon: <Coins size={17} /> },
      { key: "apikeys", label: "API Key", icon: <KeyRound size={17} /> },
      { key: "images", label: "镜像管理", icon: <Boxes size={17} /> },
    ],
  },
  {
    title: "费用",
    items: [
      { key: "orders", label: "订单管理", icon: <ShoppingCart size={17} /> },
      { key: "bills", label: "账单管理", icon: <Receipt size={17} /> },
    ],
  },
  {
    title: "仓库",
    items: [
      { key: "models", label: "模型仓库", icon: <Box size={17} /> },
      { key: "datasets", label: "数据集仓库", icon: <Database size={17} /> },
      { key: "imagerepo", label: "镜像仓库", icon: <Layers size={17} /> },
      { key: "favorites", label: "我的收藏", icon: <Star size={17} /> },
    ],
  },
];

const VALID = new Set(NAV.flatMap((g) => g.items.map((i) => i.key)));

function renderModule(module: string) {
  switch (module) {
    case "notebooks": return <NotebooksModule />;
    case "training": return <TrainingModule />;
    case "inference": return <InferenceModule />;
    case "storage": return <StorageModule />;
    case "resources": return <ResourcesModule />;
    case "tokens": return <TokensModule />;
    case "apikeys": return <ApiKeysModule />;
    case "images": return <ImagesModule />;
    case "orders": return <OrdersModule />;
    case "bills": return <BillsModule />;
    case "models": return <RepoModule repoType="model" />;
    case "datasets": return <RepoModule repoType="dataset" />;
    case "imagerepo": return <RepoModule repoType="image" />;
    case "favorites": return <FavoritesModule />;
    case "overview":
    default: return <OverviewModule />;
  }
}

export default function ComputeCenter() {
  const [location] = useLocation();
  // /compute/:module → module，默认 overview
  const seg = location.replace(/^\/compute\/?/, "").split("/")[0];
  const module = VALID.has(seg) ? seg : "overview";

  return (
    <div className="min-h-screen bg-[#f9f9fc]">
      <div className="max-w-[1600px] mx-auto flex">
        {/* 左侧栏 */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-white border-r border-border/50 min-h-screen sticky top-0 py-6">
          <div className="px-5 mb-6">
            <h1 className="text-lg font-black text-primary font-display flex items-center gap-2">
              <Cpu size={20} /> 算力中心
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">AI 训推一体控制台</p>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 space-y-5">
            {NAV.map((group) => (
              <div key={group.title}>
                <p className="px-2 mb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((it) => {
                    const active = module === it.key;
                    return (
                      <Link
                        key={it.key}
                        href={`/compute/${it.key}`}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                          active ? "text-primary bg-primary/5" : "text-slate-500 hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {it.icon}
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* 移动端顶部导航 */}
        <div className="flex-1 min-w-0">
          <div className="md:hidden bg-white border-b border-border/50 px-4 py-3 overflow-x-auto sticky top-0 z-10">
            <div className="flex gap-1 w-max">
              {NAV.flatMap((g) => g.items).map((it) => {
                const active = module === it.key;
                return (
                  <Link
                    key={it.key}
                    href={`/compute/${it.key}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      active ? "text-primary bg-primary/5" : "text-slate-500"
                    }`}
                  >
                    {it.icon}
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <main className="p-4 sm:p-6 lg:p-8">{renderModule(module)}</main>
        </div>
      </div>
    </div>
  );
}
