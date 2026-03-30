import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useEffect } from "react";
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

/* Send stored user ID as Bearer token with every API request */
setAuthTokenGetter(() => localStorage.getItem("jdb_user_id"));

function RoleGate({ children }: { children: React.ReactNode }) {
  const role = localStorage.getItem("jdb_role");
  const [, navigate] = useLocation();

  if (!role) {
    navigate("/login");
    return null;
  }
  if (role === "publisher") {
    navigate("/publisher");
    return null;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Standalone routes — no Layout */}
      <Route path="/login" component={Login} />
      <Route path="/auth/:role" component={Auth} />
      <Route path="/admin" component={Admin} />
      <Route path="/publisher" component={PublisherHome} />
      <Route path="/publisher/demands" component={PublisherDemandList} />
      <Route path="/publisher/demands/new" component={PublisherCreateDemand} />
      <Route path="/publisher/demands/:id/edit" component={PublisherCreateDemand} />
      <Route path="/publisher/demand/:id" component={PublisherDemandDetail} />
      <Route path="/publisher/orders" component={PublisherOrderList} />
      <Route path="/publisher/orders/:id" component={PublisherOrderDetail} />
      <Route path="/publisher/opc-library" component={PublisherOpcLibrary} />
      <Route path="/publisher/notifications" component={PublisherNotifications} />
      <Route path="/publisher/finance" component={PublisherFinance} />
      <Route path="/publisher/profile" component={PublisherProfile} />
      <Route path="/community" component={Community} />

      {/* OPC routes — role-gated, wrapped in Layout */}
      <Route>
        {() => (
          <RoleGate>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/demands/:id" component={DemandDetail} />
                <Route path="/order-hall" component={OrderHall} />
                <Route path="/orders" component={MyOrders} />
                <Route path="/orders/:id" component={OrderDetail} />
                <Route path="/profile" component={Profile} />
                <Route path="/portfolios" component={Portfolios} />
                <Route path="/academy" component={Academy} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/income" component={OpcIncome} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </RoleGate>
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
