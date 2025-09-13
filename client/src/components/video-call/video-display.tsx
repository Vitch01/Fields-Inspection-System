import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Expand, RotateCw, RotateCcw, Play } from "lucide-react";

interface VideoDisplayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCoordinator: boolean;
  onCaptureImage: (rotation?: number) => void;
  onRotationChange?: (rotation: number) => void;
  inspectorName?: string;
  callStartTime?: string;
}

export default function VideoDisplay({ 
  localStream, 
  remoteStream, 
  isCoordinator, 
  onCaptureImage,
  onRotationChange,
  inspectorName,
  callStartTime
}: VideoDisplayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16/9);
  const [manualRotation, setManualRotation] = useState(isCoordinator ? -90 : 0); // Start coordinator with -90 degrees (horizontal, opposite side), inspector with 0
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoBlocked, setIsVideoBlocked] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isLocalVideoBlocked, setIsLocalVideoBlocked] = useState(false);
  const [isLocalVideoPlaying, setIsLocalVideoPlaying] = useState(false);

  // Calculate call duration
  useEffect(() => {
    if (!callStartTime || !isCoordinator) return;

    const interval = setInterval(() => {
      const startTime = new Date(callStartTime).getTime();
      const now = new Date().getTime();
      const durationSeconds = Math.floor((now - startTime) / 1000);
      setCallDuration(durationSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStartTime, isCoordinator]);

  // Format call duration as MM:SS
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Helper function to determine rotation class
  const getRotationClass = (aspectRatio: number, rotation: number) => {
    // For coordinator: Only apply manual rotation, ignore aspect ratio to maintain consistent settings
    // For inspector: Keep existing behavior
    if (isCoordinator) {
      // Coordinator uses only manual rotation for consistent video area settings
      if (rotation === 0) return '';
      
      switch (rotation) {
        case 90: return 'rotate-90';
        case -90: return '-rotate-90';
        case 180: return 'rotate-180';
        default: return '';
      }
    } else {
      // Inspector keeps original auto-rotation behavior
      const shouldRotate = aspectRatio > 1 || rotation !== 0;
      
      if (!shouldRotate) return '';
      
      const finalRotation = rotation !== 0 ? rotation : 90;
      
      switch (finalRotation) {
        case 90: return 'rotate-90';
        case -90: return '-rotate-90';
        case 180: return 'rotate-180';
        default: return '';
      }
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
      console.log('VideoDisplay: Setting local video stream', {
        streamId: localStream.id,
        tracks: localStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
        isCoordinator
      });
      
      localVideoRef.current.srcObject = localStream;
      
      const video = localVideoRef.current;
      
      // Handle local video play events
      const handleLocalPlay = () => {
        console.log('VideoDisplay: Local video started playing');
        setIsLocalVideoPlaying(true);
        setIsLocalVideoBlocked(false);
      };
      
      const handleLocalPause = () => {
        console.log('VideoDisplay: Local video paused');
        setIsLocalVideoPlaying(false);
      };
      
      video.addEventListener('play', handleLocalPlay);
      video.addEventListener('pause', handleLocalPause);
      
      // Attempt programmatic play for local video after a short delay
      const playLocalVideo = async () => {
        try {
          console.log('VideoDisplay: Attempting programmatic local video play');
          await video.play();
          console.log('VideoDisplay: Local video play succeeded');
        } catch (error: any) {
          console.error('VideoDisplay: Local video play failed:', error);
          
          if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
            console.log('VideoDisplay: Local video autoplay blocked, showing play button');
            setIsLocalVideoBlocked(true);
          } else {
            console.error('VideoDisplay: Unexpected local video play error:', error);
          }
        }
      };
      
      // Delay play attempt to ensure video element is ready
      const playTimeout = setTimeout(playLocalVideo, 100);
      
      return () => {
        video.removeEventListener('play', handleLocalPlay);
        video.removeEventListener('pause', handleLocalPause);
        clearTimeout(playTimeout);
      };
    }
  }, [localStream, isCoordinator]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('VideoDisplay: Setting remote video stream', {
        streamId: remoteStream.id,
        tracks: remoteStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })),
        isCoordinator
      });
      
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Listen for video metadata to get actual dimensions
      const video = remoteVideoRef.current;
      const handleLoadedMetadata = () => {
        console.log('VideoDisplay: Video metadata loaded', {
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight
        });
        
        if (video.videoWidth && video.videoHeight) {
          const aspectRatio = video.videoWidth / video.videoHeight;
          setVideoAspectRatio(aspectRatio);
        }
      };
      
      // Handle video play events
      const handlePlay = () => {
        console.log('VideoDisplay: Video started playing');
        setIsVideoPlaying(true);
        setIsVideoBlocked(false);
      };
      
      const handlePause = () => {
        console.log('VideoDisplay: Video paused');
        setIsVideoPlaying(false);
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      
      // Attempt programmatic play after a short delay to ensure srcObject is set
      const playVideo = async () => {
        try {
          console.log('VideoDisplay: Attempting programmatic video play');
          await video.play();
          console.log('VideoDisplay: Video play succeeded');
        } catch (error: any) {
          console.error('VideoDisplay: Video play failed:', error);
          
          if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
            console.log('VideoDisplay: Autoplay blocked, showing play button');
            setIsVideoBlocked(true);
          } else {
            console.error('VideoDisplay: Unexpected video play error:', error);
          }
        }
      };
      
      // Delay play attempt to ensure video element is ready
      const playTimeout = setTimeout(playVideo, 100);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        clearTimeout(playTimeout);
      };
    }
  }, [remoteStream, isCoordinator]);


  const handleCaptureImage = () => {
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);
    onCaptureImage(manualRotation);
  };

  // Handle manual video play for when autoplay is blocked
  const handleManualPlay = async () => {
    if (remoteVideoRef.current) {
      try {
        console.log('VideoDisplay: Manual play button clicked');
        await remoteVideoRef.current.play();
        console.log('VideoDisplay: Manual play succeeded');
        setIsVideoBlocked(false);
        setIsVideoPlaying(true);
      } catch (error: any) {
        console.error('VideoDisplay: Manual play failed:', error);
        
        // Even user gesture failed - might be a deeper issue
        if (error.name === 'NotAllowedError') {
          console.error('VideoDisplay: Manual play still not allowed - may need user interaction on document first');
        }
      }
    }
  };

  // Handle manual local video play for when autoplay is blocked
  const handleManualLocalPlay = async () => {
    if (localVideoRef.current) {
      try {
        console.log('VideoDisplay: Manual local play button clicked');
        await localVideoRef.current.play();
        console.log('VideoDisplay: Manual local play succeeded');
        setIsLocalVideoBlocked(false);
        setIsLocalVideoPlaying(true);
      } catch (error: any) {
        console.error('VideoDisplay: Manual local play failed:', error);
        
        // Even user gesture failed - might be a deeper issue
        if (error.name === 'NotAllowedError') {
          console.error('VideoDisplay: Manual local play still not allowed - may need user interaction on document first');
        }
      }
    }
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
            ? 'inset-1 overflow-hidden' // Container for enlarged video
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
          {isCoordinator ? (
            <>
              <div className="text-sm font-medium">
                {inspectorName || "Field Inspector"}
              </div>
              <div className="text-xs opacity-70">
                {`${videoAspectRatio > 1 ? 'Landscape' : 'Portrait'} • ${formatDuration(callDuration)}`}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Your View</div>
              <div className="text-xs opacity-70">Broadcasting to Coordinator</div>
            </>
          )}
        </div>

        {/* Video Blocked Overlay - Centered Play Button */}
        {isVideoBlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="text-center text-white">
              <Button
                size="icon"
                className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 mb-4"
                onClick={handleManualPlay}
                data-testid="button-manual-play"
              >
                <Play className="w-10 h-10" />
              </Button>
              <div className="text-lg font-medium mb-2">Video Paused</div>
              <div className="text-sm opacity-75">
                Click to start video playback
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local Video Feed (Picture-in-Picture) */}
      <div className="absolute bottom-20 right-4 w-32 h-24 md:w-40 md:h-30 bg-slate-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isCoordinator ? 'scale-x-[-1]' : ''}`}
          data-testid="video-local-stream"
        />
        <div className="absolute bottom-1 left-1 bg-white text-black text-xs px-1 rounded border border-gray-300">
          {isCoordinator ? "You" : "You"}
        </div>
        
        {/* Local Video Blocked Overlay - Small Play Button */}
        {isLocalVideoBlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg">
            <Button
              size="icon"
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleManualLocalPlay}
              data-testid="button-manual-local-play"
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>
        )}
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
