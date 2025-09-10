import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import VideoDisplay from "@/components/video-call/video-display";
import CallControls from "@/components/video-call/call-controls";
import SettingsModal from "@/components/video-call/settings-modal";
import ImageViewerModal from "@/components/video-call/image-viewer-modal";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useState } from "react";
import { Clock, Signal, Users, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CoordinatorCall() {
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(942); // seconds
  const [videoRotation, setVideoRotation] = useState(0); // Track video rotation state
  const { toast } = useToast();

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
  } = useWebRTC(callId!, "coordinator");

  const { data: capturedImages = [], refetch: refetchImages } = useQuery<any[]>({
    queryKey: ["/api/calls", callId, "images"],
    enabled: !!callId,
  });

  // Enhanced capture function that refreshes images immediately
  const captureImage = async () => {
    try {
      await originalCaptureImage();
      // Immediately refresh the images to show the new capture
      await refetchImages();
    } catch (error) {
      console.error("Failed to capture and refresh:", error);
    }
  };

  // Mock call timer
  useState(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  });

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
            Inspector: <span className="text-primary" data-testid="text-inspector-name">John Martinez</span>
          </div>
          <div className="flex items-center space-x-2">
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
          <div className="flex items-center space-x-1">
            <Signal className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Excellent</span>
          </div>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1">
        <VideoDisplay
          localStream={localStream}
          remoteStream={remoteStream}
          isCoordinator={true}
          onCaptureImage={captureImage}
          onRotationChange={setVideoRotation}
        />
      </main>

      {/* Bottom Control Bar */}
      <CallControls
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        capturedImages={capturedImages}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onOpenSettings={() => setShowSettings(true)}
        onEndCall={endCall}
        onImageClick={setSelectedImage}
        onCaptureImage={captureImage}
        isCoordinator={true}
        videoRotation={videoRotation}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <ImageViewerModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
        videoRotation={videoRotation}
      />
    </div>
  );
}
