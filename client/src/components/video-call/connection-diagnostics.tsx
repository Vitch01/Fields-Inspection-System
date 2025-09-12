import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Smartphone, WifiOff, Signal, AlertTriangle, CheckCircle } from "lucide-react";
import { isMobileConnection, getNetworkType } from "@/lib/webrtc-utils";

interface ConnectionDiagnosticsProps {
  diagnostics: {
    networkType: string;
    isMobile: boolean;
    iceGatheringState: string;
    connectionState: string;
    candidateTypes: string[];
  } | null;
  isConnected: boolean;
}

export default function ConnectionDiagnostics({ diagnostics, isConnected }: ConnectionDiagnosticsProps) {
  if (!diagnostics) return null;

  const getNetworkIcon = () => {
    if (diagnostics.isMobile) {
      return diagnostics.networkType === 'cellular' ? <Smartphone className="h-4 w-4" /> : <Wifi className="h-4 w-4" />;
    }
    return diagnostics.networkType === 'wifi' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />;
  };

  const getConnectionStatus = () => {
    if (isConnected) {
      return { status: 'Connected', color: 'bg-green-500', icon: <CheckCircle className="h-4 w-4" /> };
    } else if (diagnostics.connectionState === 'failed') {
      return { status: 'Failed', color: 'bg-red-500', icon: <AlertTriangle className="h-4 w-4" /> };
    } else if (diagnostics.connectionState === 'connecting') {
      return { status: 'Connecting', color: 'bg-yellow-500', icon: <Signal className="h-4 w-4" /> };
    } else {
      return { status: 'Disconnected', color: 'bg-gray-500', icon: <WifiOff className="h-4 w-4" /> };
    }
  };

  const connectionStatus = getConnectionStatus();

  const getMobileWarnings = () => {
    const warnings = [];
    
    if (diagnostics.isMobile && diagnostics.networkType === 'cellular') {
      warnings.push("Using cellular data - connection may be limited by carrier");
    }
    
    if (diagnostics.candidateTypes.length > 0 && !diagnostics.candidateTypes.includes('relay')) {
      warnings.push("No TURN relay candidates - may have connectivity issues on restrictive networks");
    }
    
    if (diagnostics.iceGatheringState === 'gathering') {
      warnings.push("Still gathering network candidates...");
    }
    
    return warnings;
  };

  const warnings = getMobileWarnings();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getNetworkIcon()}
          Connection Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant="secondary" className={`${connectionStatus.color} text-white`} data-testid="badge-connection-status">
            <div className="flex items-center gap-1">
              {connectionStatus.icon}
              {connectionStatus.status}
            </div>
          </Badge>
        </div>

        {/* Network Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Network:</span>
            <Badge variant="outline" data-testid="badge-network-type">
              {diagnostics.networkType.charAt(0).toUpperCase() + diagnostics.networkType.slice(1)}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Device:</span>
            <Badge variant="outline" data-testid="badge-device-type">
              {diagnostics.isMobile ? 'Mobile' : 'Desktop'}
            </Badge>
          </div>
        </div>

        {/* ICE Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">ICE Gathering:</span>
            <Badge 
              variant={diagnostics.iceGatheringState === 'complete' ? 'default' : 'secondary'}
              data-testid="badge-ice-gathering"
            >
              {diagnostics.iceGatheringState}
            </Badge>
          </div>
          
          {diagnostics.candidateTypes.length > 0 && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Candidate Types:</span>
              <div className="flex flex-wrap gap-1">
                {diagnostics.candidateTypes.map((type, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs"
                    data-testid={`badge-candidate-${type}`}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-600">Warnings:</span>
            </div>
            <ul className="space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-xs text-yellow-600" data-testid={`warning-${index}`}>
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mobile-specific tips */}
        {diagnostics.isMobile && (
          <div className="pt-2 border-t">
            <div className="text-xs text-blue-600">
              📱 Mobile Tips: For best results, ensure strong signal strength and consider switching to Wi-Fi if available.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}