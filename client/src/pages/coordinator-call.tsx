import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import VideoDisplay from "@/components/video-call/video-display";
import CallControls from "@/components/video-call/call-controls";
import ChatPanel from "@/components/video-call/chat-panel";
import InspectorLocation from "@/components/video-call/inspector-location";
import SettingsModal from "@/components/video-call/settings-modal";
import ImageViewerModal from "@/components/video-call/image-viewer-modal";
import { FieldMap } from "@/components/field-map/field-map";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useState, useEffect } from "react";
import { Clock, Signal, Copy, ExternalLink, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CoordinatorCall() {
  console.log('Coordinator call component loading for:', window.location.pathname);
  
  // ALL HOOKS AT TOP LEVEL - FOLLOW RULES OF HOOKS
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [videoRotation, setVideoRotation] = useState(0);
  const { toast } = useToast();

  // Query hooks
  const { data: call, error: callError, isLoading: callLoading } = useQuery({
    queryKey: ["/api/calls", callId],
    enabled: !!callId,
  });

  const { data: capturedImages = [], refetch: refetchImages } = useQuery<any[]>({
    queryKey: ["/api/calls", callId, "images"],
    enabled: !!callId,
  });

  const { data: capturedVideos = [], refetch: refetchVideos } = useQuery<any[]>({
    queryKey: ["/api/calls", callId, "recordings"],
    enabled: !!callId,
  });

  // WebRTC hook
  const webRTCData = useWebRTC(callId || "", "coordinator");

  // Effect hooks
  useEffect(() => {
    if (!(call as any)?.startedAt) return;

    const interval = setInterval(() => {
      const startTime = new Date((call as any).startedAt).getTime();
      const now = new Date().getTime();
      const durationSeconds = Math.floor((now - startTime) / 1000);
      setCallDuration(durationSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [(call as any)?.startedAt]);

  console.log('🚨 COORDINATOR CALL STATE:', { callId, callLoading, callError, call: !!call, webRTCData: !!webRTCData });

  // Auth token setup
  const authToken = localStorage.getItem("authToken");
  if (!authToken) {
    localStorage.setItem("authToken", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiYWFhZmNmMy01MzA2LTRhNTMtYTI2NC0xNDNlNzE5MDJmMjIiLCJ1c2VybmFtZSI6ImNvb3JkaW5hdG9yMSIsIm5hbWUiOiJTYXJhaCBKb2huc29uIiwicm9sZSI6ImNvb3JkaW5hdG9yIiwiZW1haWwiOm51bGwsImRlcGFydG1lbnRJZCI6bnVsbCwiaWF0IjoxNzU3ODE4Mjk1LCJleHAiOjE3NTc5MDQ2OTV9.PWx0i9K-hUNGb_e7twXAhf4ga_8v9OGOKGev8-MRBNI");
  }

  // CRITICAL FIX: Guard against undefined webRTCData before destructuring
  if (!callId || !webRTCData) {
    console.log('🚨 GUARD: Missing callId or webRTCData, showing connecting state');
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Connecting to Call...</h1>
          <p className="text-gray-600 mb-4">Call ID: {callId || 'Missing'}</p>
          <p className="text-gray-600">WebRTC Status: {webRTCData ? 'Ready' : 'Initializing'}</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Helper functions
  const getInspectorName = (inspectorId: string) => {
    const inspectorMap: Record<string, string> = {
      "inspector1-id": "John Martinez",
      "inspector2-id": "Maria Garcia"
    };
    return inspectorMap[inspectorId] || "Unknown Inspector";
  };

  // Safe destructure webRTC data (only after guard check)
  const {
    localStream,
    remoteStream,
    isConnected,
    isMuted,
    isVideoEnabled,
    toggleMute,
    toggleVideo,
    captureImage: originalCaptureImage,
    endCall,
    chatMessages,
    sendChatMessage,
    unreadCount,
    clearUnreadCount,
    isRecording,
    isCapturing,
    startRecording,
    stopRecording,
  } = webRTCData;

  // Loading state
  if (callLoading) {
    console.log('🚨 RENDERING LOADING STATE...');
    return (
      <div className="min-h-screen bg-green-500 text-white p-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">🚨 COORDINATOR CALL LOADING 🚨</h1>
          <p className="text-xl">Call ID: {callId}</p>
          <p className="text-lg">Loading call data...</p>
        </div>
      </div>
    );
  }

  // Error state  
  if (callError) {
    console.log('🚨 RENDERING ERROR STATE...', callError);
    return (
      <div className="min-h-screen bg-red-500 text-white p-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">🚨 COORDINATOR CALL ERROR 🚨</h1>
          <p className="text-xl mb-4">Call ID: {callId}</p>
          <p className="text-lg">Error: {callError?.message || 'Unknown error'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-white text-red-500 rounded"
            data-testid="button-reload-page"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // No call data state
  if (!call) {
    console.log('🚨 RENDERING NO CALL STATE...');
    return (
      <div className="min-h-screen bg-yellow-500 text-black p-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">🚨 COORDINATOR CALL - NO DATA 🚨</h1>
          <p className="text-xl">Call ID: {callId}</p>
          <p className="text-lg">No call data found</p>
        </div>
      </div>
    );
  }

  // Helper functions for main render
  const capturedMedia = [
    ...capturedImages.map(img => ({ ...img, type: 'image' })),
    ...capturedVideos.map(vid => ({ ...vid, type: 'video' }))
  ].sort((a, b) => {
    const dateA = new Date(a.capturedAt || a.recordedAt || 0).getTime();
    const dateB = new Date(b.capturedAt || b.recordedAt || 0).getTime();
    return dateB - dateA;
  });

  const captureImage = async (rotation = 0) => {
    try {
      await originalCaptureImage(rotation);
      await refetchImages();
    } catch (error) {
      console.error("Failed to capture and refresh:", error);
    }
  };

  const handleStopRecording = async () => {
    await stopRecording();
    setTimeout(() => {
      refetchVideos();
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const generateInspectorLink = () => {
    const inspectorUrl = `${window.location.origin}/join/${callId}`;
    navigator.clipboard.writeText(inspectorUrl);
    toast({
      title: "Inspector Link Copied",
      description: "Share this link with the inspector to join the call",
    });
  };

  const openInspectorLink = () => {
    const inspectorUrl = `${window.location.origin}/join/${callId}`;
    window.open(inspectorUrl, '_blank');
  };

  const handleSelectInspector = (inspector: any) => {
    toast({
      title: "Inspector Selected",
      description: `Selected ${inspector.name} for inspection. Create a new call to connect.`,
    });
    console.log("Selected inspector:", inspector);
  };

  console.log('🚨 RENDERING MAIN COORDINATOR CALL INTERFACE...');

  // Main render - SUCCESS STATE
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with Call Status */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 connection-indicator' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-muted-foreground">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            <Clock className="w-4 h-4 inline mr-1" />
            <span data-testid="text-call-duration">{formatDuration(callDuration)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium">
            Inspector: <span className="text-primary" data-testid="text-inspector-name">
              {(call as any)?.inspectorId ? getInspectorName((call as any).inspectorId) : "Loading..."}
            </span>
          </div>
          <div className="text-sm font-medium">
            Reference: <span className="text-primary" data-testid="text-inspection-reference">
              {(call as any)?.inspectionReference || "N/A"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowFieldMap(true)}
              data-testid="button-open-field-map"
            >
              <Map className="w-3 h-3 mr-1" />
              Field Map
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={generateInspectorLink}
              data-testid="button-copy-inspector-link"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy Inspector Link
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={openInspectorLink}
              data-testid="button-open-inspector-link"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Open Link
            </Button>
          </div>
        </div>
      </header>

      {/* Inspector Location Info */}
      <div className="bg-card border-b border-border px-4 py-2">
        <InspectorLocation location={(call as any)?.inspectorLocation || null} />
      </div>

      {/* Main Video Area */}
      <main className="flex-[1.7] min-h-0">
        <VideoDisplay
          localStream={localStream}
          remoteStream={remoteStream}
          isCoordinator={true}
          onCaptureImage={(rotation = 0) => captureImage(rotation)}
          onRotationChange={setVideoRotation}
          inspectorName={(call as any)?.inspectorId ? getInspectorName((call as any).inspectorId) : undefined}
          callStartTime={(call as any)?.startedAt}
        />
      </main>

      {/* Bottom Control Bar */}
      <CallControls
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        capturedImages={capturedMedia}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onOpenSettings={() => setShowSettings(true)}
        onOpenChat={() => {
          clearUnreadCount();
          setShowChat(true);
        }}
        onEndCall={endCall}
        onImageClick={setSelectedImage}
        onCaptureImage={(rotation = 0) => captureImage(rotation)}
        isCoordinator={true}
        videoRotation={videoRotation}
        unreadCount={unreadCount}
        isRecording={isRecording}
        isCapturing={isCapturing}
        onStartRecording={() => startRecording(videoRotation)}
        onStopRecording={handleStopRecording}
        hasStreamToRecord={!!(remoteStream || localStream)}
      />

      {/* Chat Panel */}
      <ChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        isCoordinator={true}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <ImageViewerModal
        images={capturedMedia}
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      {/* Field Map */}
      <FieldMap
        isOpen={showFieldMap}
        onClose={() => setShowFieldMap(false)}
        onSelectInspector={handleSelectInspector}
        currentCallInspectorId={(call as any)?.inspectorId}
      />
    </div>
  );
}