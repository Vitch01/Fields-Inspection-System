import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import VideoDisplay from "@/components/video-call/video-display";
import CallControls from "@/components/video-call/call-controls";
import ChatPanel from "@/components/video-call/chat-panel";
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
  const [showChat, setShowChat] = useState(false);
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
    chatMessages,
    sendChatMessage,
    unreadCount,
    clearUnreadCount,
  } = useWebRTC(callId!, "inspector");

  // Inspector doesn't need to fetch captured images
  const capturedImages: any[] = [];

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoinCall = () => {
    if (inspectorName.trim()) {
      // Join the call immediately
      setHasJoined(true);
      
      // Capture inspector's location as fire-and-forget (don't block UI)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date().toISOString()
            };
            
            // Send location to server (fire-and-forget)
            try {
              await fetch(`/api/calls/${callId}/location`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(locationData),
              });
            } catch (error) {
              console.error('Failed to save location:', error);
            }
          },
          (error) => {
            console.error('Failed to get location:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      }
    }
  };

  // Show join screen if not yet joined
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white text-black border border-gray-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-black" data-testid="title-join-call">Join Inspection Call</CardTitle>
            <p className="text-gray-600">
              You've been invited to join an inspection video call
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="inspector-name" className="text-sm font-medium text-black">Your Name</label>
              <input
                id="inspector-name"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-black"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Enter your name"
                data-testid="input-inspector-name"
              />
            </div>
            
            <div className="bg-gray-100 border border-gray-300 p-3 rounded-md text-sm">
              <div className="flex items-center space-x-2 mb-2">
                <UserCheck className="w-4 h-4 text-black" />
                <span className="font-medium text-black">Call Information</span>
              </div>
              <p className="text-gray-600">
                Site: Building A - Floor 3<br />
                Coordinator: Sarah Johnson
              </p>
            </div>

            <Button 
              onClick={handleJoinCall} 
              className="w-full bg-black text-white hover:bg-gray-800 border-black" 
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
      <header className="relative z-10 bg-black border-b border-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-white' : 'bg-gray-500'}`}></div>
            <span className="text-sm font-medium text-white">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium text-white">
            Coordinator: <span className="text-white" data-testid="text-coordinator-name">Sarah Johnson</span>
          </div>
          <div className="flex items-center space-x-1">
            <Signal className="w-4 h-4 text-white" />
            <span className="text-xs text-white">Excellent</span>
          </div>
        </div>
      </header>

      {/* Bottom Control Bar Overlay */}
      <div className="relative z-10 mt-auto bg-black">
        <CallControls
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          capturedImages={capturedImages}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onOpenSettings={() => setShowSettings(true)}
          onOpenChat={() => {
            clearUnreadCount();
            setShowChat(true);
          }}
          onEndCall={endCall}
          onImageClick={setSelectedImage}
          // Inspector doesn't have capture button - coordinator controls capture remotely
          isCoordinator={false}
          unreadCount={unreadCount}
        />
      </div>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        isCoordinator={false}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <ImageViewerModal
        images={capturedImages}
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
