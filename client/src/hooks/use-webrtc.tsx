import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import { createPeerConnection, captureImageFromStream, capturePhotoFromCamera } from "@/lib/webrtc-utils";
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
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const { sendMessage, isConnected: wsConnected } = useWebSocket(callId, {
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

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setIsConnected(pc.connectionState === "connected");
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

    // Create offer if coordinator
    if (userRole === "coordinator") {
      createOffer();
    }
  }

  async function createOffer() {
    const pc = peerConnectionRef.current;
    if (!pc) return;

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
  }

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
          // Initiate offer when someone joins (for coordinator)
          if (userRole === "coordinator") {
            setTimeout(() => createOffer(), 1000);
          }
          break;

        case "user-left":
          console.log("User left:", message.userId);
          // Automatically end the call for the remaining participant
          toast({
            title: "Call Ended",
            description: "The other participant has left the call",
            variant: "default"
          });
          // Clean up and redirect after a short delay
          setTimeout(() => {
            cleanup();
            if (userRole === "inspector") {
              window.location.href = `/join/${callId}`;
            } else {
              window.location.href = "/";
            }
          }, 1500);
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
      
      // Upload image to server
      const formData = new FormData();
      formData.append('image', imageBlob, `inspection-${Date.now()}.jpg`);
      formData.append('filename', `inspection-${Date.now()}.jpg`);
      formData.append('videoRotation', videoRotation.toString());
      
      const response = await fetch(`/api/calls/${callId}/images`, {
        method: 'POST',
        body: formData,
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

  const endCall = useCallback(async () => {
    try {
      // Update call status
      await apiRequest("PATCH", `/api/calls/${callId}/status`, { status: "ended" });
      
      // Notify other participants
      sendMessage({
        type: "leave-call",
        callId,
        userId: userRole,
      });

      // Cleanup and redirect
      cleanup();
      // Different redirect behavior for inspectors vs coordinators
      if (userRole === "inspector") {
        window.location.href = `/join/${callId}`;
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Failed to end call:", error);
    }
  }, [callId, userRole, sendMessage]);

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

  function cleanup() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
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
  };
}
