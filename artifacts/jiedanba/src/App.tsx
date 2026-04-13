import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, setOn401Handler } from "@workspace/api-client-react";
import { useEffect } from "react";
import { getValidAccessToken, clearSession, refreshAccessToken, isTokenExpiredSync, getRefreshToken } from "@/lib/auth";
import { useSiteSettings } from "@/hooks/use-site-settings";

import { Layout } from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import PublisherHome from "@/pages/PublisherHome";
import PublisherDemandDetail from "@/pages/PublisherDemandDetail";
import PublisherDemandList from "@/pages/PublisherDemandList";
import PublisherCreateDemand from "@/pages/PublisherCreateDemand";
import PublisherOrderList from "@/pages/PublisherOrderList";
import PublisherOrderDetail from "@/pages/PublisherOrderDetail";
import PublisherOpcLibrary from "@/pages/PublisherOpcLibrary";
import PublisherNotifications from "@/pages/PublisherNotifications";
import PublisherFinance from "@/pages/PublisherFinance";
import PublisherProfile from "@/pages/PublisherProfile";
import PublisherCockpit from "@/pages/PublisherCockpit";
import PublisherDisputes from "@/pages/PublisherDisputes";
import Community from "@/pages/Community";
import Auth from "@/pages/Auth";
import DemandDetail from "@/pages/DemandDetail";
import MyOrders from "@/pages/MyOrders";
import OrderDetail from "@/pages/OrderDetail";
import OrderHall from "@/pages/OrderHall";
import Profile from "@/pages/Profile";
import Portfolios from "@/pages/Portfolios";
import Academy from "@/pages/Academy";
import Notifications from "@/pages/Notifications";
import OpcIncome from "@/pages/OpcIncome";
import SettlementAccount from "@/pages/SettlementAccount";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* Send the JWT access token with every API request; auto-refresh when near expiry */
setAuthTokenGetter(() => getValidAccessToken(API_BASE));

/* On 401: force-refresh the token once and retry; clear session + redirect to login on failure.
   Exception: on public browsing pages (e.g. /community), silently fail instead of redirecting. */
const PUBLIC_PAGES = ["/community", "/academy"];

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
  const token = localStorage.getItem("jdb_user_id");
  if (!token) return null;
  if (token.split(".").length !== 3) {
    clearSession();
    return null;
  }
  if (isTokenExpiredSync() && !getRefreshToken()) {
    clearSession();
    return null;
  }
  return localStorage.getItem("jdb_role");
}

function roleHomePath(role: string | null): string {
  if (role === "publisher") return "/publisher";
  if (role === "admin")     return "/admin";
  if (role === "opc")       return "/";
  return "/login";
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
      const role = localStorage.getItem("jdb_role");
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
      <Route path="/login" component={Login} />
      <Route path="/auth/:role" component={Auth} />

      {/* 管理员专属 */}
      <Route path="/admin">
        {() => <AdminGate><Admin /></AdminGate>}
      </Route>

      {/* 发单方专属路由 */}
      <Route path="/publisher">
        {() => <PublisherGate><PublisherHome /></PublisherGate>}
      </Route>
      <Route path="/publisher/demands">
        {() => <PublisherGate><PublisherDemandList /></PublisherGate>}
      </Route>
      <Route path="/publisher/demands/new">
        {() => <PublisherGate><PublisherCreateDemand /></PublisherGate>}
      </Route>
      <Route path="/publisher/demands/:id/edit">
        {() => <PublisherGate><PublisherCreateDemand /></PublisherGate>}
      </Route>
      <Route path="/publisher/demand/:id">
        {() => <PublisherGate><PublisherDemandDetail /></PublisherGate>}
      </Route>
      <Route path="/publisher/orders">
        {() => <PublisherGate><PublisherOrderList /></PublisherGate>}
      </Route>
      <Route path="/publisher/orders/:id">
        {() => <PublisherGate><PublisherOrderDetail /></PublisherGate>}
      </Route>
      <Route path="/publisher/opc-library">
        {() => <PublisherGate><PublisherOpcLibrary /></PublisherGate>}
      </Route>
      <Route path="/publisher/notifications">
        {() => <PublisherGate><PublisherNotifications /></PublisherGate>}
      </Route>
      <Route path="/publisher/finance">
        {() => <PublisherGate><PublisherFinance /></PublisherGate>}
      </Route>
      <Route path="/publisher/profile">
        {() => <PublisherGate><PublisherProfile /></PublisherGate>}
      </Route>
      <Route path="/publisher/cockpit">
        {() => <PublisherGate><PublisherCockpit /></PublisherGate>}
      </Route>
      <Route path="/publisher/disputes">
        {() => <PublisherGate><PublisherDisputes /></PublisherGate>}
      </Route>

      {/* 社区 & 学习资源：游客也可访问 */}
      <Route path="/community" component={Community} />
      <Route path="/academy" component={Academy} />

      {/* OPC 专属路由 */}
      <Route>
        {() => (
          <OpcGate>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/demands/:id" component={DemandDetail} />
                <Route path="/order-hall" component={OrderHall} />
                <Route path="/orders" component={MyOrders} />
                <Route path="/orders/:id" component={OrderDetail} />
                <Route path="/profile" component={Profile} />
                <Route path="/portfolios" component={Portfolios} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/income" component={OpcIncome} />
                <Route path="/settlement-account" component={SettlementAccount} />
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SiteFaviconUpdater />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
