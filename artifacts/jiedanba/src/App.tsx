import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, setOn401Handler } from "@workspace/api-client-react";
import { useEffect, lazy, Suspense } from "react";
import { getValidAccessToken, clearSession, refreshAccessToken, isTokenExpiredSync, getRefreshToken, getAccessToken, getStoredUser } from "@/lib/auth";
import { useSiteSettings } from "@/hooks/use-site-settings";

import { Layout } from "@/components/layout/Layout";
// 首页保持同步加载,保证首屏最快渲染;其余页面全部按需加载
import Home from "@/pages/Home";
const Login = lazy(() => import("@/pages/Login"));
const PubDemandList = lazy(() => import("@/pages/pub/PubDemandList"));
const PubCreateDemand = lazy(() => import("@/pages/pub/PubCreateDemand"));
const PubDemandDetail = lazy(() => import("@/pages/pub/PubDemandDetail"));
const PubContractList = lazy(() => import("@/pages/pub/PubContractList"));
const PubContractDetail = lazy(() => import("@/pages/pub/PubContractDetail"));
const PubPaymentList = lazy(() => import("@/pages/pub/PubPaymentList"));
const PubPaymentDetail = lazy(() => import("@/pages/pub/PubPaymentDetail"));
const PubDeliveryList = lazy(() => import("@/pages/pub/PubDeliveryList"));
const PubDeliveryDetail = lazy(() => import("@/pages/pub/PubDeliveryDetail"));
const PubTicketList = lazy(() => import("@/pages/pub/PubTicketList"));
const PubTicketDetail = lazy(() => import("@/pages/pub/PubTicketDetail"));
const PubHome = lazy(() => import("@/pages/pub/PubHome"));
const PubNotifications = lazy(() => import("@/pages/pub/PubNotifications"));
const PubProfile = lazy(() => import("@/pages/PublisherProfile"));
const Community = lazy(() => import("@/pages/Community"));
const Auth = lazy(() => import("@/pages/Auth"));
const Profile = lazy(() => import("@/pages/Profile"));
const Portfolios = lazy(() => import("@/pages/Portfolios"));
const Academy = lazy(() => import("@/pages/Academy"));
const AcademyDetail = lazy(() => import("@/pages/AcademyDetail"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));
const OpcV2Home = lazy(() => import("@/pages/opc-v2/OpcV2Home"));
const OpcV2DemandHall = lazy(() => import("@/pages/opc-v2/OpcV2DemandHall"));
const OpcV2TenderList = lazy(() => import("@/pages/opc-v2/OpcV2TenderList"));
const OpcV2TenderDetail = lazy(() => import("@/pages/opc-v2/OpcV2TenderDetail"));
const OpcV2OrderList = lazy(() => import("@/pages/opc-v2/OpcV2OrderList"));
const OpcV2OrderDetail = lazy(() => import("@/pages/opc-v2/OpcV2OrderDetail"));
const OpcV2IncomeList = lazy(() => import("@/pages/opc-v2/OpcV2IncomeList"));
const OpcV2DeliveryList = lazy(() => import("@/pages/opc-v2/OpcV2DeliveryList"));
const OpcV2TicketList = lazy(() => import("@/pages/opc-v2/OpcV2TicketList"));
const OpcV2TicketDetail = lazy(() => import("@/pages/opc-v2/OpcV2TicketDetail"));
const OpcV2IncomeDetail = lazy(() => import("@/pages/opc-v2/OpcV2IncomeDetail"));
const OpcV2ContestList = lazy(() => import("@/pages/opc-v2/OpcV2ContestList"));
const OpcV2ContestDetail = lazy(() => import("@/pages/opc-v2/OpcV2ContestDetail"));
const ContestRegistrationDetail = lazy(() => import("@/pages/ContestRegistrationDetail"));
const ContestDetail = lazy(() => import("@/pages/ContestDetail"));
const Admin = lazy(() => import("@/pages/Admin"));
const ScreenDisplay = lazy(() => import("@/pages/ScreenDisplay"));
const ActivityRegister = lazy(() => import("@/pages/ActivityRegister"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Support = lazy(() => import("@/pages/Support"));
const NotFound = lazy(() => import("@/pages/not-found"));
const OrderHall = lazy(() => import("@/pages/OrderHall"));
const OpcDemandDetail = lazy(() => import("@/pages/OpcDemandDetail"));

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
  if (role !== null && role !== "opc") {
    navigate(roleHomePath(role));
    return null;
  }
  return <>{children}</>;
}

/** 仅限 OPC 访问；其他角色重定向到各自首页 */
function OpcGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  if (role !== "opc") {
    navigate(roleHomePath(role));
    return null;
  }
  return <>{children}</>;
}

/** 仅限发单方访问；其他角色重定向到各自首页 */
function PublisherGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  if (role !== "publisher") {
    navigate(roleHomePath(role));
    return null;
  }
  return <>{children}</>;
}


/** 仅限管理员访问；其他角色重定向到各自首页 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  if (role !== "admin") {
    navigate(roleHomePath(role));
    return null;
  }
  return <>{children}</>;
}

/** 要求任意已登录用户（社区页等）；未登录重定向到登录页 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const role = getRole();
  const [, navigate] = useLocation();
  if (!role) {
    navigate("/login");
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

      {/* 社区 & 学习资源：游客也可访问 */}
      <Route path="/community" component={Community} />
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
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted-foreground">加载中…</div>}>
            <Router />
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
