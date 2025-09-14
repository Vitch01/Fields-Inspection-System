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
import { Clock, Signal, Users, Copy, ExternalLink, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CoordinatorCall() {
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0); // seconds
  const [videoRotation, setVideoRotation] = useState(0); // Track video rotation state
  const { toast } = useToast();

  // Inspector name mapping
  const getInspectorName = (inspectorId: string) => {
    const inspectorMap: Record<string, string> = {
      "inspector1-id": "John Martinez",
      "inspector2-id": "Maria Garcia"
    };
    return inspectorMap[inspectorId] || "Unknown Inspector";
  };

  const { data: call } = useQuery({
    queryKey: ["/api/calls", callId],
    enabled: !!callId,
  });

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
  } = useWebRTC(callId!, "coordinator");

  const { data: capturedImages = [], refetch: refetchImages } = useQuery<any[]>({
    queryKey: ["/api/calls", callId, "images"],
    enabled: !!callId,
  });

  const { data: capturedVideos = [], refetch: refetchVideos } = useQuery<any[]>({
    queryKey: ["/api/calls", callId, "recordings"],
    enabled: !!callId,
  });

  // Combine images and videos into a single media array
  const capturedMedia = [
    ...capturedImages.map(img => ({ ...img, type: 'image' })),
    ...capturedVideos.map(vid => ({ ...vid, type: 'video' }))
  ].sort((a, b) => {
    const dateA = new Date(a.capturedAt || a.recordedAt || 0).getTime();
    const dateB = new Date(b.capturedAt || b.recordedAt || 0).getTime();
    return dateB - dateA; // Sort by most recent first
  });

  // Enhanced capture function that refreshes images immediately
  const captureImage = async (rotation = 0) => {
    try {
      await originalCaptureImage(rotation);
      // Immediately refresh the images to show the new capture
      await refetchImages();
    } catch (error) {
      console.error("Failed to capture and refresh:", error);
    }
  };

  // Enhanced stop recording function that refreshes videos immediately
  const handleStopRecording = async () => {
    await stopRecording();
    // Wait a bit for server to process the video
    setTimeout(() => {
      refetchVideos();
    }, 1000);
  };

  // Call duration timer based on call start time
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

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const generateInspectorLink = () => {
    const inspectorUrl = `${window.location.origin}/join/${callId}`;
    console.log(`🔗 Coordinator: Copying inspector link for call ${callId}: ${inspectorUrl}`);
    navigator.clipboard.writeText(inspectorUrl);
    toast({
      title: "Inspector Link Copied",
      description: `Inspector link copied: /join/${callId}`,
    });
  };

  const openInspectorLink = () => {
    const inspectorUrl = `${window.location.origin}/join/${callId}`;
    console.log(`🔗 Coordinator: Opening inspector link for call ${callId}: ${inspectorUrl}`);
    window.open(inspectorUrl, '_blank');
  };

  const handleSelectInspector = (inspector: any) => {
    toast({
      title: "Inspector Selected",
      description: `Selected ${inspector.name} for inspection. Create a new call to connect.`,
    });
    console.log("Selected inspector:", inspector);
    // In a real app, you would navigate to create a new call with this inspector
  };

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
          <div className="text-xs text-muted-foreground">
            Call ID: <span className="font-mono text-primary" data-testid="text-call-id">
              {callId}
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
            <a 
              href={`${window.location.origin}/join/${callId}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2"
              data-testid="button-open-inspector-link"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Open Link
            </a>
          </div>
          <div className="flex items-center space-x-1">
            <Signal className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Excellent</span>
          </div>
        </div>
      </header>

      {/* Inspector Location Info */}
      <div className="bg-card border-b border-border px-4 py-2">
        <InspectorLocation location={(call as any)?.inspectorLocation || null} />
      </div>

      {/* Main Video Area - Enlarged by 70% */}
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
