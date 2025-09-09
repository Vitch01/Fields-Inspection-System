import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CoordinatorCall from "@/pages/coordinator-call";
import InspectorCall from "@/pages/inspector-call";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/coordinator/:callId" component={CoordinatorCall} />
      <Route path="/inspector/:callId" component={InspectorCall} />
      <Route path="/join/:callId" component={InspectorCall} />
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
