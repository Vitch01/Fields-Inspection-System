import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConnectionDiagnostics from "@/components/connection-diagnostics";
import TroubleshootingGuide from "@/components/troubleshooting-guide";
import { ArrowLeft, Activity, HelpCircle, RefreshCw } from "lucide-react";

export default function Diagnostics() {
  const [, setLocation] = useLocation();
  const [mockConnectionState, setMockConnectionState] = useState<'connected' | 'connecting' | 'disconnected' | 'failed'>('connected');
  const [refreshKey, setRefreshKey] = useState(0);

  // Mock connection stats for demonstration
  const mockConnectionStats = {
    attempts: 1,
    consecutiveFailures: 0,
    lastConnected: new Date(),
    lastError: undefined
  };

  // Mock network quality for demonstration
  const mockNetworkQuality = {
    level: 'good' as const,
    bars: 3,
    rtt: 45,
    packetLoss: 0.1,
    bitrate: 2500
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    // Simulate connection state changes for demo
    const states = ['connected', 'connecting', 'disconnected', 'failed'] as const;
    const randomState = states[Math.floor(Math.random() * states.length)];
    setMockConnectionState(randomState);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-diagnostics-title">
            Connection Diagnostics
          </h1>
          <p className="text-muted-foreground mt-1">
            Test your device and network connection for optimal video call performance
          </p>
        </div>
        <div className="ml-auto">
          <Button 
            variant="outline"
            onClick={handleRefresh}
            data-testid="button-refresh-diagnostics"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Tests
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card data-testid="card-device-info">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Device Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Browser:</span>
                <Badge variant="outline" className="text-xs">
                  {navigator.userAgent.includes('Chrome') ? 'Chrome' :
                   navigator.userAgent.includes('Firefox') ? 'Firefox' :
                   navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Device:</span>
                <Badge variant="outline" className="text-xs">
                  {/Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">WebRTC:</span>
                <Badge variant={window.RTCPeerConnection ? "default" : "destructive"} className="text-xs">
                  {window.RTCPeerConnection ? 'Supported' : 'Not Supported'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-connection-status">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                mockConnectionState === 'connected' ? 'bg-green-500' :
                mockConnectionState === 'connecting' ? 'bg-yellow-500' :
                mockConnectionState === 'failed' ? 'bg-red-500' :
                'bg-gray-500'
              }`}></div>
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge 
                variant={mockConnectionState === 'connected' ? "default" : "destructive"}
                className="w-full justify-center"
              >
                {mockConnectionState === 'connected' ? 'Connected' :
                 mockConnectionState === 'connecting' ? 'Connecting...' :
                 mockConnectionState === 'failed' ? 'Connection Failed' :
                 'Disconnected'}
              </Badge>
              <div className="text-xs text-muted-foreground text-center">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-quick-actions">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.location.reload()}
                data-testid="button-reload-page"
              >
                Reload Page
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => navigator.mediaDevices?.getUserMedia({ video: true, audio: true })}
                data-testid="button-test-permissions"
              >
                Test Permissions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Diagnostic Content */}
      <Tabs defaultValue="diagnostics" className="w-full">
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-diagnostic-content">
          <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">
            <Activity className="w-4 h-4 mr-2" />
            Diagnostics
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" data-testid="tab-troubleshooting">
            <HelpCircle className="w-4 h-4 mr-2" />
            Troubleshooting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Diagnostics</CardTitle>
              <CardDescription>
                Comprehensive testing of your device and network connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionDiagnostics
                key={refreshKey}
                connectionState={mockConnectionState}
                connectionStats={mockConnectionStats}
                networkQuality={mockNetworkQuality}
                showFullDiagnostics={true}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting Guide</CardTitle>
              <CardDescription>
                Step-by-step solutions for common connection issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TroubleshootingGuide
                currentIssue={mockConnectionState === 'failed' ? 'websocket' : null}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="my-8" />

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>About This Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              This diagnostic tool helps identify and resolve connection issues that may occur
              during video calls between coordinators and field inspectors.
            </p>
            <p>
              Use this page to test your device capabilities, check network connectivity,
              and get troubleshooting guidance specific to your browser and device type.
            </p>
            <p>
              If you continue to experience issues after following the troubleshooting steps,
              consider trying a different browser or device, or contact technical support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}