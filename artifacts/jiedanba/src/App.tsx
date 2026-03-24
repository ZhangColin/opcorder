import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import PublisherHome from "@/pages/PublisherHome";
import PublisherDemandDetail from "@/pages/PublisherDemandDetail";
import DemandHall from "@/pages/DemandHall";
import DemandDetail from "@/pages/DemandDetail";
import CreateDemand from "@/pages/CreateDemand";
import MyOrders from "@/pages/MyOrders";
import OrderDetail from "@/pages/OrderDetail";
import OrderHall from "@/pages/OrderHall";
import Profile from "@/pages/Profile";
import Academy from "@/pages/Academy";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

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
      <Route path="/publisher" component={PublisherHome} />
      <Route path="/publisher/demand/:id" component={PublisherDemandDetail} />

      {/* OPC routes — role-gated, wrapped in Layout */}
      <Route>
        {() => (
          <RoleGate>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/demands" component={DemandHall} />
                <Route path="/demands/:id" component={DemandDetail} />
                <Route path="/create-demand" component={CreateDemand} />
                <Route path="/order-hall" component={OrderHall} />
                <Route path="/orders" component={MyOrders} />
                <Route path="/orders/:id" component={OrderDetail} />
                <Route path="/profile" component={Profile} />
                <Route path="/academy" component={Academy} />
                <Route path="/notifications" component={Notifications} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </RoleGate>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
