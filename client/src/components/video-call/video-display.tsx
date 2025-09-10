import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Expand, ChevronsUp, RotateCw, RotateCcw } from "lucide-react";

interface VideoDisplayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCoordinator: boolean;
  onCaptureImage: (rotation?: number) => void;
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
  const [manualRotation, setManualRotation] = useState(isCoordinator ? -90 : 0); // Start coordinator with -90 degrees (horizontal, opposite side), inspector with 0
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
    onCaptureImage(manualRotation);
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
        // Request fullscreen on the container div instead of just the video
        remoteVideoRef.current.parentElement?.requestFullscreen();
      }
    }
  };


  // Determine if video is in horizontal orientation
  const isHorizontalOrientation = () => {
    // Video is considered horizontal if:
    // 1. It's manually rotated to 90 or -90 degrees (portrait becomes landscape)
    // 2. It's naturally landscape (aspect ratio > 1) and not rotated
    return (manualRotation === 90 || manualRotation === -90) || 
           (manualRotation === 0 && videoAspectRatio > 1);
  };

  // Get fullscreen container classes based on rotation
  const getFullscreenContainerClass = () => {
    if (!isCoordinator) return 'inset-0';
    
    // In fullscreen, always center and contain
    return 'inset-0 flex items-center justify-center bg-black';
  };

  // Get fullscreen video classes based on rotation
  const getFullscreenVideoClass = () => {
    if (!isCoordinator) return 'w-full h-full';
    
    // In fullscreen, let video scale appropriately while maintaining rotation
    switch (manualRotation) {
      case 90:
      case -90:
        // When rotated 90/-90 degrees, video needs height constraint
        return 'max-h-screen max-w-screen w-auto h-auto';
      case 180:
        // When rotated 180 degrees
        return 'max-h-screen max-w-screen w-auto h-auto';
      default:
        // No manual rotation
        if (videoAspectRatio > 1) {
          // Video is naturally landscape
          return 'max-h-screen max-w-screen w-auto h-auto';
        }
        // Video is portrait
        return 'max-h-screen max-w-screen w-auto h-auto';
    }
  };

  return (
    <div className="relative h-full bg-slate-900 overflow-hidden">
      {/* Remote Video Feed (Main) */}
      <div className={`absolute video-container transition-all duration-500 ${
        isFullscreen
          ? getFullscreenContainerClass() // Adapt to rotation in fullscreen
          : isCoordinator
            ? 'inset-4' // Consistent padding to fit within the frame
            : 'inset-2' // Smaller area for portrait mode
      }`}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isCoordinator} // Coordinator doesn't hear their own audio
          className={`${
            isFullscreen 
              ? getFullscreenVideoClass()
              : isCoordinator
                ? 'w-full h-full' // Fit within the container frame
                : 'w-full h-full'
          } object-contain transition-transform duration-500 ${
            isCoordinator ? getRotationClass(videoAspectRatio, manualRotation) : ''
          }`}
          data-testid="video-remote-stream"
        />
        
        {/* Video Controls Overlay */}
        <div className="absolute top-4 left-4 flex space-x-2">
          {isCoordinator && (
            <Button 
              size="icon"
              variant="secondary"
              className="bg-white text-black hover:bg-gray-100 border border-gray-300"
              onClick={handleCaptureImage}
              data-testid="button-capture-image-overlay"
            >
              <Camera className="w-4 h-4" />
            </Button>
          )}
          <Button 
            size="icon"
            variant="secondary"
            className="bg-white text-black hover:bg-gray-100 border border-gray-300"
            data-testid="button-toggle-remote-audio"
          >
            <ChevronsUp className="w-4 h-4" />
          </Button>
          {isCoordinator && (
            <>
              <Button 
                size="icon"
                variant="secondary"
                className={`border border-gray-300 hover:bg-gray-100 ${
                  manualRotation !== 0 ? 'bg-blue-600 text-white' : 'bg-white text-black'
                }`}
                onClick={rotateClockwise}
                data-testid="button-rotate-clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button 
                size="icon"
                variant="secondary"
                className={`border border-gray-300 hover:bg-gray-100 ${
                  manualRotation !== 0 ? 'bg-blue-600 text-white' : 'bg-white text-black'
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
            className="bg-white text-black hover:bg-gray-100 border border-gray-300"
            onClick={toggleFullscreen}
            data-testid="button-toggle-fullscreen"
          >
            <Expand className="w-4 h-4" />
          </Button>
        </div>


        {/* Video Info Overlay */}
        <div className="absolute top-4 right-4 bg-white text-black px-3 py-2 rounded-md border border-gray-300">
          <div className="text-sm font-medium">
            {isCoordinator ? "Field Inspector" : "Your View"}
          </div>
          <div className="text-xs opacity-70">
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
        <div className="absolute bottom-1 left-1 bg-white text-black text-xs px-1 rounded border border-gray-300">
          {isCoordinator ? "You" : "You"}
        </div>
      </div>

      {/* Floating Capture Button - Only show when not fullscreen */}
      {!isFullscreen && isCoordinator && (
        <Button
          size="icon"
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-16 h-16 capture-button text-white rounded-full shadow-lg"
          onClick={handleCaptureImage}
          data-testid="button-capture-image"
        >
          <Camera className="w-6 h-6" />
        </Button>
      )}

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

      {/* Fullscreen Capture Button - Positioned below video area */}
      {isFullscreen && isCoordinator && (
        <Button
          size="icon"
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg z-50"
          onClick={handleCaptureImage}
          data-testid="button-capture-image-fullscreen"
        >
          <Camera className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
