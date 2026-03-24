import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/Home";
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

function Router() {
  return (
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
