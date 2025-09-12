import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import VideoDisplay from "@/components/video-call/video-display";
import CallControls from "@/components/video-call/call-controls";
import ChatPanel from "@/components/video-call/chat-panel";
import InspectorLocation from "@/components/video-call/inspector-location";
import SettingsModal from "@/components/video-call/settings-modal";
import ImageViewerModal from "@/components/video-call/image-viewer-modal";
import QRCodeDisplay from "@/components/video-call/qr-code-display";
import { useWebRTC } from "@/hooks/use-webrtc";
import type { ConnectionState, ConnectionError } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { Clock, Signal, Users, Copy, ExternalLink, QrCode, Wifi, WifiOff, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function CoordinatorCall() {
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
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
    wsConnected, // WebSocket connection status (backward compatibility)
    connectionState, // Enhanced WebSocket connection state
    connectionStats, // Enhanced WebSocket connection statistics
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
    networkQuality,
    joinCall,
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

  // Send join-call message when component loads
  useEffect(() => {
    if (callId) {
      // Register coordinator with server immediately
      joinCall({ 
        role: 'coordinator',
        name: 'Coordinator' 
      });
    }
  }, [callId, joinCall]);

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

  const getInspectorUrl = () => {
    return `${window.location.origin}/join/${callId}`;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with Call Status */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {/* Enhanced connection status indicator */}
            <div className={`w-3 h-3 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500 connection-indicator' :
              connectionState === 'connecting' || connectionState === 'reconnecting' ? 'bg-yellow-500' :
              connectionState === 'failed' || connectionState === 'maximum-retries-exceeded' ? 'bg-red-500' :
              'bg-gray-500'
            }`}></div>
            <span className="text-sm font-medium text-muted-foreground">
              {connectionState === 'connected' ? 'Connected' :
               connectionState === 'connecting' ? 'Connecting...' :
               connectionState === 'reconnecting' ? `Reconnecting... (Attempt ${connectionStats.attempts})` :
               connectionState === 'failed' ? 'Connection Failed' :
               connectionState === 'maximum-retries-exceeded' ? 'Connection Failed (Max Retries)' :
               'Disconnected'}
            </span>
            {connectionState === 'reconnecting' && (
              <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
            )}
            {(connectionState === 'failed' || connectionState === 'maximum-retries-exceeded') && (
              <AlertTriangle className="w-3 h-3 text-red-500" />
            )}
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
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowQRCode(true)}
              data-testid="button-show-qr-code"
            >
              <QrCode className="w-3 h-3 mr-1" />
              QR Code
            </Button>
          </div>
          <div className="flex items-center space-x-1">
            <Signal 
              className={`w-4 h-4 ${
                networkQuality.level === 'excellent' ? 'text-green-500' :
                networkQuality.level === 'good' ? 'text-green-400' :
                networkQuality.level === 'fair' ? 'text-yellow-500' :
                networkQuality.level === 'poor' ? 'text-red-500' :
                'text-gray-400'
              }`} 
            />
            <span className="text-xs text-muted-foreground capitalize">
              {connectionState !== 'connected' ? 
                (connectionState === 'reconnecting' ? `Reconnecting... (${connectionStats.attempts})` : 
                 connectionState === 'connecting' ? 'Connecting...' : 
                 'Disconnected') : 
                networkQuality.level}
            </span>
          </div>
        </div>
      </header>

      {/* Inspector Location Info */}
      <div className="bg-card border-b border-border px-4 py-2">
        <InspectorLocation location={(call as any)?.inspectorLocation || null} />
      </div>

      {/* Main Video Area */}
      <main className="flex-1">
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

      {/* QR Code Modal */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="max-w-sm" data-testid="dialog-qr-code">
          <DialogHeader>
            <DialogTitle className="text-center">Inspector Access QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <QRCodeDisplay
              url={getInspectorUrl()}
              title="Inspector Access"
              description="Scan with mobile device to join call"
              size={250}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
