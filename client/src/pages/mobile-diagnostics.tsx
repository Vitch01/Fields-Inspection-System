import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Wifi, 
  Signal, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Smartphone, 
  Monitor, 
  Tablet,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

interface DiagnosticResult {
  test: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message: string;
  duration?: number;
  details?: any;
}

interface ServerDiagnostics {
  timestamp: string;
  server: {
    healthy: boolean;
    port: string;
    environment: string;
  };
  client: {
    ip: string;
    userAgent: string;
    browserInfo: {
      isMobile: boolean;
      isTablet: boolean;
      isDesktop: boolean;
      browser: string;
    };
  };
  websocket: {
    serverRunning: boolean;
    activeConnections: number;
    path: string;
    url: string;
  };
}

export default function MobileDiagnostics() {
  const [serverDiagnostics, setServerDiagnostics] = useState<ServerDiagnostics | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Get network information
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    setNetworkInfo({
      type: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 'unknown',
      rtt: connection?.rtt || 'unknown',
      saveData: connection?.saveData || false
    });
  }, []);

  const updateResult = (testName: string, status: DiagnosticResult['status'], message: string, duration?: number, details?: any) => {
    setDiagnosticResults(prev => {
      const newResults = [...prev];
      const existingIndex = newResults.findIndex(r => r.test === testName);
      const result = { test: testName, status, message, duration, details };
      
      if (existingIndex >= 0) {
        newResults[existingIndex] = result;
      } else {
        newResults.push(result);
      }
      return newResults;
    });
  };

  const runServerHealthTest = async () => {
    updateResult('Server Health', 'running', 'Checking server connectivity...');
    const start = Date.now();
    
    try {
      const response = await fetch('/api/mobile-diagnostics');
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        setServerDiagnostics(data);
        updateResult('Server Health', 'success', `Server is healthy (${duration}ms)`, duration, data);
      } else {
        updateResult('Server Health', 'error', `Server returned ${response.status}: ${response.statusText}`, duration);
      }
    } catch (error: any) {
      const duration = Date.now() - start;
      updateResult('Server Health', 'error', `Failed to reach server: ${error.message}`, duration);
    }
  };

  const runWebSocketTest = async () => {
    updateResult('WebSocket Connection', 'running', 'Testing WebSocket connectivity...');
    const start = Date.now();
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        const duration = Date.now() - start;
        updateResult('WebSocket Connection', 'error', `Connection timeout after ${duration}ms`, duration);
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        const duration = Date.now() - start;
        
        // Send a test message
        ws.send(JSON.stringify({
          type: 'join-call',
          callId: 'diagnostic-test',
          userId: 'diagnostic-user'
        }));
        
        setTimeout(() => {
          ws.close();
          updateResult('WebSocket Connection', 'success', `WebSocket connected successfully (${duration}ms)`, duration, {
            url: wsUrl,
            readyState: ws.readyState
          });
          
          // Report test results to server
          fetch('/api/mobile-diagnostics/websocket-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: true,
              duration,
              networkInfo
            })
          }).catch(console.error);
          
        }, 1000);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - start;
        updateResult('WebSocket Connection', 'error', `WebSocket error: ${error.toString()}`, duration, {
          url: wsUrl,
          error: error.toString()
        });
        
        fetch('/api/mobile-diagnostics/websocket-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: error.toString(),
            duration,
            networkInfo
          })
        }).catch(console.error);
      };

      ws.onclose = (event) => {
        if (!timeout) return; // Already handled
        clearTimeout(timeout);
        const duration = Date.now() - start;
        
        if (event.code !== 1000) {
          updateResult('WebSocket Connection', 'error', `WebSocket closed unexpectedly: ${event.code} - ${event.reason}`, duration, {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
        }
      };

    } catch (error: any) {
      const duration = Date.now() - start;
      updateResult('WebSocket Connection', 'error', `Failed to create WebSocket: ${error.message}`, duration);
    }
  };

  const runNetworkLatencyTest = async () => {
    updateResult('Network Latency', 'running', 'Testing network performance...');
    const start = Date.now();
    
    try {
      const response = await fetch('/api/mobile-diagnostics', { cache: 'no-store' });
      const duration = Date.now() - start;
      
      if (response.ok) {
        let quality = 'excellent';
        if (duration > 1000) quality = 'poor';
        else if (duration > 500) quality = 'fair';
        else if (duration > 200) quality = 'good';
        
        updateResult('Network Latency', 'success', `Latency: ${duration}ms (${quality})`, duration, {
          quality,
          threshold: duration > 1000 ? 'warning' : 'ok'
        });
      } else {
        updateResult('Network Latency', 'error', `HTTP ${response.status}`, duration);
      }
    } catch (error: any) {
      const duration = Date.now() - start;
      updateResult('Network Latency', 'error', `Network error: ${error.message}`, duration);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setDiagnosticResults([]);
    
    await runServerHealthTest();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runNetworkLatencyTest();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runWebSocketTest();
    
    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getDeviceIcon = () => {
    if (!serverDiagnostics) return <Monitor className="w-6 h-6" />;
    
    const { browserInfo } = serverDiagnostics.client;
    if (browserInfo.isMobile) return <Smartphone className="w-6 h-6 text-blue-500" />;
    if (browserInfo.isTablet) return <Tablet className="w-6 h-6 text-green-500" />;
    return <Monitor className="w-6 h-6 text-gray-500" />;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Mobile Connectivity Diagnostics</h1>
          <p className="text-muted-foreground">
            Comprehensive testing for mobile video call connectivity
          </p>
        </div>

        {/* Device and Network Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getDeviceIcon()}
                <span>Device Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {serverDiagnostics ? (
                <>
                  <div className="flex justify-between">
                    <span>Device Type:</span>
                    <Badge variant={serverDiagnostics.client.browserInfo.isMobile ? "default" : "secondary"}>
                      {serverDiagnostics.client.browserInfo.isMobile ? "Mobile" : 
                       serverDiagnostics.client.browserInfo.isTablet ? "Tablet" : "Desktop"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Browser:</span>
                    <span>{serverDiagnostics.client.browserInfo.browser}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className="font-mono text-sm">{serverDiagnostics.client.ip}</span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Run diagnostics to see device info</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Signal className="w-6 h-6" />
                <span>Network Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {networkInfo ? (
                <>
                  <div className="flex justify-between">
                    <span>Connection Type:</span>
                    <Badge variant={networkInfo.type === 'cellular' ? "destructive" : "default"}>
                      {networkInfo.type || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective Type:</span>
                    <span>{networkInfo.effectiveType || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Downlink:</span>
                    <span>{networkInfo.downlink !== 'unknown' ? `${networkInfo.downlink} Mbps` : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RTT:</span>
                    <span>{networkInfo.rtt !== 'unknown' ? `${networkInfo.rtt}ms` : 'Unknown'}</span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Network API not available</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Connectivity Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="w-full"
              data-testid="button-run-diagnostics"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Run All Diagnostics
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {diagnosticResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {diagnosticResults.map((result, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{result.test}</h4>
                      {result.duration && (
                        <Badge variant="outline" className="text-xs">
                          {result.duration}ms
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    {result.details && result.status === 'error' && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Server Status */}
        {serverDiagnostics && (
          <Card>
            <CardHeader>
              <CardTitle>Server Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Server Health:</span>
                <Badge variant={serverDiagnostics.server.healthy ? "default" : "destructive"}>
                  {serverDiagnostics.server.healthy ? "Healthy" : "Unhealthy"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>WebSocket Server:</span>
                <Badge variant={serverDiagnostics.websocket.serverRunning ? "default" : "destructive"}>
                  {serverDiagnostics.websocket.serverRunning ? "Running" : "Not Running"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Active Connections:</span>
                <span>{serverDiagnostics.websocket.activeConnections}</span>
              </div>
              <div className="flex justify-between">
                <span>WebSocket URL:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {serverDiagnostics.websocket.url}
                </code>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}