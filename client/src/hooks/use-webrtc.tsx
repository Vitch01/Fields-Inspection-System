import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import { 
  createPeerConnection, 
  captureImageFromStream, 
  capturePhotoFromCamera, 
  createRotatedRecordingStream,
  isMobileDevice,
  getBandwidthConstraints 
} from "@/lib/webrtc-utils";
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
  const [isRelayOnly, setIsRelayOnly] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<{
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
    bars: number; // 0-4
    rtt?: number;
    packetLoss?: number;
    bitrate?: number;
  }>({ level: 'disconnected', bars: 0 });
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captureRequestIdRef = useRef<string | null>(null);
  const iceRestartInProgressRef = useRef<boolean>(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Detect if mobile or inspector on mobile
  const isMobile = isMobileDevice();
  const shouldPreferRelay = isMobile || userRole === "inspector";

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

  async function initializeLocalStream() {
    try {
      // Use lower resolution for mobile devices to reduce bandwidth
      const videoConstraints = userRole === "inspector" 
        ? isMobile 
          ? {
              width: { ideal: 640, max: 640 },
              height: { ideal: 360, max: 360 },
              frameRate: { ideal: 15, max: 15 },
              facingMode: { exact: "environment" } // Rear camera
            }
          : { 
              width: { ideal: 1920 }, 
              height: { ideal: 1080 },
              facingMode: { exact: "environment" } // Rear camera
            }
        : isMobile
          ? {
              width: { ideal: 640, max: 640 },
              height: { ideal: 360, max: 360 },
              frameRate: { ideal: 15, max: 15 },
              facingMode: "user" // Front camera
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
          const fallbackConstraints = isMobile 
            ? { 
                width: { ideal: 640, max: 640 },
                height: { ideal: 360, max: 360 },
                frameRate: { ideal: 15, max: 15 }
              }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: fallbackConstraints,
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

  function initializePeerConnection(forceRelay: boolean = false) {
    // Force relay mode immediately for mobile inspectors
    const useRelay = forceRelay || (userRole === "inspector" && isMobile) || (shouldPreferRelay && connectionAttempts > 0);
    
    console.log('Initializing peer connection:', {
      userRole,
      isMobile,
      forceRelay,
      useRelay,
      connectionAttempts
    });
    
    const pc = createPeerConnection(useRelay);
    peerConnectionRef.current = pc;
    
    if (useRelay) {
      setIsRelayOnly(true);
      toast({
        title: "Using Relay Mode",
        description: "Connecting through TURN relay for better mobile connectivity",
        variant: "default"
      });
    }

    // Add local stream tracks with bitrate limits for mobile
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        
        // Apply aggressive bitrate limits for mobile video
        if (track.kind === 'video' && isMobile) {
          sender.setParameters({
            encodings: [{
              maxBitrate: 300000, // 300kbps for slow cellular
              maxFramerate: 15,
              scaleResolutionDownBy: 2
            }],
            degradationPreference: 'maintain-framerate'
          } as RTCRtpSendParameters).catch((error) => {
            console.warn('Failed to set video bitrate parameters:', error);
          });
        } else if (track.kind === 'audio' && isMobile) {
          // Reduce audio bitrate for mobile too
          sender.setParameters({
            encodings: [{
              maxBitrate: 24000 // 24kbps for audio on mobile
            }]
          } as RTCRtpSendParameters).catch((error) => {
            console.warn('Failed to set audio bitrate parameters:', error);
          });
        }
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Set connection timeout for mobile (longer for slow cellular)
    if (shouldPreferRelay && !useRelay) {
      // Give direct connection 30 seconds to establish on slow cellular
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected && pc.connectionState !== "connected") {
          console.log("Direct connection timeout - switching to relay mode");
          handleConnectionFailure();
        }
      }, 30000); // Extended to 30 seconds for slow cellular connections
    }
    
    // Handle connection state changes with better diagnostics
    pc.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${pc.connectionState}`);
      const connected = pc.connectionState === "connected";
      setIsConnected(connected);
      
      if (connected) {
        setIsConnectionEstablished(true);
        setConnectionAttempts(0); // Reset attempts on success
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        // Log connection details for debugging
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const isRelay = report.remoteCandidateType === 'relay' || 
                             report.localCandidateType === 'relay';
              console.log('Connection established:', {
                local: report.localCandidateType,
                remote: report.remoteCandidateType,
                isRelay
              });
              
              if (isRelay) {
                toast({
                  title: "Connected via Relay",
                  description: "Using TURN relay for optimal connectivity",
                  variant: "default"
                });
              }
            }
          });
        });
        
        console.log("WebRTC connection established successfully");
      } else if (pc.connectionState === "failed") {
        console.error("WebRTC connection failed - attempting recovery");
        handleConnectionFailure();
      } else if (pc.connectionState === "disconnected") {
        console.warn("WebRTC connection disconnected");
        // Give it a moment to reconnect before taking action
        setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            handleConnectionFailure();
          }
        }, 3000);
      }
    };

    // Handle ICE gathering state for better debugging
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${pc.iceGatheringState}`);
    };

    // Handle ICE connection state changes with improved restart logic
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === "checking") {
        // Log ICE candidates being checked
        pc.getStats().then(stats => {
          let candidateCount = 0;
          stats.forEach(report => {
            if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
              candidateCount++;
            }
          });
          console.log(`Checking ${candidateCount} ICE candidates...`);
        });
      } else if (pc.iceConnectionState === "failed") {
        console.error(`ICE connection failed - attempting recovery`);
        
        // For mobile/inspector, try relay mode if not already using it
        if (shouldPreferRelay && !isRelayOnly) {
          console.log("Switching to relay-only mode for mobile/inspector");
          handleConnectionFailure();
        } else {
          // Otherwise attempt ICE restart
          handleIceRestart();
        }
      } else if (pc.iceConnectionState === "disconnected") {
        console.warn("ICE disconnected - monitoring...");
        // Give it time to reconnect
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            handleIceRestart();
          }
        }, 5000);
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        // Reset restart flag when connection is restored
        iceRestartInProgressRef.current = false;
        console.log("ICE connection successful");
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

  // Handle connection failure with relay fallback
  const handleConnectionFailure = useCallback(() => {
    const attempts = connectionAttempts + 1;
    setConnectionAttempts(attempts);
    
    console.log(`Connection failure - attempt ${attempts}`);
    
    // Clear existing connection properly
    if (peerConnectionRef.current) {
      // Stop all transceivers and remove event handlers
      peerConnectionRef.current.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onicegatheringstatechange = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear any existing timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    // For mobile/inspector, switch to relay mode after first failure
    if (shouldPreferRelay && attempts === 1 && !isRelayOnly) {
      console.log("Switching to relay-only mode");
      toast({
        title: "Switching to Relay Mode",
        description: "Direct connection failed. Using TURN relay for better connectivity.",
        variant: "default"
      });
      
      // Reinitialize with relay mode
      setTimeout(() => {
        initializePeerConnection(true);
        if (userRole === "coordinator") {
          createOffer();
        }
      }, 1000);
    } else if (attempts < 3) {
      // Try reconnecting with current mode
      toast({
        title: "Reconnecting...",
        description: `Attempt ${attempts} of 3`,
        variant: "default"
      });
      
      setTimeout(() => {
        initializePeerConnection(isRelayOnly);
        if (userRole === "coordinator") {
          createOffer();
        }
      }, 2000);
    } else {
      // Give up after 3 attempts
      toast({
        title: "Connection Failed",
        description: "Unable to establish connection. Please check your network and try again.",
        variant: "destructive"
      });
    }
  }, [connectionAttempts, shouldPreferRelay, isRelayOnly, userRole, toast]);
  
  // Monitor connection statistics for network quality
  const monitorConnectionStats = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.connectionState !== 'connected') {
      setNetworkQuality({ level: 'disconnected', bars: 0 });
      return;
    }

    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let packetLoss = 0;
      let bytesReceived = 0;
      let prevBytesReceived = 0;
      let bitrate = 0;

      stats.forEach((report: any) => {
        // Get RTT from candidate-pair stats
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = (report.currentRoundTripTime || 0) * 1000; // Convert to ms
        }
        // Get packet loss and bitrate from inbound-rtp stats
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const packetsLost = report.packetsLost || 0;
          const packetsReceived = report.packetsReceived || 0;
          if (packetsReceived > 0) {
            packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
          }
          bytesReceived = report.bytesReceived || 0;
          // Calculate bitrate based on bytes received (approximate)
          if (prevBytesReceived > 0 && bytesReceived > prevBytesReceived) {
            bitrate = ((bytesReceived - prevBytesReceived) * 8) / 2000; // kbps over 2 seconds
          }
        }
      });

      // Calculate quality level based on metrics
      let level: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
      let bars: number;

      if (rtt < 100 && packetLoss < 1) {
        level = 'excellent';
        bars = 4;
      } else if (rtt < 200 && packetLoss < 3) {
        level = 'good';
        bars = 3;
      } else if (rtt < 400 && packetLoss < 5) {
        level = 'fair';
        bars = 2;
      } else {
        level = 'poor';
        bars = 1;
      }

      setNetworkQuality({ level, bars, rtt, packetLoss, bitrate });
    } catch (error) {
      console.warn('Failed to get connection stats:', error);
    }
  }, []);
  
  // Set up network quality monitoring when connected
  useEffect(() => {
    if (isConnected && peerConnectionRef.current) {
      // Clear any existing interval
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      
      // Start monitoring stats every 2 seconds
      monitorConnectionStats(); // Initial check
      statsIntervalRef.current = setInterval(monitorConnectionStats, 2000);
      
      return () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
      };
    } else {
      // Clear stats when disconnected
      setNetworkQuality({ level: 'disconnected', bars: 0 });
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    }
  }, [isConnected, monitorConnectionStats]);
  
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
      
      // Fall back to full reconnection if ICE restart fails
      if (shouldPreferRelay && !isRelayOnly) {
        handleConnectionFailure();
      }
    }
  }, [userRole, callId, sendMessage, shouldPreferRelay, isRelayOnly, handleConnectionFailure]);

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
    // Clean up timeouts
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
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
    setIsRelayOnly(false);
    setConnectionAttempts(0);
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
    networkQuality,
  };
}
