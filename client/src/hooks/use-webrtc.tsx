import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import { useNetworkMonitor } from "./use-network-monitor";
import { createPeerConnection, createRecoveredPeerConnection, captureImageFromStream, capturePhotoFromCamera, createRotatedRecordingStream, checkNetworkCapabilities, getAdaptiveMediaConstraints, type NetworkCapabilities, type VideoQuality } from "@/lib/webrtc-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  text: string;
  sender: 'coordinator' | 'inspector';
  timestamp: Date;
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
  
  // New adaptive quality states
  const [networkCapabilities, setNetworkCapabilities] = useState<NetworkCapabilities | null>(null);
  const [currentVideoQuality, setCurrentVideoQuality] = useState<VideoQuality>('medium');
  const [isAdaptiveQualityEnabled, setIsAdaptiveQualityEnabled] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isNetworkTesting, setIsNetworkTesting] = useState(false);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captureRequestIdRef = useRef<string | null>(null);
  const iceRestartInProgressRef = useRef<boolean>(false);
  const connectionRestoreInProgressRef = useRef<boolean>(false);
  const networkChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastConnectionAttemptRef = useRef<number>(0);
  const networkTestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qualityDowngradeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  const { sendMessage, isConnected: wsConnected, wsRef } = useWebSocket(callId, userRole, {
    onMessage: handleSignalingMessage,
  });

  // Enhanced network change handler (declared before useNetworkMonitor)
  const handleNetworkChange = useCallback(async (newNetworkInfo: any) => {
    console.log('[WebRTC] Network change detected:', newNetworkInfo);
    
    // Don't trigger recovery too frequently
    const now = Date.now();
    const minInterval = 8000; // Fixed interval to avoid dependency issues
    if (now - lastConnectionAttemptRef.current < minInterval) {
      console.log('[WebRTC] Network change ignored - too frequent');
      return;
    }
    
    // If we're offline, wait for connection to restore
    if (!newNetworkInfo.isOnline) {
      console.log('[WebRTC] Going offline, waiting for connection restore');
      return;
    }
    
    // Check if we have an active peer connection that might be affected
    const pc = peerConnectionRef.current;
    if (!pc || pc.connectionState === 'closed') {
      console.log('[WebRTC] No active peer connection, network change ignored');
      return;
    }
    
    // If connection is already good, no need to restart
    if (pc.connectionState === 'connected' && pc.iceConnectionState === 'connected') {
      console.log('[WebRTC] Connection is healthy, network change ignored');
      return;
    }
    
    console.log('[WebRTC] Network change may have affected WebRTC connection, scheduling ICE restart');
    
    // Clear any existing network change timeout
    if (networkChangeTimeoutRef.current) {
      clearTimeout(networkChangeTimeoutRef.current);
    }
    
    // Fixed delay to avoid dependency on networkCapabilities
    const stabilizationDelay = 5000;
    networkChangeTimeoutRef.current = setTimeout(() => {
      handleIceRestart();
    }, stabilizationDelay);
    
  }, []); // Keep empty deps to prevent infinite loops
  
  // Handle connection restoration after network comes back online (declared before useNetworkMonitor)
  const handleConnectionRestore = useCallback(async () => {
    console.log('[WebRTC] Connection restored, checking if reconnection needed');
    
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] No peer connection, attempting to reinitialize');
      // Use refs to avoid dependencies
      if (wsRef.current && localStreamRef.current) {
        console.log('[WebRTC] Reinitializing peer connection after network restore');
        initializePeerConnection();
      }
      return;
    }
    
    // Check if connection needs recovery
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
      console.log('[WebRTC] Connection needs recovery after network restore');
      await handleConnectionRecovery();
    }
  }, []); // Remove dependencies to prevent loops

  // Monitor network changes and trigger connection recovery
  const { isOnline, networkInfo, isNetworkStable } = useNetworkMonitor({
    onNetworkChange: handleNetworkChange,
    onConnectionRestore: handleConnectionRestore,
  });

  // Initialize network detection but DON'T initialize media on mount for mobile compatibility
  useEffect(() => {
    // Only initialize network testing, not media stream
    initializeNetworkCapabilitiesOnly();
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

  // Initialize network capabilities only (not media stream) - for mobile compatibility
  async function initializeNetworkCapabilitiesOnly() {
    setIsNetworkTesting(true);
    
    try {
      console.log('[WebRTC] Starting network capability detection...');
      const capabilities = await checkNetworkCapabilities();
      console.log('[WebRTC] Network capabilities detected:', capabilities);
      
      setNetworkCapabilities(capabilities);
      
      // Set initial video quality based on network capabilities
      let initialQuality = capabilities.recommendedVideoQuality;
      
      // For very slow connections, be more conservative
      if (capabilities.quality === 'poor' || capabilities.latency > 5000) {
        initialQuality = userRole === 'inspector' ? 'audio-only' : 'low';
        toast({
          title: "Slow Network Detected",
          description: `Starting with ${initialQuality === 'audio-only' ? 'audio-only' : 'low quality video'} mode for better connection`,
          variant: "default"
        });
      } else if (capabilities.quality === 'fair') {
        initialQuality = 'low';
      }
      
      setCurrentVideoQuality(initialQuality);
      // DON'T initialize media stream here - wait for user interaction
      
    } catch (error) {
      console.error('Network detection failed, using medium quality:', error);
      setCurrentVideoQuality('medium');
      // DON'T initialize media stream here - wait for user interaction
    } finally {
      setIsNetworkTesting(false);
    }
  }

  // Initialize with network detection for adaptive quality (called after user interaction)
  async function initializeWithNetworkDetection() {
    const capabilities = networkCapabilities;
    const quality = currentVideoQuality;
    
    try {
      console.log('[WebRTC] Starting media initialization after user interaction...');
      await initializeLocalStream(quality, capabilities || undefined);
    } catch (error) {
      console.error('Media initialization failed:', error);
      await initializeLocalStream('medium');
    }
  }

  async function initializeLocalStream(videoQuality?: VideoQuality, capabilities?: NetworkCapabilities) {
    const quality = videoQuality || currentVideoQuality;
    const caps = capabilities || networkCapabilities;
    
    try {
      console.log(`[WebRTC] Initializing local stream with quality: ${quality}`);
      
      // Get adaptive media constraints based on network and role
      const mediaConstraints = getAdaptiveMediaConstraints(quality, userRole, caps || undefined);
      
      console.log('[WebRTC] Using media constraints:', mediaConstraints);
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      // Log actual stream settings for debugging
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(`[WebRTC] Actual video settings: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
      }
      
    } catch (error) {
      console.error("Failed to get local stream:", error);
      await handleMediaStreamError(error, quality);
    }
  }
  
  // Enhanced error handling with fallback strategies
  async function handleMediaStreamError(error: any, attemptedQuality: VideoQuality) {
    console.log(`[WebRTC] Media stream error with quality ${attemptedQuality}:`, error);
    
    // Try progressive fallback strategies
    if (attemptedQuality === 'high') {
      console.log('[WebRTC] High quality failed, trying medium...');
      setCurrentVideoQuality('medium');
      return initializeLocalStream('medium');
    } else if (attemptedQuality === 'medium') {
      console.log('[WebRTC] Medium quality failed, trying low...');
      setCurrentVideoQuality('low');
      return initializeLocalStream('low');
    } else if (attemptedQuality === 'low') {
      console.log('[WebRTC] Low quality failed, trying audio-only...');
      setCurrentVideoQuality('audio-only');
      return initializeLocalStream('audio-only');
    }
    
    // For inspector, try fallback camera without specific facing mode
    if (userRole === "inspector" && attemptedQuality !== 'audio-only') {
      try {
        console.log('[WebRTC] Trying fallback camera without specific facing mode...');
        // Try very basic constraints without any facing mode restrictions
        const basicConstraints: MediaStreamConstraints = {
          audio: { echoCancellation: true },
          video: { width: { ideal: 640 }, height: { ideal: 480 } } // No facingMode restriction
        };
        const fallbackStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        setLocalStream(fallbackStream);
        localStreamRef.current = fallbackStream;
        setCurrentVideoQuality('low');
        
        toast({
          title: "Camera Fallback",
          description: "Using available camera for video call",
          variant: "default"
        });
        return;
      } catch (fallbackError) {
        console.error("Fallback camera failed:", fallbackError);
        
        // Try even more basic constraints
        try {
          console.log('[WebRTC] Trying most basic video constraints...');
          const minimalConstraints: MediaStreamConstraints = {
            audio: true,
            video: true // Completely generic video request
          };
          const minimalStream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
          setLocalStream(minimalStream);
          localStreamRef.current = minimalStream;
          setCurrentVideoQuality('low');
          
          toast({
            title: "Basic Camera Access",
            description: "Using basic camera settings",
            variant: "default"
          });
          return;
        } catch (minimalError) {
          console.error("Even basic video failed:", minimalError);
        }
      }
    }
    
    // Final fallback: audio-only
    if (attemptedQuality !== 'audio-only') {
      try {
        console.log('[WebRTC] Trying audio-only fallback...');
        setCurrentVideoQuality('audio-only');
        return initializeLocalStream('audio-only');
      } catch (audioError) {
        console.error("Audio-only fallback failed:", audioError);
      }
    }
    
    // Complete failure
    toast({
      title: "Media Access Failed",
      description: "Unable to access camera or microphone. Please check permissions and try again.",
      variant: "destructive",
    });
  }

  function initializePeerConnection() {
    const pc = createPeerConnection();
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

    // Enhanced connection state changes with network transition handling
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state changed to: ${pc.connectionState}`);
      const connected = pc.connectionState === "connected";
      setIsConnected(connected);
      
      if (connected) {
        setIsConnectionEstablished(true);
        // Reset recovery flags when connection is restored
        iceRestartInProgressRef.current = false;
        connectionRestoreInProgressRef.current = false;
        console.log("[WebRTC] Connection established successfully");
        
        // Show success toast if this was a recovery
        if (lastConnectionAttemptRef.current > 0 && Date.now() - lastConnectionAttemptRef.current < 30000) {
          toast({
            title: "Connection Restored",
            description: "Video connection has been restored successfully",
            variant: "default"
          });
        }
      } else if (pc.connectionState === "failed") {
        console.error("[WebRTC] Connection failed - attempting recovery");
        
        // Don't show error immediately, try recovery first
        if (isOnline && isNetworkStable && !connectionRestoreInProgressRef.current) {
          console.log("[WebRTC] Attempting automatic connection recovery");
          setTimeout(() => handleConnectionRecovery(), 1000);
        } else {
          toast({
            title: "Connection Failed",
            description: "Unable to establish connection. Checking network...",
            variant: "destructive"
          });
        }
      } else if (pc.connectionState === "disconnected") {
        console.warn("[WebRTC] Connection disconnected - monitoring for recovery");
        
        // If we're online and network is stable, try to recover
        if (isOnline && isNetworkStable) {
          setTimeout(() => {
            const currentPc = peerConnectionRef.current;
            if (currentPc && currentPc.connectionState === "disconnected") {
              console.log("[WebRTC] Connection still disconnected, attempting recovery");
              handleConnectionRecovery();
            }
          }, 3000);
        }
      }
    };

    // Handle ICE gathering state for better debugging
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${pc.iceGatheringState}`);
    };

    // Enhanced ICE connection state changes with network transition handling
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        // Reset restart flags when ICE connection is restored
        iceRestartInProgressRef.current = false;
        connectionRestoreInProgressRef.current = false;
        console.log("[WebRTC] ICE connection established");
      } else if (pc.iceConnectionState === "failed") {
        console.error("[WebRTC] ICE connection failed - attempting recovery");
        
        if (isOnline && !iceRestartInProgressRef.current) {
          // Try ICE restart first
          setTimeout(() => handleIceRestart(), 1000);
        }
      } else if (pc.iceConnectionState === "disconnected") {
        console.warn("[WebRTC] ICE connection disconnected");
        
        // If we're online and network seems stable, monitor for recovery
        if (isOnline && isNetworkStable) {
          setTimeout(() => {
            const currentPc = peerConnectionRef.current;
            if (currentPc && currentPc.iceConnectionState === "disconnected") {
              console.log("[WebRTC] ICE still disconnected, attempting restart");
              if (!iceRestartInProgressRef.current) {
                handleIceRestart();
              }
            }
          }, 5000);
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`ICE candidate type: ${event.candidate.type}, protocol: ${event.candidate.protocol}`);
        sendMessage({
          type: "ice-candidate",
          callId,
          userId: userRole,
          data: event.candidate,
        });
      } else {
        console.log("ICE candidate gathering complete");
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

  // Comprehensive connection recovery
  const handleConnectionRecovery = useCallback(async () => {
    if (connectionRestoreInProgressRef.current) {
      console.log('[WebRTC] Connection recovery already in progress');
      return;
    }
    
    connectionRestoreInProgressRef.current = true;
    lastConnectionAttemptRef.current = Date.now();
    
    try {
      console.log('[WebRTC] Starting connection recovery process');
      
      // Simplified recovery without network capability checks to avoid deps
      const pc = peerConnectionRef.current;
      
      if (!pc || pc.connectionState === 'closed') {
        // Create new peer connection
        console.log('[WebRTC] Creating new peer connection for recovery');
        initializePeerConnection();
      } else {
        // Try ICE restart first
        console.log('[WebRTC] Attempting ICE restart for recovery');
        await handleIceRestart();
        
        // If ICE restart doesn't work after 10 seconds, recreate connection
        setTimeout(() => {
          const currentPc = peerConnectionRef.current;
          if (currentPc && 
              (currentPc.connectionState === 'failed' || currentPc.iceConnectionState === 'failed')) {
            console.log('[WebRTC] ICE restart failed, recreating peer connection');
            
            // Close old connection
            currentPc.close();
            peerConnectionRef.current = null;
            
            // Create new connection using refs
            if (wsRef.current && localStreamRef.current) {
              initializePeerConnection();
            }
          }
        }, 10000);
      }
      
      toast({
        title: "Reconnecting",
        description: "Attempting to restore video connection after network change",
        variant: "default"
      });
      
    } catch (error) {
      console.error('[WebRTC] Connection recovery failed:', error);
      toast({
        title: "Connection Issue",
        description: "Having trouble reconnecting. Please check your network connection.",
        variant: "destructive"
      });
    } finally {
      connectionRestoreInProgressRef.current = false;
    }
  }, []); // Remove all dependencies to prevent loops
  
  // Manual quality controls for users
  const changeVideoQuality = useCallback(async (newQuality: VideoQuality) => {
    if (newQuality === currentVideoQuality) return;
    
    console.log(`[WebRTC] Changing video quality from ${currentVideoQuality} to ${newQuality}`);
    setCurrentVideoQuality(newQuality);
    
    // Stop current stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Initialize with new quality
    try {
      await initializeLocalStream(newQuality);
      
      // Update peer connection with new stream
      const pc = peerConnectionRef.current;
      if (pc && localStreamRef.current) {
        // Remove old tracks
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            pc.removeTrack(sender);
          }
        });
        
        // Add new tracks
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
        
        // Renegotiate if coordinator
        if (userRole === 'coordinator') {
          await createOffer();
        }
      }
      
      toast({
        title: "Quality Changed",
        description: `Video quality changed to ${newQuality === 'audio-only' ? 'audio-only' : newQuality} mode`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Failed to change video quality:', error);
      toast({
        title: "Quality Change Failed",
        description: "Unable to change video quality. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentVideoQuality, userRole, toast]);
  
  // Enhanced ICE restart with better error handling
  const handleIceRestart = useCallback(async () => {
    if (iceRestartInProgressRef.current) {
      console.log("[WebRTC] ICE restart already in progress");
      return;
    }
    
    const pc = peerConnectionRef.current;
    if (!pc || pc.connectionState === "closed") {
      console.log("[WebRTC] Cannot restart ICE - peer connection is closed");
      return;
    }
    
    iceRestartInProgressRef.current = true;
    
    try {
      console.log(`[WebRTC] Starting ICE restart - current connection state: ${pc.connectionState}, ICE state: ${pc.iceConnectionState}`);
      
      if (userRole === "coordinator") {
        // Coordinator initiates ICE restart with new offer
        console.log("[WebRTC] Coordinator initiating ICE restart with new offer");
        await createOffer(true);
      } else {
        // Inspector requests coordinator to initiate restart
        console.log("[WebRTC] Inspector requesting ICE restart from coordinator");
        sendMessage({
          type: "ice-restart-request",
          callId,
          userId: userRole,
          data: { 
            timestamp: Date.now(),
            reason: 'network-change',
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState
          },
        });
      }
      
      // Reset ICE restart flag after timeout if not manually reset
      setTimeout(() => {
        if (iceRestartInProgressRef.current) {
          console.log('[WebRTC] ICE restart timeout, resetting flag');
          iceRestartInProgressRef.current = false;
        }
      }, 15000);
      
    } catch (error) {
      console.error("[WebRTC] Failed to initiate ICE restart:", error);
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
            await pc.setRemoteDescription(message.data);
          }
          break;

        case "ice-candidate":
          if (!pc) return;
          // Only add ICE candidate if we have remote description set
          if (pc.remoteDescription) {
            await pc.addIceCandidate(message.data);
          }
          break;

        case "user-joined":
          console.log("User joined:", message.userId);
          // Track that a peer has joined (only if it's not our own join message)
          if (message.userId !== userRole) {
            setHasPeerJoined(true);
          }
          // Initiate offer when someone joins (for coordinator)
          if (userRole === "coordinator" && message.userId !== userRole) {
            setTimeout(() => createOffer(), 1000);
          }
          break;

        case "user-left":
          console.log("User left:", message.userId);
          // Only handle if it's not our own leave message and we had a peer connection
          if (message.userId !== userRole && (hasPeerJoined || isConnectionEstablished)) {
            toast({
              title: "Call Ended",
              description: "The other participant has left the call",
              variant: "default"
            });
            
            // Clean up for both roles and redirect both to appropriate pages
            setTimeout(() => {
              cleanup();
              setHasPeerJoined(false);
              setIsConnectionEstablished(false);
              
              // Different redirect behavior for inspectors vs coordinators
              if (userRole === "coordinator") {
                window.location.href = "/";
              } else {
                // Inspector goes back to join page when call ends
                window.location.href = `/join/${callId}`;
              }
            }, 1500);
          }
          break;

        case "image-captured":
          toast({
            title: "Image Captured",
            description: "A new inspection image has been captured",
          });
          break;

        case "chat-message":
          if (message.data && message.data.text && message.userId !== userRole) {
            const newMessage: ChatMessage = {
              id: message.data.id,
              text: message.data.text,
              sender: message.userId === 'coordinator' ? 'coordinator' : 'inspector',
              timestamp: new Date(message.data.timestamp)
            };
            setChatMessages(prev => [...prev, newMessage]);
            
            // Increment unread count for incoming messages
            setUnreadCount(prev => prev + 1);
            
            // Play notification sound for incoming messages
            playNotificationSound();
            
            // Show toast notification
            toast({
              title: "New Message",
              description: `Message from ${message.userId === 'coordinator' ? 'Coordinator' : 'Inspector'}`,
              variant: "default"
            });
          }
          break;

        case "capture-request":
          // Only handle if we're the inspector
          if (userRole === "inspector" && message.userId === "coordinator") {
            const requestId = message.data?.requestId;
            console.log("Received remote capture request from coordinator with ID:", requestId);
            toast({
              title: "Capturing Photo",
              description: "Coordinator has requested a photo capture",
            });
            
            // Trigger capture on inspector's device with request ID
            handleRemoteCapture(message.data?.videoRotation || 0, requestId);
          }
          break;

        case "capture-complete":
          // Only handle if we're the coordinator and request ID matches
          if (userRole === "coordinator" && message.userId === "inspector") {
            const responseId = message.data?.requestId;
            console.log("Capture completed by inspector, request ID:", responseId);
            
            // Only process if this is for our current request
            if (responseId === captureRequestIdRef.current) {
              // Clear the capture timeout
              if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
              }
              
              // Clear loading state and request ID
              setIsCapturing(false);
              captureRequestIdRef.current = null;
            } else {
              console.log("Ignoring capture complete for different request ID");
            }
            
            // Invalidate the images query to refresh the gallery
            queryClient.invalidateQueries({ queryKey: ['/api/calls', callId, 'images'] });
            
            toast({
              title: "Photo Captured",
              description: "Inspector's device has captured a high-quality photo",
            });
          }
          break;

        case "capture-error":
          // Only handle if we're the coordinator and request ID matches
          if (userRole === "coordinator" && message.userId === "inspector") {
            const responseId = message.data?.requestId;
            console.error("Capture failed on inspector, request ID:", responseId, message.data);
            
            // Only process if this is for our current request
            if (responseId === captureRequestIdRef.current) {
              // Clear the capture timeout
              if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
              }
              
              // Clear loading state and request ID
              setIsCapturing(false);
              captureRequestIdRef.current = null;
            } else {
              console.log("Ignoring capture error for different request ID");
            }
            
            // Still try to refresh in case there were partial captures
            queryClient.invalidateQueries({ queryKey: ['/api/calls', callId, 'images'] });
            
            toast({
              title: "Capture Failed",
              description: message.data?.error || "Failed to capture photo from inspector's device",
              variant: "destructive",
            });
          }
          break;
          
        case "ice-restart-request":
          // Handle ICE restart request from inspector
          if (userRole === "coordinator" && message.userId === "inspector") {
            console.log("Received ICE restart request from inspector");
            handleIceRestart();
          }
          break;
      }
    } catch (error) {
      console.error("Error handling signaling message:", error);
    }
  }

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

  // Handle remote capture request from coordinator (for inspector only)
  const handleRemoteCapture = useCallback(async (videoRotation = 0, requestId?: string) => {
    if (userRole !== "inspector") return;
    
    try {
      console.log("Starting remote capture on inspector device...");
      
      // Try to use existing stream first if available, otherwise use new camera
      let imageBlob: Blob;
      
      if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
        // Use existing stream from call for faster capture
        console.log("Using existing video stream for capture");
        imageBlob = await captureImageFromStream(localStreamRef.current);
      } else {
        // Fall back to using device camera directly
        console.log("Using device camera for high-quality capture");
        imageBlob = await capturePhotoFromCamera();
      }
      
      // Ensure we have a valid blob
      if (!imageBlob || imageBlob.size === 0) {
        throw new Error('Failed to create image blob');
      }
      
      console.log(`Captured image blob: size=${imageBlob.size}, type=${imageBlob.type}`);
      
      // Create a proper File object from the blob for better multer compatibility
      const timestamp = Date.now();
      const filename = `inspection-${timestamp}.jpg`;
      const imageFile = new File([imageBlob], filename, { 
        type: 'image/jpeg',
        lastModified: timestamp 
      });
      
      console.log(`Created File object: name=${imageFile.name}, size=${imageFile.size}, type=${imageFile.type}`);
      
      // Upload image to server using proper FormData
      const formData = new FormData();
      formData.append('image', imageFile);  // Use the File object
      formData.append('filename', filename);
      formData.append('videoRotation', videoRotation.toString());
      
      console.log('Uploading image to server...');
      
      // Make request without manually setting Content-Type (let FormData handle it)
      const response = await fetch(`/api/calls/${callId}/images`, {
        method: 'POST',
        body: formData,
        // Important: Do not set Content-Type header - FormData sets boundary automatically
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Send success message back to coordinator with request ID
      sendMessage({
        type: "capture-complete",
        callId,
        userId: userRole,
        data: { 
          timestamp: Date.now(), 
          imageId: result.id,
          filename: filename,
          requestId: requestId
        },
      });

      toast({
        title: "Photo Captured",
        description: "High-quality inspection photo captured and uploaded",
      });

    } catch (error) {
      console.error("Failed to capture image remotely:", error);
      
      // Send error message back to coordinator with request ID
      sendMessage({
        type: "capture-error",
        callId,
        userId: userRole,
        data: { 
          error: error instanceof Error ? error.message : "Failed to capture photo",
          requestId: requestId
        },
      });
      
      toast({
        title: "Capture Failed",
        description: "Failed to capture photo with camera",
        variant: "destructive",
      });
    }
  }, [callId, userRole, sendMessage, toast]);

  const captureImage = useCallback(async (videoRotation = 0, retryCount = 0) => {
    const MAX_RETRIES = networkCapabilities?.quality === 'poor' ? 4 : 2; // More retries for poor networks
    // Dynamic timeout based on network quality - much longer for slow networks
    const CAPTURE_TIMEOUT = networkCapabilities?.quality === 'poor' ? 30000 : // 30 seconds for poor networks
                           networkCapabilities?.quality === 'fair' ? 20000 : // 20 seconds for fair networks
                           15000; // 15 seconds for good/excellent networks
    
    try {
      if (userRole === "coordinator") {
        // For coordinator: Send request to inspector to capture
        if (!isConnected || !remoteStream) {
          toast({
            title: "Capture Failed",
            description: "Inspector is not connected",
            variant: "destructive",
          });
          return;
        }

        // Don't allow multiple captures at once
        if (isCapturing) {
          toast({
            title: "Please Wait",
            description: "A photo capture is already in progress",
          });
          return;
        }

        // Set loading state and generate unique request ID
        setIsCapturing(true);
        const requestId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        captureRequestIdRef.current = requestId;

        // Send capture request to inspector with unique ID
        sendMessage({
          type: "capture-request",
          callId,
          userId: userRole,
          data: { 
            videoRotation: videoRotation,
            timestamp: Date.now(),
            retryCount: retryCount,
            requestId: requestId
          },
        });

        // Set up timeout (10 seconds for mobile networks)
        captureTimeoutRef.current = setTimeout(() => {
          // Only timeout if this is still the active request
          if (captureRequestIdRef.current === requestId) {
            setIsCapturing(false);
            captureTimeoutRef.current = null;
            captureRequestIdRef.current = null;
            
            // Retry logic
            if (retryCount < MAX_RETRIES) {
              toast({
                title: "Retrying Capture",
                description: `Attempt ${retryCount + 2} of ${MAX_RETRIES + 1}...`,
              });
              // Retry after a short delay
              setTimeout(() => {
                captureImage(videoRotation, retryCount + 1);
              }, 1000);
            } else {
              toast({
                title: "Capture Failed",
                description: "Unable to capture photo after multiple attempts. Please check the connection and try again.",
                variant: "destructive",
              });
            }
          }
        }, CAPTURE_TIMEOUT);

        if (retryCount === 0) {
          toast({
            title: "Requesting Photo",
            description: "Triggering inspector's camera to capture photo...",
          });
        }

        // Return early - success/failure will be handled by message handlers
        return;
      } else {
        // For inspector: This function should not be called directly anymore
        // Remote capture is handled by handleRemoteCapture
        console.warn("Direct capture not allowed for inspector - use remote capture");
        return;
      }
    } catch (error) {
      console.error("Failed to initiate capture:", error);
      setIsCapturing(false);
      
      // Retry on error if we haven't exceeded retry count
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          captureImage(videoRotation, retryCount + 1);
        }, 1000);
      } else {
        toast({
          title: "Capture Failed",
          description: "Failed to initiate photo capture after multiple attempts",
          variant: "destructive",
        });
      }
    }
  }, [callId, userRole, remoteStream, sendMessage, toast, isConnected, isCapturing]);

  const sendChatMessage = useCallback((text: string) => {
    const messageData = {
      id: Date.now().toString(),
      text: text,
      timestamp: new Date().toISOString(),
    };

    // Send the message via WebSocket
    sendMessage({
      type: "chat-message",
      callId,
      userId: userRole,
      data: messageData
    });

    // Add to local state immediately
    const newMessage: ChatMessage = {
      id: messageData.id,
      text: messageData.text,
      sender: userRole,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, newMessage]);
  }, [callId, userRole, sendMessage]);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const startRecording = useCallback(async (videoRotation = 0) => {
    if (userRole !== "coordinator") {
      toast({
        title: "Recording Error",
        description: "Only coordinators can record inspections",
        variant: "destructive"
      });
      return;
    }

    // Use remote stream if available, otherwise use local stream for testing
    const streamToRecord = remoteStream || localStream;
    if (!streamToRecord) {
      toast({
        title: "Recording Error",
        description: "No video stream available for recording",
        variant: "destructive"
      });
      return;
    }

    if (!isRecordingSupported) {
      toast({
        title: "Recording Not Supported",
        description: "Your browser doesn't support video recording",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      toast({
        title: "Already Recording",
        description: "Recording is already in progress",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use direct recording to preserve original video orientation
      // Rotation will be applied via CSS during playback
      const recordingStream = streamToRecord;
      canvasCleanupRef.current = null;

      const supportedMimeType = getSupportedMimeType();
      if (!supportedMimeType) {
        throw new Error('No supported video format found');
      }

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType: supportedMimeType
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const supportedMimeType = getSupportedMimeType();
        const mimeTypeForBlob = supportedMimeType || 'video/webm';
        
        // Strip codec information for the blob and file type
        const baseMimeType = mimeTypeForBlob.split(';')[0]; // Remove codec info
        
        const blob = new Blob(recordedChunksRef.current, { type: baseMimeType });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = baseMimeType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `inspection-${callId}-${timestamp}.${extension}`;
        
        // Save recording to server
        try {
          // Create a File object from the blob with the base MIME type
          const videoFile = new File([blob], filename, { 
            type: baseMimeType 
          });
          
          const formData = new FormData();
          formData.append('video', videoFile);
          formData.append('callId', callId);
          formData.append('timestamp', new Date().toISOString());
          formData.append('videoRotation', videoRotation.toString());
          
          const response = await fetch('/api/recordings', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown server error');
            throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errorText}`);
          }
          
          // Try to parse response, but don't fail if it's not JSON
          let responseData;
          try {
            responseData = await response.json();
          } catch {
            responseData = { success: true };
          }
          
          toast({
            title: "Recording Saved",
            description: "Inspection video has been saved successfully",
            variant: "default"
          });
        } catch (error) {
          console.error('Failed to save recording:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          toast({
            title: "Save Failed",
            description: `Failed to save recording: ${errorMessage}`,
            variant: "destructive"
          });
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Inspection recording has begun",
        variant: "default"
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Clean up canvas elements if they were created
      if (canvasCleanupRef.current) {
        try {
          canvasCleanupRef.current();
          canvasCleanupRef.current = null;
        } catch (cleanupError) {
          console.error('Error cleaning up canvas after recording failure:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Recording Error",
        description: `Failed to start recording: ${errorMessage}`,
        variant: "destructive"
      });
      // Reset recording state if it was set
      setIsRecording(false);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
    }
  }, [remoteStream, localStreamRef, userRole, callId, toast, isRecordingSupported, isRecording, getSupportedMimeType]);

  const stopRecording = useCallback(() => {
    // Clean up canvas recording elements first
    if (canvasCleanupRef.current) {
      try {
        canvasCleanupRef.current();
        canvasCleanupRef.current = null;
      } catch (error) {
        console.error('Error cleaning up canvas recording:', error);
      }
    }
    
    if (mediaRecorderRef.current) {
      try {
        // Only stop if not already stopping/stopped
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
      mediaRecorderRef.current = null;
    }
    
    if (isRecording) {
      setIsRecording(false);
      toast({
        title: "Recording Stopped",
        description: "Recording has been stopped and will be saved",
        variant: "default"
      });
    }
  }, [isRecording, toast]);

  const endCall = useCallback(async () => {
    try {
      // Stop recording first if it's active
      if (isRecording) {
        stopRecording();
      }
      
      console.log(`${userRole} ending call ${callId}`);
      
      // Update call status to completely end the call
      await apiRequest("PATCH", `/api/calls/${callId}/status`, { status: "ended" });
      console.log("Call status updated to ended");
      
      // Notify other participants that call is ending
      sendMessage({
        type: "leave-call",
        callId,
        userId: userRole,
      });
      console.log("Leave call message sent");

      // Show confirmation that call is ending
      toast({
        title: "Call Ended",
        description: "The inspection call has been terminated",
        variant: "default"
      });

      // Cleanup all resources
      cleanup();
      
      // Different redirect behavior for inspectors vs coordinators
      setTimeout(() => {
        if (userRole === "inspector") {
          // Redirect inspector to thank you page
          window.location.href = "/inspector-thank-you";
        } else {
          window.location.href = "/";
        }
      }, 1000); // Small delay to ensure cleanup completes
      
    } catch (error) {
      console.error("Failed to end call:", error);
      // Force cleanup and redirect even if API call fails
      cleanup();
      toast({
        title: "Call Ended",
        description: "Connection terminated (some errors occurred)",
        variant: "destructive"
      });
      setTimeout(() => {
        if (userRole === "inspector") {
          // Redirect inspector to thank you page
          window.location.href = "/inspector-thank-you";
        } else {
          window.location.href = "/";
        }
      }, 1000);
    }
  }, [callId, userRole, sendMessage, isRecording, stopRecording, toast]);

  function cleanup() {
    // Clean up capture timeout
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    
    // Clean up network change timeout
    if (networkChangeTimeoutRef.current) {
      clearTimeout(networkChangeTimeoutRef.current);
      networkChangeTimeoutRef.current = null;
    }
    
    // Reset recovery flags
    iceRestartInProgressRef.current = false;
    connectionRestoreInProgressRef.current = false;
    lastConnectionAttemptRef.current = 0;
    
    // Clean up canvas recording elements first
    if (canvasCleanupRef.current) {
      try {
        canvasCleanupRef.current();
        canvasCleanupRef.current = null;
      } catch (error) {
        console.error('Error cleaning up canvas recording during cleanup:', error);
      }
    }
    
    // Always stop recording if MediaRecorder exists, regardless of isRecording state
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error('Error stopping MediaRecorder during cleanup:', error);
      }
      mediaRecorderRef.current = null;
    }
    
    // Always reset recording state
    if (isRecording) {
      setIsRecording(false);
    }
    
    // Stop all media tracks to revoke camera and microphone permissions
    if (localStreamRef.current) {
      console.log('Stopping media tracks and revoking camera/microphone permissions');
      const tracks = localStreamRef.current.getTracks();
      tracks.forEach(track => {
        console.log(`Stopping ${track.kind} track (${track.label})`);
        track.stop();
        // Force release track reference
        track.enabled = false;
      });
      
      // Clear the stream reference completely
      localStreamRef.current = null;
      console.log('All media tracks stopped and permissions revoked');
    }
    
    // Also ensure local video elements are cleared
    const localVideoElements = document.querySelectorAll('video[data-testid="video-local-stream"], video[data-testid="video-local-fullscreen"]');
    localVideoElements.forEach(video => {
      if (video instanceof HTMLVideoElement) {
        video.srcObject = null;
        video.load(); // Force video element to release resources
      }
    });
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setHasPeerJoined(false);
    setIsConnectionEstablished(false);
  }

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
    isRecordingSupported,
    isCapturing,
    startRecording,
    stopRecording,
    // Expose function to start media after user interaction (mobile fix)
    startLocalMedia: initializeWithNetworkDetection,
  };
}
