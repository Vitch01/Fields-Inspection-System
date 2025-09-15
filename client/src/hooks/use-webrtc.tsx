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
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioUnlockPrompt, setShowAudioUnlockPrompt] = useState(false);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captureRequestIdRef = useRef<string | null>(null);
  const iceRestartInProgressRef = useRef<boolean>(false);
  const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef<boolean>(false);
  const remoteAudioElementRef = useRef<HTMLAudioElement | null>(null);
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

  console.log(`🔗 ${userRole}: Initializing WebRTC for call ${callId}`);
  
  const { sendMessage, isConnected: wsConnected } = useWebSocket(callId, userRole, {
    onMessage: handleSignalingMessage,
  });

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

  // Mobile-specific media acquisition - separate audio/video calls
  async function getMobileMediaSeparately(): Promise<MediaStream> {
    console.log(`📱 ${userRole}: Attempting separate audio/video for mobile`);
    
    // Get mobile-optimized constraints
    const getVideoConstraints = () => {
      if (userRole === "inspector") {
        return {
          facingMode: { ideal: "environment" }, // Rear camera for inspections
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15, max: 24 }
        };
      } else {
        return {
          facingMode: { ideal: "user" }, // Front camera for coordinator
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 24 }
        };
      }
    };

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 16000 // Optimize for voice
    };

    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;

    try {
      // Try to get video first
      console.log(`📹 ${userRole}: Getting video stream separately`);
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(),
        audio: false
      });
      console.log(`✅ ${userRole}: Video stream acquired`);
    } catch (videoError) {
      console.warn(`⚠️ ${userRole}: Video failed, continuing with audio:`, videoError);
    }

    try {
      // Get audio separately
      console.log(`🎤 ${userRole}: Getting audio stream separately`);
      audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioConstraints
      });
      console.log(`✅ ${userRole}: Audio stream acquired`);
    } catch (audioError) {
      console.error(`❌ ${userRole}: Audio failed:`, audioError);
      
      // If audio fails but we have video, return video-only
      if (videoStream) {
        console.log(`📹 ${userRole}: Returning video-only stream`);
        return videoStream;
      }
      
      throw audioError;
    }

    // Combine audio and video tracks into single stream
    const combinedStream = new MediaStream();
    
    if (videoStream) {
      videoStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
    }
    
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
    }

    console.log(`🔄 ${userRole}: Combined mobile stream created:`, {
      videoTracks: combinedStream.getVideoTracks().length,
      audioTracks: combinedStream.getAudioTracks().length
    });

    return combinedStream;
  }

  // Audio unlock function to handle browser autoplay policies
  const unlockAudio = useCallback(async () => {
    try {
      console.log('🎵 Attempting to unlock remote audio playback via dedicated audio element');
      
      // Use the dedicated audio element for remote audio
      if (remoteAudioElementRef.current) {
        try {
          await remoteAudioElementRef.current.play();
          console.log('✅ Dedicated audio element playback unlocked');
          setAudioUnlocked(true);
          setShowAudioUnlockPrompt(false);
          
          toast({
            title: "Audio Enabled",
            description: "You should now be able to hear the coordinator",
          });
          return;
        } catch (playError) {
          console.warn('⚠️ Could not play dedicated audio element:', playError);
        }
      }
      
      // Fallback: try video elements if audio element doesn't exist
      const videoElements = Array.from(document.querySelectorAll('video[data-testid="video-remote-stream"]'));
      console.log(`🔍 Fallback: Found ${videoElements.length} remote video elements`);
      
      for (const videoElement of videoElements) {
        const video = videoElement as HTMLVideoElement;
        if (video.srcObject === remoteStream) {
          try {
            video.muted = false;
            await video.play();
            console.log('✅ Fallback: Remote video/audio playback unlocked');
            setAudioUnlocked(true);
            setShowAudioUnlockPrompt(false);
            
            toast({
              title: "Audio Enabled",
              description: "You should now be able to hear the coordinator",
            });
            return;
          } catch (playError) {
            console.warn('⚠️ Could not auto-play remote video:', playError);
          }
        }
      }
      
      // If we get here, both methods failed
      toast({
        title: "Audio Unlock Failed",
        description: "Please try again or check your browser audio settings",
        variant: "destructive",
      });
    } catch (error) {
      console.error('❌ Failed to unlock audio:', error);
      toast({
        title: "Audio Unlock Failed", 
        description: "Please try again or check your browser audio settings",
        variant: "destructive",
      });
    }
  }, [remoteStream, toast]);

  // Standard constraints for desktop browsers
  function getStandardConstraintsFallbacks() {
    if (userRole === "inspector") {
      return [
        // First try: High quality with preferred rear camera
        {
          video: { 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            facingMode: { ideal: "environment" }
          },
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Second try: Medium quality with preferred rear camera
        {
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: { ideal: "environment" }
          },
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Third try: Any camera with basic quality
        {
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }
          },
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Fourth try: Basic video constraints
        {
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Final fallback: Audio only
        {
          audio: { echoCancellation: true, noiseSuppression: true }
        }
      ];
    } else {
      // Coordinator constraints (generally more permissive)
      return [
        // First try: Good quality front camera
        {
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: { ideal: "user" }
          },
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Second try: Basic quality
        {
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }
          },
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Third try: Any video
        {
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true }
        },
        // Final fallback: Audio only
        {
          audio: { echoCancellation: true, noiseSuppression: true }
        }
      ];
    }
  }

  async function initializeLocalStream() {
    console.log(`🎥 ${userRole}: Starting media stream initialization`);
    
    // Detect mobile/iOS for separate audio/video approach
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isInAppBrowser = /\[.*App\]/.test(navigator.userAgent) || /FBAN|FBAV|Instagram/.test(navigator.userAgent);
    
    console.log(`📱 ${userRole}: Device detection:`, { isIOS, isMobile, isInAppBrowser });
    
    // For iOS/mobile, use separate audio/video calls to avoid constraints conflicts
    if (isMobile || isIOS) {
      try {
        const combinedStream = await getMobileMediaSeparately();
        setLocalStream(combinedStream);
        localStreamRef.current = combinedStream;
        
        console.log(`✅ ${userRole}: Mobile audio/video successfully combined:`, {
          videoTracks: combinedStream.getVideoTracks().length,
          audioTracks: combinedStream.getAudioTracks().length
        });
        
        return;
      } catch (error) {
        console.error(`❌ ${userRole}: Mobile media approach failed:`, error);
        // Fall through to standard approach
      }
    }
    
    // Standard approach for desktop browsers
    const constraintsFallbacks = getStandardConstraintsFallbacks();
    
    for (let i = 0; i < constraintsFallbacks.length; i++) {
      const constraints = constraintsFallbacks[i];
      const isAudioOnly = !constraints.video;
      
      try {
        console.log(`🎥 ${userRole}: Attempting getUserMedia with constraints (attempt ${i + 1}/${constraintsFallbacks.length}):`, constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log(`✅ ${userRole}: Successfully got media stream:`, {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          isAudioOnly
        });
        
        // Log track details for debugging
        stream.getVideoTracks().forEach((track, index) => {
          console.log(`📹 Video track ${index}:`, {
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            settings: track.getSettings()
          });
        });
        
        stream.getAudioTracks().forEach((track, index) => {
          console.log(`🎤 Audio track ${index}:`, {
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            settings: track.getSettings()
          });
        });
        
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        if (isAudioOnly) {
          toast({
            title: "Audio-Only Mode",
            description: "Video not available, but audio communication is active",
            variant: "default",
          });
        }
        
        return; // Success - exit the function
      } catch (error) {
        const err = error as Error;
        console.error(`❌ ${userRole}: getUserMedia attempt ${i + 1} failed:`, {
          name: err.name,
          message: err.message,
          constraints,
          isLastAttempt: i === constraintsFallbacks.length - 1
        });
        
        // If this is the last attempt, show error
        if (i === constraintsFallbacks.length - 1) {
          const errorMessage = getErrorMessage(error);
          toast({
            title: errorMessage.title,
            description: errorMessage.description,
            variant: "destructive",
          });
        }
        // Otherwise, continue to next fallback
      }
    }
  }

  // Helper function to provide better error messages based on error type
  function getErrorMessage(error: any) {
    switch (error.name) {
      case 'NotFoundError':
        return {
          title: "No Camera/Microphone Found",
          description: "No camera or microphone devices were found. Please check your device connections."
        };
      case 'NotAllowedError':
        return {
          title: "Permission Denied",
          description: "Camera and microphone access was denied. Please allow access in your browser settings."
        };
      case 'OverconstrainedError':
        return {
          title: "Device Constraints Not Met",
          description: "Your camera/microphone doesn't meet the requirements. Trying with lower quality settings."
        };
      case 'NotReadableError':
        return {
          title: "Device In Use",
          description: "Camera or microphone is already in use by another application."
        };
      case 'AbortError':
        return {
          title: "Operation Aborted",
          description: "Media access was aborted. Please try again."
        };
      default:
        return {
          title: "Media Access Failed",
          description: `Unable to access camera/microphone: ${error.message || 'Unknown error'}`
        };
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
      remoteDescriptionSetRef.current = true;
      // Flush any queued ICE candidates
      flushQueuedIceCandidates();
      
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

  // Function to flush queued ICE candidates
  async function flushQueuedIceCandidates() {
    const pc = peerConnectionRef.current;
    if (!pc || queuedIceCandidatesRef.current.length === 0) return;
    
    console.log(`🧊 ${userRole}: Flushing ${queuedIceCandidatesRef.current.length} queued ICE candidates`);
    
    const candidates = [...queuedIceCandidatesRef.current];
    queuedIceCandidatesRef.current = []; // Clear the queue
    
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
        console.log(`✅ ${userRole}: Added queued ICE candidate`);
      } catch (error) {
        console.error(`❌ ${userRole}: Failed to add queued ICE candidate:`, error);
      }
    }
  }
  
  async function handleSignalingMessage(message: any) {
    console.log(`🔗 ${userRole}: Received signaling message for call ${callId}:`, message.type, message);
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
            remoteDescriptionSetRef.current = true;
            // Flush any queued ICE candidates
            flushQueuedIceCandidates();
          }
          break;

        case "ice-candidate":
          if (!pc) return;
          // Queue ICE candidates until remote description is set
          if (pc.remoteDescription || remoteDescriptionSetRef.current) {
            try {
              await pc.addIceCandidate(message.data);
              console.log(`✅ ${userRole}: Added ICE candidate`);
            } catch (error) {
              console.error(`❌ ${userRole}: Failed to add ICE candidate:`, error);
            }
          } else {
            console.log(`⏳ ${userRole}: Queuing ICE candidate (no remote description yet)`);
            queuedIceCandidatesRef.current.push(message.data);
          }
          break;

        case "peer-ready":
          console.log(`🤝 ${userRole}: Received peer-ready message:`, message);
          setIsPeerReady(true);
          
          // If coordinator and there are existing peers, create offer
          if (userRole === "coordinator" && message.peers && message.peers.length > 0) {
            console.log(`🚀 ${userRole}: Creating offer for existing peers:`, message.peers);
            setTimeout(() => createOffer(), 500); // Small delay to ensure connection is stable
          }
          break;

        case "user-joined":
          console.log("User joined:", message.userId);
          // Track that a peer has joined (only if it's not our own join message)
          if (message.userId !== userRole) {
            setHasPeerJoined(true);
            
            // Only create offer if we're coordinator, peer is ready, and it's not our own join
            if (userRole === "coordinator" && isPeerReady) {
              console.log(`🚀 ${userRole}: Creating offer for newly joined user: ${message.userId}`);
              setTimeout(() => createOffer(), 500); // Small delay to ensure connection is stable
            }
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
    const MAX_RETRIES = 2;
    const CAPTURE_TIMEOUT = 10000; // 10 seconds timeout for mobile networks
    
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

  // Mobile audio unlock detection - show prompt when remote stream arrives on mobile
  useEffect(() => {
    if (remoteStream && userRole === "inspector") {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isMobile || isIOS) {
        // Check if audio tracks exist in remote stream
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length > 0 && !audioUnlocked) {
          console.log(`📱 ${userRole}: Mobile device detected with remote audio, showing unlock prompt`);
          setShowAudioUnlockPrompt(true);
          
          // Also try to setup a dedicated audio element
          if (!remoteAudioElementRef.current) {
            const audioElement = new Audio();
            audioElement.srcObject = remoteStream;
            audioElement.autoplay = false; // Don't autoplay, let user unlock
            remoteAudioElementRef.current = audioElement;
            console.log('📱 Created dedicated audio element for mobile playback');
          }
        }
      }
    }
  }, [remoteStream, userRole, audioUnlocked]);

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
    audioUnlocked,
    showAudioUnlockPrompt,
    unlockAudio,
  };
}
