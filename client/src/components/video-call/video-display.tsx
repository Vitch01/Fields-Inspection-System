import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Expand, ChevronsUp, RotateCw, RotateCcw } from "lucide-react";

interface VideoDisplayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCoordinator: boolean;
  onCaptureImage: () => void;
  onRotationChange?: (rotation: number) => void;
}

export default function VideoDisplay({ 
  localStream, 
  remoteStream, 
  isCoordinator, 
  onCaptureImage,
  onRotationChange
}: VideoDisplayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16/9);
  const [manualRotation, setManualRotation] = useState(0); // 0, 90, -90, 180 degrees
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Helper function to determine rotation class
  const getRotationClass = (aspectRatio: number, rotation: number) => {
    // Auto-rotate to landscape if video is landscape (aspectRatio > 1) OR manual rotation is set
    const shouldRotate = aspectRatio > 1 || rotation !== 0;
    
    if (!shouldRotate) return '';
    
    // Apply manual rotation or default 90 degrees for landscape
    const finalRotation = rotation !== 0 ? rotation : 90;
    
    switch (finalRotation) {
      case 90: return 'rotate-90';
      case -90: return '-rotate-90';
      case 180: return 'rotate-180';
      default: return '';
    }
  };

  // Notify parent of initial rotation state and when video aspect ratio changes
  useEffect(() => {
    const currentRotationClass = getRotationClass(videoAspectRatio, manualRotation);
    const isRotated = currentRotationClass !== '';
    onRotationChange?.(isRotated ? manualRotation || 90 : 0);
  }, [videoAspectRatio, manualRotation, onRotationChange]);

  const rotateClockwise = () => {
    setManualRotation(prev => {
      const newRotation = (() => {
        switch (prev) {
          case 0: return 90;
          case 90: return 180;
          case 180: return -90;
          case -90: return 0;
          default: return 90;
        }
      })();
      onRotationChange?.(newRotation);
      return newRotation;
    });
  };

  const rotateCounterclockwise = () => {
    setManualRotation(prev => {
      const newRotation = (() => {
        switch (prev) {
          case 0: return -90;
          case -90: return 180;
          case 180: return 90;
          case 90: return 0;
          default: return -90;
        }
      })();
      onRotationChange?.(newRotation);
      return newRotation;
    });
  };

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


  const handleCaptureImage = () => {
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);
    onCaptureImage();
  };

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (remoteVideoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        remoteVideoRef.current.requestFullscreen();
      }
    }
  };


  // Determine if video is in horizontal orientation
  const isHorizontalOrientation = () => {
    const currentRotationClass = getRotationClass(videoAspectRatio, manualRotation);
    return currentRotationClass !== '' && (manualRotation === 90 || manualRotation === -90 || (manualRotation === 0 && videoAspectRatio > 1));
  };

  // Get fullscreen container classes based on rotation
  const getFullscreenContainerClass = () => {
    if (!isCoordinator) return 'inset-0';
    
    switch (manualRotation) {
      case 90:
      case -90:
        // When rotated 90 degrees, video area should be wider than tall
        return 'inset-0 flex items-center justify-center';
      case 180:
        // When rotated 180 degrees, keep normal dimensions
        return 'inset-0 flex items-center justify-center';
      default:
        // No rotation or auto-rotation for landscape
        if (videoAspectRatio > 1) {
          // Video is naturally landscape, expand to fill
          return 'inset-0 flex items-center justify-center';
        }
        return 'inset-0 flex items-center justify-center';
    }
  };

  // Get fullscreen video classes based on rotation
  const getFullscreenVideoClass = () => {
    if (!isCoordinator) return 'w-full h-full';
    
    switch (manualRotation) {
      case 90:
      case -90:
        // When rotated, adapt dimensions to fill screen optimally
        return 'h-screen w-auto max-w-full';
      case 180:
        // When rotated 180, use full dimensions
        return 'w-full h-full';
      default:
        // No rotation or auto-rotation for landscape
        if (videoAspectRatio > 1) {
          // Video is naturally landscape
          return 'w-full h-full';
        }
        // Video is portrait
        return 'h-full w-auto max-w-full';
    }
  };

  return (
    <div className="relative h-full bg-slate-900 overflow-hidden">
      {/* Remote Video Feed (Main) */}
      <div className={`absolute video-container transition-all duration-500 ${
        isFullscreen
          ? getFullscreenContainerClass() // Adapt to rotation in fullscreen
          : isHorizontalOrientation() && isCoordinator
            ? 'inset-x-4 inset-y-2' // Larger when horizontal
            : 'inset-0' // Normal size
      }`}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isCoordinator} // Coordinator doesn't hear their own audio
          className={`${
            isFullscreen 
              ? getFullscreenVideoClass()
              : 'w-full h-full'
          } object-contain transition-transform duration-500 ${
            isCoordinator ? getRotationClass(videoAspectRatio, manualRotation) : ''
          }`}
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
          {isCoordinator && (
            <>
              <Button 
                size="icon"
                variant="secondary"
                className={`text-white hover:bg-black/70 ${
                  manualRotation !== 0 ? 'bg-blue-600' : 'bg-black/50'
                }`}
                onClick={rotateClockwise}
                data-testid="button-rotate-clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button 
                size="icon"
                variant="secondary"
                className={`text-white hover:bg-black/70 ${
                  manualRotation !== 0 ? 'bg-blue-600' : 'bg-black/50'
                }`}
                onClick={rotateCounterclockwise}
                data-testid="button-rotate-counterclockwise"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}
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
