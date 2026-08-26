import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, setOn401Handler } from "@workspace/api-client-react";
import { useEffect, lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from "react";
import { getValidAccessToken, clearSession, refreshAccessToken, isTokenExpiredSync, getRefreshToken, getAccessToken, getStoredUser } from "@/lib/auth";
import { useSiteSettings } from "@/hooks/use-site-settings";

import { Layout } from "@/components/layout/Layout";
// 首页保持同步加载,保证首屏最快渲染;其余页面全部按需加载
import Home from "@/pages/Home";

const DEV_LAZY_RELOAD_KEY = "jiedanba:dev-lazy-reload";

function lazyPage<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    if (!import.meta.env.DEV) return loader();

    let timer: number | undefined;
    try {
      return await Promise.race([
        loader(),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("开发服务器模块加载超时")),
            8_000,
          );
        }),
      ]);
    } catch (error) {
      const lastReload = Number(sessionStorage.getItem(DEV_LAZY_RELOAD_KEY) ?? 0);
      if (Date.now() - lastReload > 30_000) {
        sessionStorage.setItem(DEV_LAZY_RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  });
}

const Login = lazyPage(() => import("@/pages/Login"));
const PubDemandList = lazyPage(() => import("@/pages/pub/PubDemandList"));
const PubCreateDemand = lazyPage(() => import("@/pages/pub/PubCreateDemand"));
const PubDemandDetail = lazyPage(() => import("@/pages/pub/PubDemandDetail"));
const PubContractList = lazyPage(() => import("@/pages/pub/PubContractList"));
const PubContractDetail = lazyPage(() => import("@/pages/pub/PubContractDetail"));
const PubPaymentList = lazyPage(() => import("@/pages/pub/PubPaymentList"));
const PubPaymentDetail = lazyPage(() => import("@/pages/pub/PubPaymentDetail"));
const PubDeliveryList = lazyPage(() => import("@/pages/pub/PubDeliveryList"));
const PubDeliveryDetail = lazyPage(() => import("@/pages/pub/PubDeliveryDetail"));
const PubTicketList = lazyPage(() => import("@/pages/pub/PubTicketList"));
const PubTicketDetail = lazyPage(() => import("@/pages/pub/PubTicketDetail"));
const PubHome = lazyPage(() => import("@/pages/pub/PubHome"));
const PubNotifications = lazyPage(() => import("@/pages/pub/PubNotifications"));
const PubProfile = lazyPage(() => import("@/pages/PublisherProfile"));
const CommunityHub = lazyPage(() => import("@/pages/CommunityHub"));
const CommunityDetail = lazyPage(() => import("@/pages/CommunityDetail"));
const AnnouncementDetail = lazyPage(() => import("@/pages/AnnouncementDetail"));
const Auth = lazyPage(() => import("@/pages/Auth"));
const Profile = lazyPage(() => import("@/pages/Profile"));
const Portfolios = lazyPage(() => import("@/pages/Portfolios"));
const Academy = lazyPage(() => import("@/pages/Academy"));
const AcademyDetail = lazyPage(() => import("@/pages/AcademyDetail"));
const Notifications = lazyPage(() => import("@/pages/Notifications"));
const AccountSettings = lazyPage(() => import("@/pages/AccountSettings"));
const OpcV2Home = lazyPage(() => import("@/pages/opc-v2/OpcV2Home"));
const OpcV2DemandHall = lazyPage(() => import("@/pages/opc-v2/OpcV2DemandHall"));
const OpcV2TenderList = lazyPage(() => import("@/pages/opc-v2/OpcV2TenderList"));
const OpcV2TenderDetail = lazyPage(() => import("@/pages/opc-v2/OpcV2TenderDetail"));
const OpcV2OrderList = lazyPage(() => import("@/pages/opc-v2/OpcV2OrderList"));
const OpcV2OrderDetail = lazyPage(() => import("@/pages/opc-v2/OpcV2OrderDetail"));
const OpcV2IncomeList = lazyPage(() => import("@/pages/opc-v2/OpcV2IncomeList"));
const OpcV2DeliveryList = lazyPage(() => import("@/pages/opc-v2/OpcV2DeliveryList"));
const OpcV2TicketList = lazyPage(() => import("@/pages/opc-v2/OpcV2TicketList"));
const OpcV2TicketDetail = lazyPage(() => import("@/pages/opc-v2/OpcV2TicketDetail"));
const OpcV2IncomeDetail = lazyPage(() => import("@/pages/opc-v2/OpcV2IncomeDetail"));
const OpcV2ContestList = lazyPage(() => import("@/pages/opc-v2/OpcV2ContestList"));
const OpcV2ContestDetail = lazyPage(() => import("@/pages/opc-v2/OpcV2ContestDetail"));
const ContestRegistrationDetail = lazyPage(() => import("@/pages/ContestRegistrationDetail"));
const ContestDetail = lazyPage(() => import("@/pages/ContestDetail"));
const Admin = lazyPage(() => import("@/pages/Admin"));
const ScreenDisplay = lazyPage(() => import("@/pages/ScreenDisplay"));
const ActivityRegister = lazyPage(() => import("@/pages/ActivityRegister"));
const Terms = lazyPage(() => import("@/pages/Terms"));
const Privacy = lazyPage(() => import("@/pages/Privacy"));
const Support = lazyPage(() => import("@/pages/Support"));
const NotFound = lazyPage(() => import("@/pages/not-found"));
const OrderHall = lazyPage(() => import("@/pages/OrderHall"));
const ComputeCenter = lazyPage(() => import("@/pages/ComputeCenter"));
const ToolsPlatform = lazyPage(() => import("@/pages/ToolsPlatform"));
const AgentUsePage = lazyPage(() => import("@/pages/AgentUsePage"));
const OpcDemandDetail = lazyPage(() => import("@/pages/OpcDemandDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ROUTER_BASE = API_BASE;

/* Send the JWT access token with every API request; auto-refresh when near expiry */
setAuthTokenGetter(() => getValidAccessToken(API_BASE));

/* On 401: force-refresh the token once and retry; clear session + redirect to login on failure.
   Exception: on public browsing pages (e.g. /community), silently fail instead of redirecting. */
const PUBLIC_PAGES = ["/", "/community", "/academy", "/contest", "/order-hall"];

setOn401Handler(async () => {
  const newToken = await refreshAccessToken(API_BASE);
  if (!newToken) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const path = window.location.pathname.slice(base.length) || "/";
    const isPublicPage = PUBLIC_PAGES.some(p => path === p || path.startsWith(p + "/"));
    if (!isPublicPage) {
      clearSession();
      window.location.href = base + "/login";
    }
  }
  return newToken;
});

/* ── 角色门卫组件 ──────────────────────────────── */

/**
 * 返回存储的角色。
 * - token 不是合法 JWT → 清除 session，返回 null
 * - token 已过期且没有 refresh token → 清除 session，返回 null（立即跳登录）
 * - token 已过期但有 refresh token → 仍返回角色，让后台刷新流程处理
 */
function getRole(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  if (token.split(".").length !== 3) {
    clearSession();
    return null;
  }
  if (isTokenExpiredSync() && !getRefreshToken()) {
    clearSession();
    return null;
  }
  return getStoredUser()?.role ?? null;
}

function roleHomePath(role: string | null): string {
  if (role === "publisher") return "/pub";
  if (role === "admin")     return "/admin";
  if (role === "opc")       return "/";
  return "/login";
}

/**
 * 首页专用守卫：匿名 / OPC 放行；其他已登录角色跳转到各自工作台。
 * 避免发单方或管理员看到 OPC 视角的首页。
 */
function PublicOpcGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (role !== null && role !== "opc") navigate(roleHomePath(role));
  }, [navigate, role]);
  if (role !== null && role !== "opc") {
    return null;
  }
  return <>{children}</>;
}

/** 仅限 OPC 访问；其他角色重定向到各自首页 */
function OpcGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (role !== "opc") navigate(roleHomePath(role));
  }, [navigate, role]);
  if (role !== "opc") {
    return null;
  }
  return <>{children}</>;
}

/** 仅限发单方访问；其他角色重定向到各自首页 */
function PublisherGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (role !== "publisher") navigate(roleHomePath(role));
  }, [navigate, role]);
  if (role !== "publisher") {
    return null;
  }
  return <>{children}</>;
}


/** 仅限管理员访问；其他角色重定向到各自首页 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (role !== "admin") navigate(roleHomePath(role));
  }, [navigate, role]);
  if (role !== "admin") {
    return null;
  }
  return <>{children}</>;
}

/** 要求任意已登录用户（社区页等）；未登录重定向到登录页 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!role) navigate("/login");
  }, [navigate, role]);
  if (!role) {
    return null;
  }
  return <>{children}</>;
}

/**
 * 后台 session 守卫：挂载时 + 每次窗口重新激活时检测 token 有效性。
 * 若刷新失败（双 token 均过期），立即硬跳转到登录页。
 */
function SessionWatcher() {
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    let checking = false;

    const check = async () => {
      if (checking) return;
      const role = getStoredUser()?.role;
      if (!role) return; // 未登录，无需检测

      checking = true;
      try {
        const token = await getValidAccessToken(API_BASE);
        if (!token) {
          clearSession();
          window.location.href = base + "/login";
        }
      } finally {
        checking = false;
      }
    };

    check(); // 页面加载时检测一次

    const onFocus = () => check(); // 用户切换回标签页时检测
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* 公开路由 */}
      <Route path="/contest/:id" component={ContestDetail} />
      <Route path="/login" component={Login} />
      <Route path="/auth/:role" component={Auth} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="/activity/:id" component={ActivityRegister} />
      <Route path="/screen">
        {() => <AdminGate><ScreenDisplay /></AdminGate>}
      </Route>
      {/* 管理员专属 */}
      <Route path="/admin">
        {() => <AdminGate><Admin /></AdminGate>}
      </Route>


      {/* V2 发单方前台路由 */}
      <Route path="/pub/demands/new">
        {() => <PublisherGate><PubCreateDemand /></PublisherGate>}
      </Route>
      <Route path="/pub/demands/:id/edit">
        {() => <PublisherGate><PubCreateDemand /></PublisherGate>}
      </Route>
      <Route path="/pub/demands/:id">
        {() => <PublisherGate><PubDemandDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/demands">
        {() => <PublisherGate><PubDemandList /></PublisherGate>}
      </Route>
      <Route path="/pub/contracts/:id">
        {() => <PublisherGate><PubContractDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/contracts">
        {() => <PublisherGate><PubContractList /></PublisherGate>}
      </Route>
      <Route path="/pub/payments/:id">
        {() => <PublisherGate><PubPaymentDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/payments">
        {() => <PublisherGate><PubPaymentList /></PublisherGate>}
      </Route>
      <Route path="/pub/deliveries/:id">
        {() => <PublisherGate><PubDeliveryDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/deliveries">
        {() => <PublisherGate><PubDeliveryList /></PublisherGate>}
      </Route>
      <Route path="/pub/tickets/:id">
        {() => <PublisherGate><PubTicketDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/tickets">
        {() => <PublisherGate><PubTicketList /></PublisherGate>}
      </Route>
      <Route path="/pub/notifications">
        {() => <PublisherGate><PubNotifications /></PublisherGate>}
      </Route>
      <Route path="/pub/profile">
        {() => <PublisherGate><PubProfile /></PublisherGate>}
      </Route>
      <Route path="/pub">
        {() => <PublisherGate><PubHome /></PublisherGate>}
      </Route>

      {/* 算力中心 & 工具平台 */}
      <Route path="/tools/use/:agentId" component={AgentUsePage} />
      <Route path="/compute/:module" component={ComputeCenter} />
      <Route path="/compute" component={ComputeCenter} />
      <Route path="/tools/:module" component={ToolsPlatform} />
      <Route path="/tools" component={ToolsPlatform} />

      {/* 社区 & 学习资源：游客也可访问 */}
       <Route path="/community/announcements/:id" component={AnnouncementDetail} />
      <Route path="/community/:id" component={CommunityDetail} />
      <Route path="/community" component={CommunityHub} />
      <Route path="/academy">{() => <Layout><Academy /></Layout>}</Route>
      <Route path="/academy/course/:id">{() => <Layout><AcademyDetail /></Layout>}</Route>

      {/* 需求大厅：游客也可浏览 */}
      <Route path="/order-hall/:id">{() => <Layout><OpcDemandDetail /></Layout>}</Route>
      <Route path="/order-hall">{() => <Layout><OrderHall /></Layout>}</Route>

      {/* 公开内容页：匿名/OPC 可访问；其他已登录角色跳自己工作台 */}
      <Route path="/">{() => <PublicOpcGate><Layout><Home /></Layout></PublicOpcGate>}</Route>

      {/* OPC V2 工作台路由 */}
      <Route path="/opc">
        {() => <OpcGate><OpcV2Home /></OpcGate>}
      </Route>
      <Route path="/opc/demand-hall">
        {() => <OpcGate><OpcV2DemandHall /></OpcGate>}
      </Route>
      <Route path="/opc/tenders/:id">
        {() => <OpcGate><OpcV2TenderDetail /></OpcGate>}
      </Route>
      <Route path="/opc/tenders">
        {() => <OpcGate><OpcV2TenderList /></OpcGate>}
      </Route>
      <Route path="/opc/orders/:id">
        {() => <OpcGate><OpcV2OrderDetail /></OpcGate>}
      </Route>
      <Route path="/opc/orders">
        {() => <OpcGate><OpcV2OrderList /></OpcGate>}
      </Route>
      <Route path="/opc/income/:id">
        {() => <OpcGate><OpcV2IncomeDetail /></OpcGate>}
      </Route>
      <Route path="/opc/income">
        {() => <OpcGate><OpcV2IncomeList /></OpcGate>}
      </Route>
      <Route path="/opc/deliveries">
        {() => <OpcGate><OpcV2DeliveryList /></OpcGate>}
      </Route>
      <Route path="/opc/tickets/:id">
        {() => <OpcGate><OpcV2TicketDetail /></OpcGate>}
      </Route>
      <Route path="/opc/tickets">
        {() => <OpcGate><OpcV2TicketList /></OpcGate>}
      </Route>
      <Route path="/profile/contests/:registrationId">
        {() => <OpcGate><ContestRegistrationDetail /></OpcGate>}
      </Route>
      <Route path="/profile/contests">
        {() => <OpcGate><OpcV2ContestList /></OpcGate>}
      </Route>

      {/* OPC 专属路由 */}
      <Route>
        {() => (
          <OpcGate>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/profile" component={Profile} />
                <Route path="/portfolios" component={Portfolios} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/account-settings" component={AccountSettings} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </OpcGate>
        )}
      </Route>
    </Switch>
  );
}

function SiteFaviconUpdater() {
  const { data: s } = useSiteSettings();
  useEffect(() => {
    const favicon = s?.site_favicon;
    const name    = s?.site_name;
    if (favicon) {
      let el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!el) {
        el = document.createElement("link");
        el.rel = "icon";
        document.head.appendChild(el);
      }
      el.href = favicon;
    }
    if (name) {
      document.title = `${name} - OPC撮合交易平台`;
    }
  }, [s?.site_favicon, s?.site_name]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionWatcher />
        <WouterRouter base={ROUTER_BASE}>
          <SiteFaviconUpdater />
          <Suspense fallback={<PageLoadingFallback />}>
            <Router />
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function PageLoadingFallback() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSlow(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-muted-foreground">
      {isSlow ? (
        <>
          <p className="text-base font-semibold text-slate-700">页面加载时间过长</p>
          <p className="max-w-md text-sm text-slate-500">网络连接或页面资源暂时不可用，请刷新后重试。</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            刷新页面
          </button>
        </>
      ) : (
        <p>加载中…</p>
      )}
    </div>
  );
}

export default App;
