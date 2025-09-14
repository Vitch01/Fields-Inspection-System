import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import { createPeerConnection, captureImageFromStream, capturePhotoFromCamera, createRotatedRecordingStream } from "@/lib/webrtc-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  text: string;
  sender: 'coordinator' | 'inspector';
  timestamp: Date;
}

interface EnhancedCaptureMetadata {
  categoryId: string;
  notes?: string;
  tags?: string[];
  inspectorLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  };
}

export function useWebRTC(callId: string, userRole: "coordinator" | "inspector") {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasPeerJoined, setHasPeerJoined] = useState(false);
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingSupported, setIsRecordingSupported] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);
  const [captureType, setCaptureType] = useState<'image' | 'video'>('image');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captureRequestIdRef = useRef<string | null>(null);
  const iceRestartInProgressRef = useRef<boolean>(false);
  const isManualDisconnectRef = useRef<boolean>(false);
  const { toast } = useToast();

  // Helper function to get supported mimeType
  const getSupportedMimeType = useCallback(() => {
    if (!window.MediaRecorder) {
      return null;
    }

    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus', 
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }, []);

  // Check MediaRecorder support on mount
  useEffect(() => {
    const checkRecordingSupport = () => {
      if (!window.MediaRecorder) {
        setIsRecordingSupported(false);
        return;
      }

      const supportedMimeType = getSupportedMimeType();
      setIsRecordingSupported(supportedMimeType !== null);
      
      if (!supportedMimeType && userRole === "coordinator") {
        toast({
          title: "Recording Not Supported",
          description: "Your browser doesn't support video recording. Recording features will be disabled.",
          variant: "destructive"
        });
      }
    };

    checkRecordingSupport();
  }, [getSupportedMimeType, userRole, toast]);

  // Create notification sound function
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
      
      // Clean up AudioContext after sound finishes to prevent resource leaks
      oscillator.onended = () => {
        audioContext.close();
      };
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Resume AudioContext in case it's suspended due to autoplay policies
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (error) {
      console.warn("Failed to play notification sound:", error);
    }
  }, []);

  // Core WebRTC functions that don't depend on sendMessage

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const captureImage = useCallback(async () => {
    if (!remoteStream && !localStream) {
      toast({
        title: "No video stream",
        description: "Cannot capture image without active video stream",
        variant: "destructive"
      });
      return;
    }

    setIsCapturing(true);
    captureRequestIdRef.current = Date.now().toString();

    try {
      const stream = remoteStream || localStream;
      if (!stream) return;

      const imageBlob = await captureImageFromStream(stream);
      
      // Upload the captured image
      const formData = new FormData();
      formData.append('image', imageBlob, `capture-${Date.now()}.png`);
      formData.append('callId', callId);
      formData.append('capturedBy', userRole);
      formData.append('rotation', '0');

      const response = await fetch(`/api/calls/${callId}/capture-image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.statusText}`);
      }

      toast({
        title: "Image captured",
        description: "Image has been saved successfully",
      });
    } catch (error) {
      console.error("Failed to capture image:", error);
      toast({
        title: "Capture failed",
        description: "Failed to capture and save image",
        variant: "destructive"
      });
    } finally {
      setIsCapturing(false);
      captureRequestIdRef.current = null;
    }
  }, [remoteStream, localStream, callId, userRole, toast]);

  const startRecording = useCallback(async () => {
    if (isRecording || !isRecordingSupported) {
      return;
    }

    const stream = remoteStream || localStream;
    if (!stream) {
      toast({
        title: "No stream available",
        description: "Cannot start recording without active video stream",
        variant: "destructive"
      });
      return;
    }

    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error('No supported MIME type found');
      }

      recordedChunksRef.current = [];
      
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
          
          // Upload the recorded video
          const formData = new FormData();
          formData.append('video', videoBlob, `recording-${Date.now()}.webm`);
          formData.append('callId', callId);
          formData.append('recordedBy', userRole);

          const response = await fetch(`/api/calls/${callId}/save-recording`, {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to upload video: ${response.statusText}`);
          }

          toast({
            title: "Recording saved",
            description: "Video recording has been saved successfully",
          });
        } catch (error) {
          console.error("Failed to save recording:", error);
          toast({
            title: "Save failed", 
            description: "Failed to save video recording",
            variant: "destructive"
          });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: "Video recording is now active",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording failed",
        description: "Could not start video recording",
        variant: "destructive"
      });
    }
  }, [isRecording, isRecordingSupported, remoteStream, localStream, getSupportedMimeType, callId, userRole, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "Recording stopped",
        description: "Processing and saving video...",
      });
    }
  }, [isRecording, toast]);


  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Define handleSignalingMessage function before using it
  async function handleSignalingMessage(message: any) {
    const pc = peerConnectionRef.current;

    try {
      switch (message.type) {
        case "offer":
          if (!pc) return;
          if (userRole === "inspector") {
            await createAnswer(message.data);
          }
          break;
        case "answer":
          if (!pc) return;
          if (userRole === "coordinator") {
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
          }
          break;
        case "ice-candidate":
          if (!pc) return;
          await pc.addIceCandidate(new RTCIceCandidate(message.data));
          break;
        case "chat-message":
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: message.data.text,
            sender: message.data.sender,
            timestamp: new Date()
          }]);
          setUnreadCount(prev => prev + 1);
          playNotificationSound();
          break;
        case "peer-joined":
          setHasPeerJoined(true);
          if (userRole === "coordinator") {
            setTimeout(() => createOffer(), 1000);
          }
          break;
        case "call-ended":
          endCall();
          break;
      }
    } catch (error) {
      console.error("Error handling signaling message:", error);
    }
  }

  const { sendMessage, isConnected: wsConnected } = useWebSocket(callId, userRole, {
    onMessage: handleSignalingMessage,
  });

  // Functions that depend on sendMessage - must come after useWebSocket
  const endCall = useCallback(() => {
    console.log("Ending call...");
    isManualDisconnectRef.current = true;
    
    // Send call ended message to the other peer
    sendMessage({
      type: "call-ended",
      callId,
      userId: userRole,
      data: { timestamp: Date.now() },
    });
    
    // Cleanup and navigate based on user role
    cleanup();
    
    // Navigate to appropriate page
    if (userRole === "coordinator") {
      window.location.href = "/coordinator/dashboard";
    } else {
      window.location.href = "/inspector/thank-you";
    }
  }, [callId, userRole, sendMessage]);

  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: userRole,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, message]);
    
    sendMessage({
      type: "chat-message",
      callId,
      userId: userRole,
      data: message,
    });
  }, [userRole, callId, sendMessage]);

  // Initialize local media stream
  useEffect(() => {
    initializeLocalStream();
    return () => {
      cleanup();
    };
  }, []);

  // Initialize peer connection when WebSocket is connected
  useEffect(() => {
    if (wsConnected && localStream) {
      initializePeerConnection();
    }
  }, [wsConnected, localStream]);

  async function initializeLocalStream() {
    try {
      // Use rear camera for inspector, front camera for coordinator
      const videoConstraints = userRole === "inspector" 
        ? { 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            facingMode: { exact: "environment" } // Rear camera
          }
        : { 
            width: 1280, 
            height: 720,
            facingMode: "user" // Front camera
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
    } catch (error) {
      console.error("Failed to get local stream:", error);
      
      // Fallback for inspector if rear camera fails
      if (userRole === "inspector") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          setLocalStream(fallbackStream);
          localStreamRef.current = fallbackStream;
          return;
        } catch (fallbackError) {
          console.error("Fallback camera failed:", fallbackError);
        }
      }
      
      toast({
        title: "Camera/Microphone Access Denied",
        description: "Please allow camera and microphone access to join the call",
        variant: "destructive",
      });
    }
  }

  async function initializePeerConnection() {
    const pc = await createPeerConnection();
    peerConnectionRef.current = pc;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Handle connection state changes with better diagnostics
    pc.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${pc.connectionState}`);
      const connected = pc.connectionState === "connected";
      setIsConnected(connected);
      if (connected) {
        setIsConnectionEstablished(true);
        console.log("WebRTC connection established successfully");
      } else if (pc.connectionState === "failed") {
        console.error("WebRTC connection failed - likely network issue");
        toast({
          title: "Connection Failed",
          description: "Unable to establish connection. If on mobile data, ensure you have a stable connection.",
          variant: "destructive",
        });
      } else if (pc.connectionState === "disconnected") {
        console.warn("WebRTC connection disconnected");
      }
    };

    // Handle ICE gathering state for better debugging
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${pc.iceGatheringState}`);
    };

    // Handle ICE connection state changes with improved restart logic
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.error(`ICE connection ${pc.iceConnectionState} - attempting restart`);
        // Attempt ICE restart with proper offer/answer negotiation
        handleIceRestart();
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        // Reset restart flag when connection is restored
        iceRestartInProgressRef.current = false;
      }
    };

    // Handle ICE candidates with detailed diagnostics
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate;
        
        // Enhanced ICE candidate logging for mobile debugging
        console.log('ICE Candidate Details:', {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address || 'N/A',
          port: candidate.port || 'N/A',
          priority: candidate.priority,
          component: candidate.component,
          foundation: candidate.foundation,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid,
          usernameFragment: candidate.usernameFragment
        });
        
        // Log candidate type for mobile connectivity analysis
        if (candidate.type === 'host') {
          console.log('✓ Host candidate - direct connection possible');
        } else if (candidate.type === 'srflx') {
          console.log('✓ Server reflexive candidate - STUN server working');
        } else if (candidate.type === 'relay') {
          console.log('✓ Relay candidate - TURN server working (essential for mobile)');
        } else if (candidate.type === 'prflx') {
          console.log('✓ Peer reflexive candidate - discovered during connectivity checks');
        }
        
        sendMessage({
          type: "ice-candidate",
          callId,
          userId: userRole,
          data: event.candidate,
        });
      } else {
        console.log("✓ ICE candidate gathering complete");
        
        // Log summary of gathered candidates for mobile debugging
        pc.getStats().then(stats => {
          const candidateTypes = new Set<string>();
          const localCandidates: any[] = [];
          
          stats.forEach(report => {
            if (report.type === 'local-candidate') {
              candidateTypes.add(report.candidateType);
              localCandidates.push({
                type: report.candidateType,
                protocol: report.protocol,
                address: report.address,
                port: report.port
              });
            }
          });
          
          console.log('ICE Gathering Summary:', {
            candidateTypes: Array.from(candidateTypes),
            totalLocalCandidates: localCandidates.length,
            hasRelayCandidates: candidateTypes.has('relay'),
            localCandidates: localCandidates
          });
          
          if (!candidateTypes.has('relay')) {
            console.warn('⚠️ No relay candidates found - mobile data connections may fail');
          } else {
            console.log('✓ Relay candidates available - mobile connectivity should work');
          }
        }).catch(err => console.warn('Failed to get candidate stats:', err));
      }
    };

    // Create offer if coordinator
    if (userRole === "coordinator") {
      createOffer();
    }
  }

  async function createOffer(iceRestart = false) {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      const offerOptions: RTCOfferOptions = {};
      if (iceRestart) {
        offerOptions.iceRestart = true;
        console.log("Creating offer with ICE restart");
      }
      
      const offer = await pc.createOffer(offerOptions);
      await pc.setLocalDescription(offer);
      
      sendMessage({
        type: "offer",
        callId,
        userId: userRole,
        data: offer,
      });
    } catch (error) {
      console.error("Failed to create offer:", error);
    }
  }

  // Handle ICE restart with proper offer/answer negotiation
  const handleIceRestart = useCallback(async () => {
    if (iceRestartInProgressRef.current) {
      console.log("ICE restart already in progress");
      return;
    }
    
    const pc = peerConnectionRef.current;
    if (!pc || pc.connectionState === "closed") {
      console.log("Cannot restart ICE - peer connection is closed");
      return;
    }
    
    iceRestartInProgressRef.current = true;
    
    try {
      if (userRole === "coordinator") {
        // Coordinator initiates ICE restart with new offer
        console.log("Coordinator initiating ICE restart");
        await createOffer(true);
      } else {
        // Inspector requests coordinator to initiate restart
        console.log("Inspector requesting ICE restart from coordinator");
        sendMessage({
          type: "ice-restart-request",
          callId,
          userId: userRole,
          data: { timestamp: Date.now() },
        });
      }
    } catch (error) {
      console.error("Failed to initiate ICE restart:", error);
      iceRestartInProgressRef.current = false;
    }
  }, [userRole, callId, sendMessage]);

  async function createAnswer(offer: RTCSessionDescriptionInit) {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      sendMessage({
        type: "answer",
        callId,
        userId: userRole,
        data: answer,
      });
    } catch (error) {
      console.error("Failed to create answer:", error);
    }
  }

  // Continue with the helper functions that were originally after handleSignalingMessage
  function cleanup() {
    isManualDisconnectRef.current = true;
    
    // Clear all timeouts and intervals
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    
    // Clear canvas cleanup function
    if (canvasCleanupRef.current) {
      canvasCleanupRef.current();
      canvasCleanupRef.current = null;
    }
    
    // Stop media recorder if recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Clean up media streams
    [localStreamRef.current, localStream, remoteStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
    });
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Reset states
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsConnectionEstablished(false);
    setHasPeerJoined(false);
    setIsRecording(false);
    setIsCapturing(false);
  }

  // Return all the functions and state that components need
  return {
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
    isRecording,
    isCapturing,
    startRecording,
    stopRecording,
  };
}
