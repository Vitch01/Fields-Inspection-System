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
import { Video, Users, Shield, Clock, Building } from "lucide-react";
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
  const [inspectionReference, setInspectionReference] = useState("INS-2024-001");

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
      <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white border border-white">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-black" data-testid="title-login">Field Inspection System</CardTitle>
            <p className="text-gray-600">
              Inspector Login Required
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-black">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                data-testid="input-username"
                className="bg-white text-black border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                data-testid="input-password"
                className="bg-white text-black border-gray-300"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full bg-black text-white hover:bg-gray-800 border border-black" 
              disabled={isLoading || !username || !password}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            
            <div className="pt-4 border-t border-gray-300 space-y-2">
              <p className="text-sm text-gray-600 text-center">Demo account:</p>
              <div className="text-center text-xs">
                <Badge variant="outline" className="text-black border-black">inspector1</Badge>
                <p className="text-gray-600">Inspector</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoImage} 
            alt="Company Logo" 
            className="h-20 w-auto"
          />
        </div>

        {/* User Type Selection */}
        <div className="space-y-4">
          {/* Coordinator Card */}
          <Card className="bg-white border border-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-black">
                <Video className="w-5 h-5 text-black" />
                <span>Coordinator - Start New Inspection</span>
              </CardTitle>
              <p className="text-gray-600 text-sm">Start a video inspection call with an inspector</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inspector" className="text-black">Inspector</Label>
                <Select value={inspectorId} onValueChange={setInspectorId}>
                  <SelectTrigger 
                    data-testid="select-inspector"
                    className="bg-white text-black border-black focus:ring-black focus:border-black"
                  >
                    <SelectValue placeholder="Select inspector" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-black">
                    <SelectItem value="inspector1-id" className="text-black hover:bg-gray-100 focus:bg-gray-100">John Martinez</SelectItem>
                    <SelectItem value="inspector2-id" className="text-black hover:bg-gray-100 focus:bg-gray-100">Maria Garcia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference" className="text-black">Inspection Reference Number</Label>
                <Input
                  id="reference"
                  value={inspectionReference}
                  onChange={(e) => setInspectionReference(e.target.value)}
                  placeholder="INS-2024-001"
                  data-testid="input-reference"
                  className="bg-white text-black border-gray-300"
                />
              </div>
              <Button 
                onClick={handleStartCall} 
                className="w-full bg-black text-white hover:bg-gray-800 border border-black" 
                disabled={isLoading || !inspectorId || !inspectionReference}
                data-testid="button-start-call"
              >
                {isLoading ? "Starting..." : "Start Inspection Call"}
              </Button>
            </CardContent>
          </Card>

          {/* Client Portal Card */}
          <Card className="bg-white border border-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-black">
                <Building className="w-5 h-5 text-black" />
                <span>Client Portal - Request Inspection</span>
              </CardTitle>
              <p className="text-gray-600 text-sm">Submit inspection requests for your assets</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 text-sm">
                Access the client portal to submit inspection requests, track progress, and view completed reports for your properties and assets.
              </p>
              <Button 
                onClick={() => setLocation("/client/login")} 
                className="w-full bg-black text-white hover:bg-gray-800 border border-black" 
                data-testid="button-client-portal"
              >
                Access Client Portal
              </Button>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-black mt-4">
            IFS Video Inspection System
          </div>
        </div>
      </main>
    </div>
  );
}
