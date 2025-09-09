import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import VideoDisplay from "@/components/video-call/video-display";
import CallControls from "@/components/video-call/call-controls";
import SettingsModal from "@/components/video-call/settings-modal";
import ImageViewerModal from "@/components/video-call/image-viewer-modal";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useState, useEffect } from "react";
import { Clock, Signal, Video, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InspectorCall() {
  const { callId } = useParams();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(942);
  const [hasJoined, setHasJoined] = useState(false);
  const [inspectorName, setInspectorName] = useState("");

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
    captureImage,
    endCall,
  } = useWebRTC(callId!, "inspector");

  // Inspector doesn't need to fetch captured images
  const capturedImages: any[] = [];

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

  const handleJoinCall = () => {
    if (inspectorName.trim()) {
      setHasJoined(true);
    }
  };

  // Show join screen if not yet joined
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl" data-testid="title-join-call">Join Inspection Call</CardTitle>
            <p className="text-muted-foreground">
              You've been invited to join an inspection video call
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="inspector-name" className="text-sm font-medium">Your Name</label>
              <input
                id="inspector-name"
                type="text"
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Enter your name"
                data-testid="input-inspector-name"
              />
            </div>
            
            <div className="bg-muted p-3 rounded-md text-sm">
              <div className="flex items-center space-x-2 mb-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span className="font-medium">Call Information</span>
              </div>
              <p className="text-muted-foreground">
                Site: Building A - Floor 3<br />
                Coordinator: Sarah Johnson
              </p>
            </div>

            <Button 
              onClick={handleJoinCall} 
              className="w-full" 
              disabled={!inspectorName.trim()}
              data-testid="button-join-inspection-call"
            >
              Join Inspection Call
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black relative">
      {/* Full Screen Camera View for Inspector */}
      <div className="absolute inset-0 z-0">
        {localStream && (
          <video
            autoPlay
            muted
            playsInline
            ref={(video) => {
              if (video && localStream) {
                video.srcObject = localStream;
              }
            }}
            className="w-full h-full object-cover"
            data-testid="video-local-fullscreen"
          />
        )}
      </div>

      {/* Header Overlay */}
      <header className="relative z-10 bg-black/50 backdrop-blur-sm border-b border-white/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 connection-indicator' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-white">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="text-sm text-white/80">
            <Clock className="w-4 h-4 inline mr-1" />
            <span data-testid="text-call-duration">{formatDuration(callDuration)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium text-white">
            Coordinator: <span className="text-blue-300" data-testid="text-coordinator-name">Sarah Johnson</span>
          </div>
          <div className="flex items-center space-x-1">
            <Signal className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/80">Excellent</span>
          </div>
        </div>
      </header>

      {/* Bottom Control Bar Overlay */}
      <div className="relative z-10 mt-auto bg-black/50 backdrop-blur-sm">
        <CallControls
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          capturedImages={capturedImages}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onOpenSettings={() => setShowSettings(true)}
          onEndCall={endCall}
          onImageClick={setSelectedImage}
          isCoordinator={false}
        />
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <ImageViewerModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
