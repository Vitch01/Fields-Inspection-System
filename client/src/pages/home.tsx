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

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loginType, setLoginType] = useState<'coordinator' | 'inspector' | null>(null);


  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        username,
        password: password || undefined, // Send undefined for coordinators with no password
      });
      const data = await response.json();
      
      // Store JWT token in localStorage for authenticated requests
      if (data.token) {
        localStorage.setItem("authToken", data.token);
      }
      
      setUser(data.user);
      toast({
        title: "Logged in successfully",
        description: `Welcome, ${data.user.name}`,
      });
      
      // Auto-navigate to appropriate dashboard
      if (data.user.role === 'coordinator') {
        setLocation("/coordinator/dashboard");
      }
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

  const handleCoordinatorLogin = () => {
    setLoginType('coordinator');
    setUsername(''); // Clear any existing input
    setPassword(''); // Clear any existing input
  };

  const handleInspectorLogin = () => {
    setLoginType('inspector');
    setUsername('');
    setPassword('');
  };

  const handleBackToHome = () => {
    setLoginType(null);
    setUsername('');
    setPassword('');
  };



  // Show login form if a type is selected
  if (loginType === 'coordinator' || loginType === 'inspector') {
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
              {loginType === 'coordinator' ? 'Coordinator Login' : 'Inspector Login Required'}
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
            {loginType === 'inspector' && (
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
            )}
            {loginType === 'coordinator' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-black">Password (Optional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for default auth"
                  data-testid="input-password"
                  className="bg-white text-black border-gray-300"
                />
              </div>
            )}
            <div className="space-y-2">
              <Button 
                onClick={handleLogin} 
                className="w-full bg-black text-white hover:bg-gray-800 border border-black" 
                disabled={isLoading || !username || (loginType === 'inspector' && !password)}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <Button 
                onClick={handleBackToHome} 
                variant="outline" 
                className="w-full text-black border-black hover:bg-gray-100" 
                data-testid="button-back"
              >
                Back to Home
              </Button>
            </div>
            
            <div className="pt-4 border-t border-gray-300 space-y-2">
              <p className="text-sm text-gray-600 text-center">Demo account:</p>
              <div className="text-center text-xs">
                {loginType === 'coordinator' ? (
                  <>
                    <Badge variant="outline" className="text-black border-black">coordinator</Badge>
                    <p className="text-gray-600">Coordinator (no password required)</p>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="text-black border-black">inspector1</Badge>
                    <p className="text-gray-600">Inspector</p>
                  </>
                )}
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
                <Users className="w-5 h-5 text-black" />
                <span>Coordinator Dashboard</span>
              </CardTitle>
              <p className="text-gray-600 text-sm">Manage inspection requests and assign to field teams</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700 text-sm">Review and assign incoming requests</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700 text-sm">Track inspection progress and status</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700 text-sm">Start video calls with field inspectors</span>
                </div>
              </div>
              <Button 
                onClick={handleCoordinatorLogin} 
                className="w-full bg-black text-white hover:bg-gray-800 border border-black" 
                data-testid="button-coordinator-login"
              >
                Coordinator Login
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
