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
  // IMMEDIATE DEBUG - Test if component executes at all
  console.log('🚨 COORDINATOR CALL COMPONENT EXECUTING!', window.location.href);
  console.log('🚨 Component render timestamp:', new Date().toISOString());
  document.title = 'DEBUG: Coordinator Call Loading...';
  
  // Create simple test render to check if component executes
  console.log('🚨 About to check callId from params...');
  
  const { callId } = useParams();
  console.log('🚨 CallId from useParams:', callId);
  
  // SIMPLIFIED RENDER FOR DEBUGGING - Remove complex dependencies
  if (!callId) {
    console.log('🚨 No callId found, rendering error state');
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">DEBUG: No Call ID</h1>
          <p className="text-lg">URL: {window.location.href}</p>
        </div>
      </div>
    );
  }
  
  console.log('🚨 Rendering coordinator call with ID:', callId);
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-green-500">DEBUG: COORDINATOR CALL WORKING!</h1>
        <p className="text-lg">Call ID: {callId}</p>
        <p className="text-muted-foreground">Component is executing successfully!</p>
        <p className="text-xs text-muted-foreground">URL: {window.location.href}</p>
      </div>
    </div>
  );
  
  /* COMPLEX CODE TEMPORARILY DISABLED FOR DEBUGGING
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [videoRotation, setVideoRotation] = useState(0);
  const { toast } = useToast();


  /* AUTHENTICATION TEMPORARILY DISABLED FOR DEBUGGING
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
  */

  /* QUERIES AND HOOKS TEMPORARILY DISABLED FOR DEBUGGING
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
  */

  // Keep the debug return for now - we'll add back full functionality once routing works
  console.log('🚨 Rendering coordinator call with ID:', callId);
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-green-500">DEBUG: COORDINATOR CALL WORKING!</h1>
        <p className="text-lg">Call ID: {callId}</p>
        <p className="text-muted-foreground">Component is executing successfully!</p>
        <p className="text-xs text-muted-foreground">URL: {window.location.href}</p>
        <Button onClick={() => window.history.back()} data-testid="button-back">
          Go Back to Dashboard
        </Button>
      </div>
    </div>
  );
}