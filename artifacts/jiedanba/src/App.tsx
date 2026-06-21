import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, setOn401Handler } from "@workspace/api-client-react";
import { useEffect } from "react";
import { getValidAccessToken, clearSession, refreshAccessToken, isTokenExpiredSync, getRefreshToken, getAccessToken, getStoredUser } from "@/lib/auth";
import { useSiteSettings } from "@/hooks/use-site-settings";

import { Layout } from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import AdminV2Overview from "@/pages/admin-v2/AdminV2Overview";
import AdminV2ClientDemandList from "@/pages/admin-v2/AdminV2ClientDemandList";
import AdminV2ClientDemandDetail from "@/pages/admin-v2/AdminV2ClientDemandDetail";
import AdminV2ContractAList from "@/pages/admin-v2/AdminV2ContractAList";
import AdminV2ContractADetail from "@/pages/admin-v2/AdminV2ContractADetail";
import AdminV2PaymentAList from "@/pages/admin-v2/AdminV2PaymentAList";
import AdminV2PaymentADetail from "@/pages/admin-v2/AdminV2PaymentADetail";
import AdminV2TicketAList from "@/pages/admin-v2/AdminV2TicketAList";
import AdminV2TicketADetail from "@/pages/admin-v2/AdminV2TicketADetail";
import AdminV2OutsourceDemandList from "@/pages/admin-v2/AdminV2OutsourceDemandList";
import AdminV2OutsourceDemandNew from "@/pages/admin-v2/AdminV2OutsourceDemandNew";
import AdminV2OutsourceDemandDetail from "@/pages/admin-v2/AdminV2OutsourceDemandDetail";
import AdminV2TenderList from "@/pages/admin-v2/AdminV2TenderList";
import AdminV2TenderDetail from "@/pages/admin-v2/AdminV2TenderDetail";
import AdminV2OutsourceOrderList from "@/pages/admin-v2/AdminV2OutsourceOrderList";
import AdminV2OutsourceOrderDetail from "@/pages/admin-v2/AdminV2OutsourceOrderDetail";
import AdminV2PaymentBList from "@/pages/admin-v2/AdminV2PaymentBList";
import AdminV2PaymentBDetail from "@/pages/admin-v2/AdminV2PaymentBDetail";
import AdminV2TicketBList from "@/pages/admin-v2/AdminV2TicketBList";
import AdminV2TicketBDetail from "@/pages/admin-v2/AdminV2TicketBDetail";
import PubDemandList from "@/pages/pub/PubDemandList";
import PubCreateDemand from "@/pages/pub/PubCreateDemand";
import PubDemandDetail from "@/pages/pub/PubDemandDetail";
import PubContractList from "@/pages/pub/PubContractList";
import PubContractDetail from "@/pages/pub/PubContractDetail";
import PubPaymentList from "@/pages/pub/PubPaymentList";
import PubPaymentDetail from "@/pages/pub/PubPaymentDetail";
import PubTicketList from "@/pages/pub/PubTicketList";
import PubTicketDetail from "@/pages/pub/PubTicketDetail";
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
import AcademyDetail from "@/pages/AcademyDetail";
import Notifications from "@/pages/Notifications";
import OpcIncome from "@/pages/OpcIncome";
import OpcMyBids from "@/pages/OpcMyBids";
import AccountSettings from "@/pages/AccountSettings";
import OpcV2Home from "@/pages/opc-v2/OpcV2Home";
import OpcV2DemandHall from "@/pages/opc-v2/OpcV2DemandHall";
import OpcV2TenderList from "@/pages/opc-v2/OpcV2TenderList";
import OpcV2TenderDetail from "@/pages/opc-v2/OpcV2TenderDetail";
import OpcV2OrderList from "@/pages/opc-v2/OpcV2OrderList";
import OpcV2OrderDetail from "@/pages/opc-v2/OpcV2OrderDetail";
import OpcV2IncomeList from "@/pages/opc-v2/OpcV2IncomeList";
import OpcV2TicketList from "@/pages/opc-v2/OpcV2TicketList";
import OpcV2TicketDetail from "@/pages/opc-v2/OpcV2TicketDetail";
import OpcV2IncomeDetail from "@/pages/opc-v2/OpcV2IncomeDetail";
import Admin from "@/pages/Admin";
import ScreenDisplay from "@/pages/ScreenDisplay";
import MiniScreen from "@/pages/MiniScreen";
import ActivityRegister from "@/pages/ActivityRegister";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Support from "@/pages/Support";
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
const ROUTER_BASE = API_BASE;

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
  if (role === "publisher") return "/pub/demands";
  if (role === "admin")     return "/admin/v2/overview";
  if (role === "opc")       return "/opc";
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

/** /admin/v2 直接跳转到概览页 */
function AdminV2Redirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/admin/v2/overview", { replace: true }); }, []);
  return null;
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
      <Route path="/login" component={Login} />
      <Route path="/auth/:role" component={Auth} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="/activity/:id" component={ActivityRegister} />
      <Route path="/screen">
        {() => <AdminGate><ScreenDisplay /></AdminGate>}
      </Route>
      <Route path="/miniscreen">
        {() => <AdminGate><MiniScreen /></AdminGate>}
      </Route>

      {/* 管理员专属 */}
      <Route path="/admin">
        {() => <AdminGate><Admin /></AdminGate>}
      </Route>

      {/* V2 运营后台 */}
      <Route path="/admin/v2">
        {() => <AdminGate><AdminV2Redirect /></AdminGate>}
      </Route>
      <Route path="/admin/v2/overview">
        {() => <AdminGate><AdminV2Overview /></AdminGate>}
      </Route>
      <Route path="/admin/v2/client-demands/:id">
        {() => <AdminGate><AdminV2ClientDemandDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/client-demands">
        {() => <AdminGate><AdminV2ClientDemandList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/contracts-a/:id">
        {() => <AdminGate><AdminV2ContractADetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/contracts-a">
        {() => <AdminGate><AdminV2ContractAList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/payments-a/:id">
        {() => <AdminGate><AdminV2PaymentADetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/payments-a">
        {() => <AdminGate><AdminV2PaymentAList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tickets-a/:id">
        {() => <AdminGate><AdminV2TicketADetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tickets-a">
        {() => <AdminGate><AdminV2TicketAList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/outsource-demands/new">
        {() => <AdminGate><AdminV2OutsourceDemandNew /></AdminGate>}
      </Route>
      <Route path="/admin/v2/outsource-demands/:id">
        {() => <AdminGate><AdminV2OutsourceDemandDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/outsource-demands">
        {() => <AdminGate><AdminV2OutsourceDemandList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tenders/:id">
        {() => <AdminGate><AdminV2TenderDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tenders">
        {() => <AdminGate><AdminV2TenderList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/outsource-orders/:id">
        {() => <AdminGate><AdminV2OutsourceOrderDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/outsource-orders">
        {() => <AdminGate><AdminV2OutsourceOrderList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/payments-b/:id">
        {() => <AdminGate><AdminV2PaymentBDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/payments-b">
        {() => <AdminGate><AdminV2PaymentBList /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tickets-b/:id">
        {() => <AdminGate><AdminV2TicketBDetail /></AdminGate>}
      </Route>
      <Route path="/admin/v2/tickets-b">
        {() => <AdminGate><AdminV2TicketBList /></AdminGate>}
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
      <Route path="/pub/tickets/:id">
        {() => <PublisherGate><PubTicketDetail /></PublisherGate>}
      </Route>
      <Route path="/pub/tickets">
        {() => <PublisherGate><PubTicketList /></PublisherGate>}
      </Route>
      <Route path="/pub">
        {() => <PublisherGate><PubDemandList /></PublisherGate>}
      </Route>

      {/* 社区 & 学习资源：游客也可访问 */}
      <Route path="/community" component={Community} />
      <Route path="/academy">{() => <Layout><Academy /></Layout>}</Route>
      <Route path="/academy/course/:id">{() => <Layout><AcademyDetail /></Layout>}</Route>

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
      <Route path="/opc/tickets/:id">
        {() => <OpcGate><OpcV2TicketDetail /></OpcGate>}
      </Route>
      <Route path="/opc/tickets">
        {() => <OpcGate><OpcV2TicketList /></OpcGate>}
      </Route>

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
                <Route path="/my-bids" component={OpcMyBids} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
