import { useParams, useLocation } from "wouter";
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
import { Clock, Signal, Copy, ExternalLink, Map, User, Building, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Helper function to decode JWT token and get user data (same as dashboard)
function getCurrentUserFromToken() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  
  try {
    // JWT tokens have three parts separated by dots
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    return {
      id: payload.userId,
      name: payload.name,
      role: payload.role,
      username: payload.username,
      email: payload.email,
      departmentId: payload.departmentId
    };
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

export default function CoordinatorCall() {
  // IMMEDIATE DEBUG - See if component executes and what happens
  console.log('🚨 COORDINATOR CALL EXECUTING!', { 
    url: window.location.href, 
    token: !!localStorage.getItem('authToken'),
    timestamp: new Date().toISOString()
  });
  
  const { callId } = useParams();
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [videoRotation, setVideoRotation] = useState(0);
  const { toast } = useToast();
  const [authError, setAuthError] = useState<string | null>(null);

  // Get authenticated user using same function as dashboard
  const currentUser = getCurrentUserFromToken();
  
  // Authentication validation - show error instead of silent redirect
  useEffect(() => {
    console.log('🔒 COORDINATOR CALL AUTH CHECK:', {
      hasToken: !!localStorage.getItem('authToken'),
      currentUser: currentUser,
      callId: callId
    });

    if (!currentUser) {
      console.log('❌ No authenticated user found in coordinator call');
      setAuthError('Authentication required. Please log in as a coordinator.');
      return;
    }
    
    if (currentUser.role !== 'coordinator') {
      console.log('❌ User role mismatch in coordinator call:', currentUser.role, 'expected: coordinator');
      setAuthError(`Invalid role: ${currentUser.role}. Coordinator access required.`);
      return;
    }
    
    console.log('✅ Authentication validated for coordinator call:', currentUser.name);
    setAuthError(null);
  }, [currentUser, callId]);

  // Query hooks
  const { data: call, error: callError, isLoading: callLoading } = useQuery<any>({
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
  } = useWebRTC(callId || "", "coordinator");

  // Call duration timer
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const copyCallLink = () => {
    const inspectorLink = `${window.location.origin}/join/${callId}`;
    navigator.clipboard.writeText(inspectorLink);
    toast({
      title: "Link Copied",
      description: "Inspector call link copied to clipboard",
    });
  };

  const openInspectorLink = () => {
    const inspectorLink = `${window.location.origin}/join/${callId}`;
    window.open(inspectorLink, '_blank');
  };

  // Show auth error state - VISIBLE instead of silent redirect
  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-destructive">Authentication Required</h1>
          <p className="text-muted-foreground">{authError}</p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Debug info:</p>
            <pre className="text-xs bg-muted p-2 rounded text-left">
              Token exists: {localStorage.getItem('authToken') ? 'YES' : 'NO'}
              Current user: {currentUser ? JSON.stringify(currentUser, null, 2) : 'NULL'}
              Call ID: {callId || 'MISSING'}
            </pre>
          </div>
          <Button onClick={() => setLocation('/')} data-testid="button-go-home">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (callLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading call...</p>
          <p className="text-xs text-muted-foreground">Call ID: {callId}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (callError || !callId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Call Not Found</h1>
          <p className="text-muted-foreground">
            {callError ? "Failed to load call information" : "Invalid call ID"}
          </p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Debug info:</p>
            <pre className="text-xs bg-muted p-2 rounded text-left">
              Call ID: {callId || 'MISSING'}
              Error: {callError?.message || 'No call ID provided'}
              Auth user: {currentUser?.name || 'None'}
            </pre>
          </div>
          <Button onClick={() => window.history.back()} data-testid="button-back">
            Go Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            
            {isConnected && (
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium" data-testid="text-call-duration">
                  {formatDuration(callDuration)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyCallLink}
              data-testid="button-copy-link"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Inspector Link
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={openInspectorLink}
              data-testid="button-open-inspector-link"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Inspector Link
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFieldMap(!showFieldMap)}
              data-testid="button-toggle-map"
            >
              <Map className="w-4 h-4 mr-2" />
              {showFieldMap ? 'Hide Map' : 'Show Map'}
            </Button>
          </div>
        </header>

        {/* Video Content Area */}
        <div className="flex-1 flex">
          {/* Video Display */}
          <div className="flex-1 bg-black relative">
            <VideoDisplay
              localStream={localStream}
              remoteStream={remoteStream}
              isCoordinator={true}
              onCaptureImage={captureImage}
              onRotationChange={(rotation) => setVideoRotation(rotation)}
              inspectorName={call?.inspector?.name}
              callStartTime={call?.startTime}
            />
          </div>

          {/* Field Map Panel */}
          {showFieldMap && (
            <div className="w-80 bg-card border-l">
              <div className="h-full flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Field Map & Inspector Location</h3>
                  <p className="text-sm text-muted-foreground">
                    Track inspector location and view site details
                  </p>
                </div>
                <div className="flex-1">
                  <FieldMap 
                    isOpen={true}
                    onClose={() => setShowFieldMap(false)}
                    onSelectInspector={(inspector) => console.log('Selected inspector:', inspector)}
                    currentCallInspectorId={call?.inspectorId}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="bg-card border-t">
          <CallControls
            isMuted={isMuted}
            isVideoEnabled={isVideoEnabled}
            capturedImages={capturedImages}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onCaptureImage={captureImage}
            onOpenSettings={() => setShowSettings(true)}
            onOpenChat={() => {
              clearUnreadCount();
              setShowChat(true);
            }}
            onEndCall={endCall}
            onImageClick={setSelectedImage}
            isCoordinator={true}
            unreadCount={unreadCount}
          />
        </div>
      </div>

      {/* Right Sidebar - Call Information */}
      <div className="w-80 bg-card border-l flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg" data-testid="text-call-title">
            Inspection Call
          </h2>
          <p className="text-sm text-muted-foreground">
            Call ID: {callId}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Call Information */}
          {call && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="w-5 h-5" />
                  <span>Call Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant={call.status === 'active' ? 'default' : 'secondary'} data-testid="badge-call-status">
                      {call.status || 'Active'}
                    </Badge>
                  </div>
                </div>
                
                {call.inspectionRequest && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Inspection Request</label>
                      <p className="text-sm mt-1" data-testid="text-request-title">
                        {call.inspectionRequest.title}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Asset Type</label>
                      <p className="text-sm mt-1" data-testid="text-asset-type">
                        {call.inspectionRequest.assetType}
                      </p>
                    </div>
                    
                    {call.inspectionRequest.location && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Location</label>
                        <p className="text-sm mt-1" data-testid="text-location">
                          {call.inspectionRequest.location.address}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Inspector Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Inspector</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {call?.inspector ? (
                <div className="space-y-2">
                  <p className="font-medium" data-testid="text-inspector-name">
                    {call.inspector.name}
                  </p>
                  {call.inspector.email && (
                    <p className="text-sm text-muted-foreground" data-testid="text-inspector-email">
                      {call.inspector.email}
                    </p>
                  )}
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-muted-foreground">Connected</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for inspector to join...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Captured Media */}
          {capturedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Captured Images ({capturedImages.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {capturedImages.slice(0, 4).map((image, index) => (
                    <div
                      key={index}
                      className="aspect-square bg-muted rounded-md cursor-pointer overflow-hidden"
                      onClick={() => setSelectedImage(image)}
                      data-testid={`image-thumbnail-${index}`}
                    >
                      <img
                        src={image.url || image.dataUrl}
                        alt={`Captured ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                {capturedImages.length > 4 && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    +{capturedImages.length - 4} more images
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Inspector Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Map className="w-5 h-5" />
                <span>Inspector Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InspectorLocation location={call?.inspectorLocation || null} />
            </CardContent>
          </Card>
        </div>
      </div>

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
        images={capturedImages}
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}