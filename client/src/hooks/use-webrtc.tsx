import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import { createPeerConnection, createPeerConnectionForMobile, captureImageFromStream, capturePhotoFromCamera, createRotatedRecordingStream, getAdaptiveVideoConstraints, ConnectionQualityMonitor } from "@/lib/webrtc-utils";
import { apiRequest } from "@/lib/queryClient";
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
  const [videoQuality, setVideoQuality] = useState<'minimal' | 'low' | 'medium' | 'high'>('minimal'); // Start with minimal quality
  const [connectionQuality, setConnectionQuality] = useState<'poor' | 'fair' | 'good'>('fair');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const qualityMonitorRef = useRef<ConnectionQualityMonitor | null>(null);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null); // Buffer offer before PC exists
  const pendingGlobalCandidatesRef = useRef<RTCIceCandidateInit[]>([]); // Buffer ICE before PC exists
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

  // Forward declare handleSignalingMessage for WebSocket hook
  const handleSignalingMessageRef = useRef<(message: any) => void>();
  
  // Initialize WebSocket connection with ref callback
  const { sendMessage, isConnected: wsConnected } = useWebSocket(callId, userRole, {
    onMessage: (message) => handleSignalingMessageRef.current?.(message),
  });

  // Helper functions that don't depend on other callbacks
  const flushPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    console.log(`Flushing ${pendingRemoteCandidatesRef.current.length} buffered ICE candidates`);
    for (const candidate of pendingRemoteCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Failed to add buffered ICE candidate:", error);
      }
    }
    pendingRemoteCandidatesRef.current = []; // Clear the buffer
  }, []);

  // Upgrade video quality while maintaining connection
  async function upgradeVideoQuality(newQuality: 'minimal' | 'low' | 'medium' | 'high') {
    if (!peerConnectionRef.current || videoQuality === newQuality) {
      return;
    }
    
    try {
      console.log(`Upgrading video quality from ${videoQuality} to ${newQuality}`);
      
      // Get new stream with better quality
      const constraints = getAdaptiveVideoConstraints(userRole, newQuality);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace video track in peer connection
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
        
        // Stop old stream tracks
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => track.stop());
        }
        
        // Update stream with new video track and existing audio
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        const composedStream = new MediaStream();
        composedStream.addTrack(videoTrack);
        if (audioTrack) {
          composedStream.addTrack(audioTrack);
        }
        
        setLocalStream(composedStream);
        localStreamRef.current = composedStream;
        setVideoQuality(newQuality);
        
        console.log(`Successfully upgraded to ${newQuality} quality`);
      }
    } catch (error) {
      console.error(`Failed to upgrade to ${newQuality} quality:`, error);
    }
  }

  // Setup quality monitoring for adaptive video quality
  const setupQualityMonitoring = useCallback((pc: RTCPeerConnection) => {
    // Clean up existing monitor
    if (qualityMonitorRef.current) {
      qualityMonitorRef.current.stopMonitoring();
    }
    
    // Create new monitor
    const monitor = new ConnectionQualityMonitor(pc);
    qualityMonitorRef.current = monitor;
    
    // Handle quality changes
    monitor.onQualityChange((quality) => {
      setConnectionQuality(quality);
      
      // Adapt video quality based on connection quality
      const currentQuality = videoQuality;
      let targetQuality: 'minimal' | 'low' | 'medium' | 'high' = currentQuality;
      
      if (quality === 'poor' && currentQuality !== 'minimal') {
        // Downgrade quality on poor connection
        targetQuality = currentQuality === 'high' ? 'medium' : 
                       currentQuality === 'medium' ? 'low' : 'minimal';
        console.log(`Poor connection detected, downgrading from ${currentQuality} to ${targetQuality}`);
      } else if (quality === 'good' && currentQuality !== 'high') {
        // Upgrade quality on good connection (but gradually)
        if (currentQuality === 'minimal') {
          targetQuality = 'low';
        } else if (currentQuality === 'low' && Math.random() > 0.7) { // Only upgrade 30% of the time
          targetQuality = 'medium';
        }
        console.log(`Good connection detected, upgrading from ${currentQuality} to ${targetQuality}`);
      }
      
      // Apply quality change if different
      if (targetQuality !== currentQuality) {
        setTimeout(() => {
          upgradeVideoQuality(targetQuality);
        }, 2000); // Wait 2 seconds before changing quality
      }
    });
    
    // Start monitoring
    monitor.startMonitoring();
  }, [videoQuality]);

  const createOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log(`[${userRole}] Cannot create offer - no peer connection`);
      return;
    }
    console.log(`[${userRole}] Creating offer...`);

    try {
      const offer = await pc.createOffer();
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
  }, [callId, userRole, sendMessage]);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(offer);
      
      // Flush buffered ICE candidates after setting remote description
      await flushPendingCandidates();
      
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
  }, [callId, userRole, sendMessage, flushPendingCandidates]);

  const initializePeerConnection = useCallback(async () => {
    console.log(`[${userRole}] Creating peer connection`);
    // For inspector on mobile, force TURN-only for better reliability
    const pc = userRole === "inspector" 
      ? createPeerConnectionForMobile() 
      : createPeerConnection();
    peerConnectionRef.current = pc;
    console.log(`[${userRole}] Peer connection created`);

    // Add local stream tracks with bitrate limiting for mobile
    if (localStreamRef.current) {
      console.log(`[${userRole}] Adding ${localStreamRef.current.getTracks().length} tracks to peer connection`);
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[${userRole}] Adding ${track.kind} track (id: ${track.id}, enabled: ${track.enabled})`);
        const sender = pc.addTrack(track, localStreamRef.current!);
        
        // Limit initial bitrate for inspector on mobile
        if (userRole === "inspector" && track.kind === "video") {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 150000; // 150kbps initial
          params.encodings[0].scaleResolutionDownBy = 2; // Scale down resolution
          sender.setParameters(params).catch(e => console.error("Failed to set bitrate:", e));
        }
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`[${userRole}] Received remote track:`, event.track.kind);
      setRemoteStream(event.streams[0]);
      console.log(`[${userRole}] Remote stream set:`, event.streams[0]);
    };

    // Handle connection state changes with auto-recovery
    let connectionCheckTimer: number | null = null;
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection state changed: ${state}`);
      
      const connected = state === "connected";
      setIsConnected(connected);
      
      if (connected) {
        setIsConnectionEstablished(true);
        // Clear any recovery timer
        if (connectionCheckTimer) {
          clearTimeout(connectionCheckTimer);
          connectionCheckTimer = null;
        }
        // Start quality monitoring once connected
        setupQualityMonitoring(pc);
      } else if (state === "failed" || state === "disconnected") {
        // Start recovery timer
        if (!connectionCheckTimer) {
          connectionCheckTimer = window.setTimeout(() => {
            console.log("Connection lost, attempting ICE restart");
            // Trigger ICE restart
            if (pc.restartIce) {
              pc.restartIce();
              // We'll recreate offer in a separate effect
            }
          }, 5000); // Wait 5 seconds before restarting
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice-candidate",
          callId,
          userId: userRole,
          data: event.candidate,
        });
      }
    };

    // Process any globally buffered ICE candidates
    if (pendingGlobalCandidatesRef.current.length > 0) {
      console.log(`Processing ${pendingGlobalCandidatesRef.current.length} globally buffered ICE candidates`);
      // Move global candidates to the regular buffer
      pendingRemoteCandidatesRef.current.push(...pendingGlobalCandidatesRef.current);
      pendingGlobalCandidatesRef.current = [];
      
      // If we have remote description, flush them now
      if (pc.remoteDescription) {
        await flushPendingCandidates();
      }
    }
    
    // Return true to indicate success
    return true;
  }, [callId, userRole, sendMessage, setupQualityMonitoring, flushPendingCandidates]);

  // Don't auto-initialize stream - wait for user gesture (join button)
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Initialize peer connection when WebSocket is connected
  useEffect(() => {
    console.log(`[${userRole}] Checking peer connection init: wsConnected=${wsConnected}, hasLocalStream=${!!localStream}, hasPeerConnection=${!!peerConnectionRef.current}`);
    if (wsConnected && localStream && !peerConnectionRef.current) {
      console.log(`[${userRole}] All conditions met, initializing peer connection`);
      console.log(`[${userRole}] Local stream tracks available:`, localStream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled})));
      
      initializePeerConnection().then(() => {
        console.log(`[${userRole}] Peer connection initialized successfully`);
        // After peer connection is initialized, handle role-specific logic
        if (userRole === "coordinator") {
          // Coordinator creates offer immediately after tracks are added
          console.log("[coordinator] Creating initial offer after PC init");
          // Small delay to ensure tracks are fully registered
          setTimeout(() => {
            console.log("[coordinator] Creating offer now");
            createOffer();
          }, 100);
        } else if (userRole === "inspector" && pendingOfferRef.current) {
          // Inspector processes buffered offer if any
          console.log("[inspector] Processing buffered offer after PC init");
          createAnswer(pendingOfferRef.current);
          pendingOfferRef.current = null;
        }
      }).catch(error => {
        console.error(`[${userRole}] Failed to initialize peer connection:`, error);
      });
    }
  }, [wsConnected, localStream, userRole, initializePeerConnection, createOffer, createAnswer]);

  async function initializeLocalStream() {
    await initializeStreamWithQuality(videoQuality);
  }

  async function initializeStreamWithQuality(quality: 'minimal' | 'low' | 'medium' | 'high') {
    try {
      console.log(`Initializing video stream with ${quality} quality`);
      
      // Get adaptive constraints based on quality level
      const constraints = getAdaptiveVideoConstraints(userRole, quality);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop existing stream if upgrading quality
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      setVideoQuality(quality);
      
      console.log(`Successfully initialized ${quality} quality video: ${stream.getVideoTracks()[0]?.getSettings().width}x${stream.getVideoTracks()[0]?.getSettings().height}`);
      
    } catch (error) {
      console.error(`Failed to get ${quality} quality stream:`, error);
      
      // Progressive fallback to lower qualities
      if (quality === 'high') {
        console.log("High quality failed, trying medium...");
        return initializeStreamWithQuality('medium');
      } else if (quality === 'medium') {
        console.log("Medium quality failed, trying low...");
        return initializeStreamWithQuality('low');
      } else if (quality === 'low') {
        console.log("Low quality failed, trying minimal...");
        return initializeStreamWithQuality('minimal');
      } else {
        // Last resort fallback for inspector with any available camera
        if (userRole === "inspector") {
          try {
            console.log("Minimal quality failed, trying any available camera...");
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true, // Accept any video
              audio: { echoCancellation: true, noiseSuppression: true },
            });
            setLocalStream(fallbackStream);
            localStreamRef.current = fallbackStream;
            setVideoQuality('minimal');
            return;
          } catch (fallbackError) {
            console.error("All video fallbacks failed:", fallbackError);
          }
        }
        
        toast({
          title: "Camera/Microphone Access Denied",
          description: "Please allow camera and microphone access to join the call",
          variant: "destructive",
        });
      }
    }
  }

  const handleSignalingMessage = useCallback(async (message: any) => {
    const pc = peerConnectionRef.current;
    console.log(`[${userRole}] Received signaling message:`, message.type);
    console.log(`[${userRole}] Current PC state:`, pc ? `exists, signaling=${pc.signalingState}` : 'no peer connection');

    try {
      switch (message.type) {
        case "offer":
          if (userRole === "inspector") {
            if (!pc) {
              // No peer connection yet, buffer the offer
              console.log("Buffering offer (PC not created yet)");
              pendingOfferRef.current = message.data;
              return;
            }
            await createAnswer(message.data);
          }
          break;

        case "answer":
          if (!pc) return;
          if (userRole === "coordinator") {
            await pc.setRemoteDescription(message.data);
            
            // Flush buffered ICE candidates after setting remote description
            console.log(`Flushing ${pendingRemoteCandidatesRef.current.length} buffered ICE candidates`);
            for (const candidate of pendingRemoteCandidatesRef.current) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (error) {
                console.error("Failed to add buffered ICE candidate:", error);
              }
            }
            pendingRemoteCandidatesRef.current = []; // Clear the buffer
          }
          break;

        case "ice-candidate":
          if (!pc) {
            // No peer connection yet, buffer globally
            console.log("Buffering ICE candidate globally (PC not created yet)");
            pendingGlobalCandidatesRef.current.push(message.data);
            return;
          }
          if (pc.remoteDescription) {
            // Remote description already set, add candidate immediately
            try {
              await pc.addIceCandidate(message.data);
              console.log("Added ICE candidate immediately");
            } catch (error) {
              console.error("Failed to add ICE candidate:", error);
            }
          } else {
            // Remote description not set yet, buffer the candidate
            console.log("Buffering ICE candidate (remote description not set yet)");
            pendingRemoteCandidatesRef.current.push(message.data);
          }
          break;

        case "user-joined":
          console.log(`[${userRole}] User joined:`, message.userId);
          // Track that a peer has joined (only if it's not our own join message)
          if (message.userId !== userRole) {
            console.log(`[${userRole}] Peer has joined, setting hasPeerJoined to true`);
            setHasPeerJoined(true);
          } else {
            console.log(`[${userRole}] Own join message, ignoring`);
          }
          // Initiate offer when someone joins (for coordinator)
          if (userRole === "coordinator" && message.userId !== userRole) {
            console.log(`[coordinator] Inspector joined, will create offer in 1 second`);
            console.log(`[coordinator] Current PC exists: ${!!peerConnectionRef.current}`);
            setTimeout(() => {
              console.log(`[coordinator] Now creating offer after delay`);
              createOffer();
            }, 1000);
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
      }
    } catch (error) {
      console.error("Error handling signaling message:", error);
    }
  }, [userRole, callId, createAnswer, createOffer, hasPeerJoined, isConnectionEstablished, toast, playNotificationSound]);
  
  // Update the ref when handleSignalingMessage changes
  useEffect(() => {
    handleSignalingMessageRef.current = handleSignalingMessage;
  }, [handleSignalingMessage]);

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

  const captureImage = useCallback(async (videoRotation = 0) => {
    try {
      let imageBlob: Blob;
      
      if (userRole === "inspector") {
        // For inspector: Use rear camera to take a high-quality photo
        imageBlob = await capturePhotoFromCamera();
      } else {
        // For coordinator: Capture from inspector's video stream
        if (!remoteStream) {
          toast({
            title: "Capture Failed",
            description: "No inspector video feed available for capture",
            variant: "destructive",
          });
          return;
        }
        imageBlob = await captureImageFromStream(remoteStream);
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
      
      // Notify other participants
      sendMessage({
        type: "capture-image",
        callId,
        userId: userRole,
        data: { timestamp: Date.now(), imageId: result.id },
      });

      toast({
        title: "Image Captured",
        description: userRole === "coordinator" 
          ? "Inspector's camera view captured successfully"
          : "High-quality inspection photo captured and uploaded instantly",
      });

      // Return the captured image data for immediate display
      return result;
    } catch (error) {
      console.error("Failed to capture image:", error);
      toast({
        title: "Capture Failed",
        description: userRole === "inspector" 
          ? "Failed to access camera for photo capture" 
          : "Failed to capture inspection image",
        variant: "destructive",
      });
    }
  }, [callId, userRole, remoteStream, sendMessage, toast]);

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

  // Expose method to start media stream (call when user taps join)
  const startMediaStream = useCallback(async () => {
    console.log(`[${userRole}] Starting media stream after user gesture`);
    await initializeLocalStream();
    
    // Don't initialize peer connection here - let the useEffect handle it
    // This avoids double initialization
    console.log(`[${userRole}] Media stream started, local stream available:`, !!localStreamRef.current);
  }, [userRole]);

  function cleanup() {
    // Clear any buffered ICE candidates
    pendingRemoteCandidatesRef.current = [];
    
    // Clean up quality monitoring
    if (qualityMonitorRef.current) {
      qualityMonitorRef.current.stopMonitoring();
      qualityMonitorRef.current = null;
    }
    
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
    startRecording,
    stopRecording,
    startMediaStream, // Expose method to start media after user gesture
    videoQuality,
    connectionQuality,
    isConnectionEstablished,
    hasPeerJoined,
  };
}
