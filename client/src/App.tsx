import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CoordinatorCall from "@/pages/coordinator-call";
import CoordinatorCallTest from "@/pages/coordinator-call-test";
import CoordinatorCallDebug from "@/pages/coordinator-call-debug";
import CoordinatorCallFixed from "@/pages/coordinator-call-fixed";
import InspectorCallFixed from "@/pages/inspector-call-fixed";
import InspectorCall from "@/pages/inspector-call";
import InspectorThankYou from "@/pages/inspector-thank-you";
import MobileDiagnostics from "@/pages/mobile-diagnostics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <ErrorBoundary fallback={<div className="p-4 text-red-600">Coordinator Call Error - Check console</div>}>
        <Route path="/coordinator/:callId" component={CoordinatorCallFixed} />
      </ErrorBoundary>
      <ErrorBoundary fallback={<div className="p-4 text-red-600">Inspector Call Error - Check console</div>}>
        <Route path="/inspector/:callId" component={InspectorCallFixed} />
        <Route path="/join/:callId" component={InspectorCallFixed} />
      </ErrorBoundary>
      <Route path="/inspector-thank-you" component={InspectorThankYou} />
      <Route path="/mobile-diagnostics" component={MobileDiagnostics} />
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
