import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CoordinatorCall from "@/pages/coordinator-call";
import TestSimpleCall from "@/pages/test-simple-call";
import CoordinatorDashboard from "@/pages/coordinator-dashboard";
import PackageDelivery from "@/pages/package-delivery";
import CoordinatorPackageDetails from "@/pages/coordinator-package-details";
import InspectorCall from "@/pages/inspector-call";
import InspectorThankYou from "@/pages/inspector-thank-you";
import ClientLogin from "@/pages/client-login";
import ClientDashboard from "@/pages/client-dashboard";
import SubmitRequest from "@/pages/submit-request";
import ReportGenerator from "@/pages/report-generator";

function Router() {
  console.log('🚨 ROUTER RENDERING - Current pathname:', window.location.pathname);
  
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/coordinator/dashboard" component={CoordinatorDashboard} />
      <Route path="/coordinator/call/:callId" component={() => {
        console.log('🔵 COORDINATOR CALL ROUTE MATCHED! URL:', window.location.pathname);
        console.log('🔵 Route params available:', { callId: window.location.pathname.split('/').pop() });
        console.log('🔵 About to render CoordinatorCall component...');
        return <CoordinatorCall />;
      }} />
      <Route path="/test-call/:callId" component={() => {
        console.log('🔥 TEST CALL ROUTE MATCHED! URL:', window.location.pathname);
        return <TestSimpleCall />;
      }} />
      <Route path="/coordinator/packages/prepare/:id" component={PackageDelivery} />
      <Route path="/coordinator/packages/:id" component={CoordinatorPackageDetails} />
      <Route path="/inspector/:callId" component={InspectorCall} />
      <Route path="/join/:callId" component={InspectorCall} />
      <Route path="/inspector-thank-you" component={InspectorThankYou} />
      <Route path="/client/login" component={ClientLogin} />
      <Route path="/client/dashboard" component={ClientDashboard} />
      <Route path="/client/submit-request" component={SubmitRequest} />
      {/* Report Generation Routes */}
      <Route path="/reports/generate/:inspectionRequestId/:callId?" component={ReportGenerator} />
      <Route path="/reports/generate/:inspectionRequestId" component={ReportGenerator} />
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
