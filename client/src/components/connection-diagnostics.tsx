import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Monitor, 
  Smartphone,
  Clock,
  Signal,
  Camera,
  Mic,
  Globe,
  ChevronDown,
  ChevronRight,
  Activity,
  Info
} from "lucide-react";
import {
  NetworkDiagnosticResult,
  BrowserCapabilities,
  DeviceInfo,
  PermissionStatus,
  runFullDiagnostics,
  getBrowserCapabilities,
  getDeviceInfo,
  checkPermissions,
  getTroubleshootingRecommendations
} from "@/lib/diagnostic-utils";
import type { ConnectionState, ConnectionError } from "@/hooks/use-websocket";

interface ConnectionDiagnosticsProps {
  connectionState?: ConnectionState;
  connectionStats?: {
    attempts: number;
    consecutiveFailures: number;
    lastConnected?: Date;
    lastError?: {
      type: ConnectionError;
      message: string;
      timestamp: Date;
    };
  };
  networkQuality?: {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
    bars: number;
    rtt?: number;
    packetLoss?: number;
    bitrate?: number;
  };
  onRefresh?: () => void;
  showFullDiagnostics?: boolean;
  className?: string;
}

export default function ConnectionDiagnostics({
  connectionState = 'disconnected',
  connectionStats,
  networkQuality,
  onRefresh,
  showFullDiagnostics = false,
  className = ""
}: ConnectionDiagnosticsProps) {
  const [diagnosticResults, setDiagnosticResults] = useState<NetworkDiagnosticResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);

  // Initialize device info and capabilities
  useEffect(() => {
    setBrowserCapabilities(getBrowserCapabilities());
    setDeviceInfo(getDeviceInfo());
    checkPermissions().then(setPermissions);
  }, []);

  const runDiagnostics = useCallback(async () => {
    setIsRunningTests(true);
    try {
      const results = await runFullDiagnostics();
      setDiagnosticResults(results);
      setLastTestTime(new Date());
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setIsRunningTests(false);
    }
  }, []);

  // Run initial diagnostics if showing full diagnostics
  useEffect(() => {
    if (showFullDiagnostics && diagnosticResults.length === 0) {
      runDiagnostics();
    }
  }, [showFullDiagnostics, runDiagnostics, diagnosticResults.length]);

  const getConnectionIcon = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return <Wifi className="w-4 h-4 text-green-600" />;
      case 'connecting':
      case 'reconnecting': return <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />;
      case 'failed':
      case 'maximum-retries-exceeded': return <WifiOff className="w-4 h-4 text-red-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getConnectionStatusColor = (state: ConnectionState) => {
    switch (state) {
      case 'connected': return 'bg-green-100 border-green-200 text-green-800';
      case 'connecting':
      case 'reconnecting': return 'bg-yellow-100 border-yellow-200 text-yellow-800';
      case 'failed':
      case 'maximum-retries-exceeded': return 'bg-red-100 border-red-200 text-red-800';
      default: return 'bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning' | 'running') => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'fail': return <WifiOff className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'running': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
    }
  };

  const getNetworkQualityBars = (level: string, bars: number) => {
    const maxBars = 4;
    return (
      <div className="flex items-center space-x-1">
        {Array.from({ length: maxBars }, (_, i) => (
          <div
            key={i}
            className={`w-1 h-3 rounded ${
              i < bars 
                ? level === 'excellent' ? 'bg-green-500' :
                  level === 'good' ? 'bg-blue-500' :
                  level === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      timeStyle: 'medium'
    }).format(date);
  };

  const failedTests = diagnosticResults.filter(r => r.status === 'fail' || r.status === 'warning');
  const recommendations = failedTests.length > 0 ? getTroubleshootingRecommendations(diagnosticResults) : [];

  return (
    <Card className={`${className}`} data-testid="connection-diagnostics">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Connection Diagnostics</span>
          </span>
          {onRefresh && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onRefresh}
              data-testid="button-refresh-connection"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Connection Status */}
        <div className={`flex items-center justify-between p-3 rounded-md border ${getConnectionStatusColor(connectionState)}`} data-testid="current-connection-status">
          <div className="flex items-center space-x-2">
            {getConnectionIcon(connectionState)}
            <span className="font-medium">
              {connectionState === 'connected' ? 'Connected' :
               connectionState === 'connecting' ? 'Connecting...' :
               connectionState === 'reconnecting' ? 'Reconnecting...' :
               connectionState === 'failed' ? 'Connection Failed' :
               connectionState === 'maximum-retries-exceeded' ? 'Connection Failed (Max Retries)' :
               'Disconnected'}
            </span>
          </div>
          {connectionStats && connectionState !== 'connected' && (
            <Badge variant="secondary" data-testid="connection-attempts">
              Attempts: {connectionStats.attempts}
            </Badge>
          )}
        </div>

        {/* Network Quality Indicator */}
        {networkQuality && (
          <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-gray-200" data-testid="network-quality">
            <div className="flex items-center space-x-2">
              <Signal className="w-4 h-4 text-gray-600" />
              <span className="font-medium">Network Quality: {networkQuality.level}</span>
            </div>
            <div className="flex items-center space-x-2">
              {getNetworkQualityBars(networkQuality.level, networkQuality.bars)}
              {networkQuality.rtt && (
                <Badge variant="outline" className="text-xs">
                  {networkQuality.rtt}ms
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Connection Statistics */}
        {connectionStats && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center w-full justify-between p-2 hover:bg-gray-50 rounded" data-testid="toggle-connection-stats">
              <span className="flex items-center space-x-2">
                <Info className="w-4 h-4" />
                <span className="text-sm font-medium">Connection Statistics</span>
              </span>
              {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2" data-testid="connection-stats-details">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Attempts:</span>
                  <Badge variant="outline">{connectionStats.attempts}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Failures:</span>
                  <Badge variant="outline">{connectionStats.consecutiveFailures}</Badge>
                </div>
                {connectionStats.lastConnected && (
                  <div className="flex items-center space-x-2 col-span-2">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-gray-600">Last connected:</span>
                    <span className="text-xs">{formatTime(connectionStats.lastConnected)}</span>
                  </div>
                )}
                {connectionStats.lastError && (
                  <div className="col-span-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <div className="font-medium text-red-800">Last Error:</div>
                    <div className="text-red-700">{connectionStats.lastError.message}</div>
                    <div className="text-red-600 text-xs mt-1">
                      {formatTime(connectionStats.lastError.timestamp)}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Device and Browser Info */}
        {deviceInfo && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center w-full justify-between p-2 hover:bg-gray-50 rounded" data-testid="toggle-device-info">
              <span className="flex items-center space-x-2">
                {deviceInfo.isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="text-sm font-medium">Device Information</span>
              </span>
              {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2" data-testid="device-info-details">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Device:</span>
                  <span>{deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Browser:</span>
                  <span>{deviceInfo.browserName} {deviceInfo.browserVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform:</span>
                  <span>{deviceInfo.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Screen:</span>
                  <span>{deviceInfo.screenResolution}</span>
                </div>
                {deviceInfo.connectionType !== 'unknown' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection:</span>
                    <span>{deviceInfo.effectiveType}</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Full Diagnostics Section */}
        {showFullDiagnostics && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Network Tests</h4>
                <Button 
                  size="sm" 
                  onClick={runDiagnostics} 
                  disabled={isRunningTests}
                  data-testid="button-run-diagnostics"
                >
                  {isRunningTests ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Run Tests
                    </>
                  )}
                </Button>
              </div>

              {lastTestTime && (
                <div className="text-xs text-gray-600 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Last tested: {formatTime(lastTestTime)}</span>
                </div>
              )}

              {/* Test Results */}
              <div className="space-y-2" data-testid="diagnostic-results">
                {diagnosticResults.map((result, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 border rounded">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{result.test}</div>
                      <div className="text-xs text-gray-600">{result.message}</div>
                      {result.duration && (
                        <div className="text-xs text-gray-500 mt-1">
                          Duration: {result.duration}ms
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Troubleshooting Recommendations */}
              {recommendations.length > 0 && (
                <div className="space-y-2" data-testid="troubleshooting-recommendations">
                  <h5 className="font-medium text-sm">Recommendations:</h5>
                  <div className="space-y-1">
                    {recommendations.map((recommendation, index) => (
                      <div key={index} className="text-xs text-gray-700 flex items-start space-x-1">
                        <span className="text-gray-400 mt-1">•</span>
                        <span>{recommendation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Permissions Status */}
        {permissions && (
          <div className="space-y-2">
            <h5 className="font-medium text-sm">Permissions</h5>
            <div className="grid grid-cols-1 gap-2" data-testid="permissions-status">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-gray-600" />
                  <span className="text-sm">Camera</span>
                </div>
                <Badge 
                  variant={permissions.camera === 'granted' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {permissions.camera}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Mic className="w-4 h-4 text-gray-600" />
                  <span className="text-sm">Microphone</span>
                </div>
                <Badge 
                  variant={permissions.microphone === 'granted' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {permissions.microphone}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}