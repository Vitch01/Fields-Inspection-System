import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CoordinatorCall from "@/pages/coordinator-call";
import CoordinatorDashboard from "@/pages/coordinator-dashboard";
import InspectorCall from "@/pages/inspector-call";
import InspectorThankYou from "@/pages/inspector-thank-you";
import ClientLogin from "@/pages/client-login";
import ClientDashboard from "@/pages/client-dashboard";
import SubmitRequest from "@/pages/submit-request";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/coordinator/dashboard" component={CoordinatorDashboard} />
      <Route path="/coordinator/:callId" component={CoordinatorCall} />
      <Route path="/inspector/:callId" component={InspectorCall} />
      <Route path="/join/:callId" component={InspectorCall} />
      <Route path="/inspector-thank-you" component={InspectorThankYou} />
      <Route path="/client/login" component={ClientLogin} />
      <Route path="/client/dashboard" component={ClientDashboard} />
      <Route path="/client/submit-request" component={SubmitRequest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
