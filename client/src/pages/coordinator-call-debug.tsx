import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { useWebSocketSafe } from "@/hooks/use-websocket-safe";
import { Clock, Signal, Video } from "lucide-react";

// Debug version of coordinator call page with minimal dependencies
export default function CoordinatorCallDebug() {
  const { callId } = useParams();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);

  // Add debug information
  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  useEffect(() => {
    addDebugInfo("Component mounted successfully");
    addDebugInfo(`Call ID: ${callId}`);
  }, [callId]);

  // Timer for call duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Test the safe WebSocket hook
  const { isConnected, error, transportMode } = useWebSocketSafe(callId!, "coordinator", {
    enabled: true,
    onConnect: () => addDebugInfo("WebSocket connected"),
    onDisconnect: () => addDebugInfo("WebSocket disconnected"),
    onMessage: (msg) => addDebugInfo(`Message received: ${msg.type}`)
  });

  useEffect(() => {
    if (error) {
      addDebugInfo(`WebSocket error: ${error}`);
    }
  }, [error]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
          <div className="text-sm text-gray-400">
            <Clock className="w-4 h-4 inline mr-1" />
            <span data-testid="text-call-duration">{formatDuration(callDuration)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            Transport: <span className="text-blue-400">{transportMode}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Signal className="w-4 h-4 text-green-500" />
            <span className="text-xs">Debug Mode</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Video Area */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="text-center">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h2 className="text-xl mb-2">Coordinator Call Debug Mode</h2>
            <p className="text-gray-400">Call ID: {callId}</p>
            <div className="mt-4 p-4 bg-gray-800 rounded max-w-md">
              <p className="text-sm mb-2">Connection Status:</p>
              <div className="text-left text-xs space-y-1">
                <div>Connected: {isConnected ? '✅' : '❌'}</div>
                <div>Transport: {transportMode}</div>
                {error && <div className="text-red-400">Error: {error}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="w-1/3 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Debug Information</h3>
          <div className="space-y-2">
            {debugInfo.map((info, index) => (
              <div key={index} className="text-xs text-gray-300 p-2 bg-gray-700 rounded">
                {info}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex justify-center space-x-4">
          <button 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            onClick={() => addDebugInfo("End call button clicked")}
          >
            End Call (Debug)
          </button>
          <button 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            onClick={() => addDebugInfo("Test button clicked")}
          >
            Test Connection
          </button>
        </div>
      </div>
    </div>
  );
}