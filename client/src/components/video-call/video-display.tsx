import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Expand, ChevronsUp } from "lucide-react";

interface VideoDisplayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCoordinator: boolean;
  onCaptureImage: () => void;
}

export default function VideoDisplay({ 
  localStream, 
  remoteStream, 
  isCoordinator, 
  onCaptureImage 
}: VideoDisplayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16/9);
  const [containerDimensions, setContainerDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Listen for video metadata to get actual dimensions
      const video = remoteVideoRef.current;
      const handleLoadedMetadata = () => {
        if (video.videoWidth && video.videoHeight) {
          const aspectRatio = video.videoWidth / video.videoHeight;
          setVideoAspectRatio(aspectRatio);
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [remoteStream]);

  // Handle window resize for responsive video
  useEffect(() => {
    const handleResize = () => {
      setContainerDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCaptureImage = () => {
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);
    onCaptureImage();
  };

  const toggleFullscreen = () => {
    if (remoteVideoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        remoteVideoRef.current.requestFullscreen();
      }
    }
  };

  // Calculate container style based on video aspect ratio
  const getVideoContainerStyle = () => {
    if (!isCoordinator) {
      // Inspector shows their own video full screen
      return { width: '100%', height: '100%' };
    }
    
    // Coordinator adapts to inspector's video aspect ratio
    const containerAspectRatio = containerDimensions.width / containerDimensions.height;
    
    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider than container - fit by width
      return {
        width: '100%',
        height: `${100 / videoAspectRatio * containerAspectRatio}%`,
        top: '50%',
        transform: 'translateY(-50%)'
      };
    } else {
      // Video is taller than container - fit by height
      return {
        height: '100%',
        width: `${videoAspectRatio * 100 / containerAspectRatio}%`,
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }
  };

  return (
    <div className="relative h-full bg-slate-900 overflow-hidden flex items-center justify-center">
      {/* Remote Video Feed (Main) */}
      <div 
        className="relative video-container"
        style={getVideoContainerStyle()}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isCoordinator} // Coordinator doesn't hear their own audio
          className="w-full h-full object-contain"
          data-testid="video-remote-stream"
        />
        
        {/* Video Controls Overlay */}
        <div className="absolute top-4 left-4 flex space-x-2">
          <Button 
            size="icon"
            variant="secondary"
            className="bg-black/50 text-white hover:bg-black/70"
            data-testid="button-toggle-remote-audio"
          >
            <ChevronsUp className="w-4 h-4" />
          </Button>
          <Button 
            size="icon"
            variant="secondary"
            className="bg-black/50 text-white hover:bg-black/70"
            onClick={toggleFullscreen}
            data-testid="button-toggle-fullscreen"
          >
            <Expand className="w-4 h-4" />
          </Button>
        </div>

        {/* Video Info Overlay */}
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-md">
          <div className="text-sm font-medium">
            {isCoordinator ? "Field Inspector" : "Your View"}
          </div>
          <div className="text-xs opacity-80">
            {isCoordinator 
              ? `${videoAspectRatio > 1 ? 'Landscape' : 'Portrait'} • ${Math.round(videoAspectRatio * 100) / 100}:1`
              : "Broadcasting to Coordinator"
            }
          </div>
        </div>
      </div>

      {/* Local Video Feed (Picture-in-Picture) */}
      <div className="absolute bottom-20 right-4 w-32 h-24 md:w-40 md:h-30 bg-slate-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          data-testid="video-local-stream"
        />
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
          {isCoordinator ? "You" : "You"}
        </div>
      </div>

      {/* Floating Capture Button */}
      <Button
        size="icon"
        className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-16 h-16 capture-button text-white rounded-full shadow-lg"
        onClick={handleCaptureImage}
        data-testid="button-capture-image"
      >
        <Camera className="w-6 h-6" />
      </Button>

      {/* Capture Flash Effect */}
      <div 
        className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 ${
          captureFlash ? 'opacity-80' : 'opacity-0'
        }`}
        data-testid="capture-flash-effect"
      />

      {/* No Video Fallback */}
      {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <div className="text-center text-white">
            <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">Waiting for video...</p>
            <p className="text-sm opacity-75">
              {isCoordinator ? "Connecting to inspector" : "Connecting to coordinator"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
