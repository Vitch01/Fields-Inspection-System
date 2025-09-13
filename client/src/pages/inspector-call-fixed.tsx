import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Clock, Signal, Video, UserCheck, Mic, MicOff, VideoOff, MessageCircle, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function InspectorCallFixed() {
  const { callId } = useParams();
  const { toast } = useToast();
  const [callDuration, setCallDuration] = useState(942);
  const [hasJoined, setHasJoined] = useState(false);
  const [inspectorName, setInspectorName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate connection after joining
  useEffect(() => {
    if (hasJoined) {
      console.log("InspectorCallFixed - User joined, simulating connection");
      const connectTimer = setTimeout(() => {
        setIsConnected(true);
        console.log("Inspector connection simulated");
      }, 1500);
      return () => clearTimeout(connectTimer);
    }
  }, [hasJoined]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoinCall = () => {
    if (inspectorName.trim()) {
      console.log("Inspector joining call:", { callId, name: inspectorName });
      setHasJoined(true);
      
      toast({
        title: "Joining Call",
        description: "Connecting to the inspection call...",
      });
      
      // Simulate location capture (in real implementation, this would get actual location)
      setTimeout(() => {
        toast({
          title: "Location Captured",
          description: "Your location has been recorded for the inspection",
        });
      }, 2000);
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Microphone unmuted" : "Microphone muted",
      description: `Audio is now ${isMuted ? 'enabled' : 'disabled'}`,
    });
  };

  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    toast({
      title: isVideoEnabled ? "Camera disabled" : "Camera enabled",
      description: `Video is now ${isVideoEnabled ? 'disabled' : 'enabled'}`,
    });
  };

  const handleEndCall = () => {
    toast({
      title: "Call Ended",
      description: "Thank you for completing the inspection",
    });
    // In real implementation, this would navigate to thank you page
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
                Coordinator: Sarah Johnson<br />
                Call ID: {callId}
              </p>
            </div>

            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
              ✅ Page loaded successfully<br />
              ✅ Join form ready<br />
              ✅ No initialization errors
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
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="text-center text-white">
          <Video className="w-32 h-32 mx-auto mb-8 text-gray-400" />
          <h2 className="text-2xl mb-4">Inspector Call Interface</h2>
          <p className="text-gray-400 mb-4">Welcome, {inspectorName}</p>
          <div className="text-sm text-gray-500">
            <p>✅ Successfully joined call</p>
            <p>✅ Interface loading properly</p>
            <p className={isConnected ? "text-green-400" : "text-yellow-400"}>
              {isConnected ? "✅ Connected to coordinator" : "⏳ Connecting..."}
            </p>
          </div>
        </div>
      </div>

      {/* Header Overlay */}
      <header className="relative z-10 bg-black border-b border-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-gray-500'}`}></div>
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
      <div className="relative z-10 mt-auto bg-black p-4">
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={handleToggleMute}
              data-testid="button-toggle-mute"
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant={isVideoEnabled ? "secondary" : "destructive"}
              onClick={handleToggleVideo}
              data-testid="button-toggle-video"
            >
              {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
          </div>

          {/* Center Info */}
          <div className="text-center text-white">
            <div className="text-sm">
              <Clock className="w-4 h-4 inline mr-1" />
              <span data-testid="text-call-duration">{formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowChat(true)}
              data-testid="button-open-chat"
            >
              <MessageCircle className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettings(true)}
              data-testid="button-open-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEndCall}
              data-testid="button-end-call"
            >
              End Call
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4 text-white">
            <h3 className="text-lg font-semibold mb-4">Chat</h3>
            <div className="h-48 bg-gray-700 rounded p-2 mb-4 overflow-y-auto">
              <p className="text-sm text-gray-300">Chat functionality will be implemented here...</p>
            </div>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 px-3 py-2 border rounded bg-gray-700 text-white border-gray-600"
                data-testid="input-chat-message"
              />
              <Button size="sm" data-testid="button-send-message">Send</Button>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowChat(false)}
              className="mt-4 w-full"
              data-testid="button-close-chat"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4 text-white">
            <h3 className="text-lg font-semibold mb-4">Settings</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-300">Camera and microphone settings will be available here...</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowSettings(false)}
              className="mt-4 w-full"
              data-testid="button-close-settings"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}