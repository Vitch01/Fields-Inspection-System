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
  // ALL HOOKS AT TOP LEVEL - FOLLOW RULES OF HOOKS
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [videoRotation, setVideoRotation] = useState(0);
  const { toast } = useToast();


  // Authentication validation - redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('No authentication token found, redirecting to login');
      window.location.href = '/';
      return;
    }

    // Validate token format and check if it's expired
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const payload = JSON.parse(jsonPayload);
      
      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn('Authentication token expired, redirecting to login');
        localStorage.removeItem('authToken');
        window.location.href = '/';
        return;
      }
      
      // Check if user has coordinator role
      if (payload.role !== 'coordinator') {
        console.warn('Invalid role for coordinator access, redirecting to login');
        localStorage.removeItem('authToken');
        window.location.href = '/';
        return;
      }
      
      console.log('Authentication validated for coordinator:', payload.name);
    } catch (error) {
      console.error('Invalid authentication token format, redirecting to login:', error);
      localStorage.removeItem('authToken');
      window.location.href = '/';
      return;
    }
  }, []);

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


  // Guard against undefined webRTCData before destructuring
  if (!callId || !webRTCData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Connecting to call...</p>
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
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading call data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (callError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive mb-4">
            <h2 className="text-xl font-semibold">Call Error</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {callError?.message || 'Failed to load call data'}
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  // No call data state
  if (!call) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Call Not Found</h2>
          <p className="text-muted-foreground">The requested call could not be found.</p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
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
      await originalCaptureImage();
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
  };


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
        onStartRecording={() => startRecording()}
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