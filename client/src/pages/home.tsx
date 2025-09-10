import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Video, Users, Shield, Clock } from "lucide-react";
import logoImage from "@assets/1767 copy_1757516319425.png";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Login state (skip login for coordinators)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>({
    id: "coordinator-default",
    username: "coordinator",
    role: "coordinator",
    name: "Site Coordinator"
  });

  // Call creation state
  const [inspectorId, setInspectorId] = useState("");
  const [inspectionReference, setInspectionReference] = useState("");

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        username,
        password,
      });
      const data = await response.json();
      setUser(data.user);
      toast({
        title: "Logged in successfully",
        description: `Welcome, ${data.user.name}`,
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCall = async () => {    
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/calls", {
        coordinatorId: user.id,
        inspectorId: inspectorId || "inspector1-id", // For demo purposes
        status: "pending",
        inspectionReference,
      });
      const call = await response.json();
      
      toast({
        title: "Call created",
        description: "Starting video call...",
      });
      
      setLocation(`/coordinator/${call.id}`);
    } catch (error) {
      toast({
        title: "Failed to start call",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  // Show inspector login if needed
  const showInspectorLogin = user.role !== "coordinator" && !user.id;

  if (showInspectorLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl" data-testid="title-login">Field Inspection System</CardTitle>
            <p className="text-muted-foreground">
              Inspector Login Required
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                data-testid="input-password"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full" 
              disabled={isLoading || !username || !password}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm text-muted-foreground text-center">Demo account:</p>
              <div className="text-center text-xs">
                <Badge variant="outline">inspector1</Badge>
                <p className="text-muted-foreground">Inspector</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <img src={logoImage} alt="Company Logo" className="w-8 h-8" />
            <h1 className="text-xl font-semibold" data-testid="title-dashboard">Field Inspection Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant={user.role === "coordinator" ? "default" : "secondary"}>
              {user.role === "coordinator" ? <Shield className="w-3 h-3 mr-1" /> : <Users className="w-3 h-3 mr-1" />}
              {user.name}
            </Badge>
            {user.role === "inspector" && (
              <Button variant="outline" onClick={() => setUser(null)} data-testid="button-logout">
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 gap-6">
          {user.role === "coordinator" && (
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Video className="w-5 h-5" />
                  <span>Start New Inspection</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inspector">Inspector</Label>
                  <Select value={inspectorId} onValueChange={setInspectorId}>
                    <SelectTrigger data-testid="select-inspector">
                      <SelectValue placeholder="Select inspector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inspector1-id">John Martinez</SelectItem>
                      <SelectItem value="inspector2-id">Maria Garcia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Inspection Reference Number</Label>
                  <Input
                    id="reference"
                    value={inspectionReference}
                    onChange={(e) => setInspectionReference(e.target.value)}
                    placeholder="INS-2024-001"
                    data-testid="input-reference"
                  />
                </div>
                <Button 
                  onClick={handleStartCall} 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-start-call"
                >
                  {isLoading ? "Starting..." : "Start Inspection Call"}
                </Button>
              </CardContent>
            </Card>
          )}


        </div>
      </main>
    </div>
  );
}
