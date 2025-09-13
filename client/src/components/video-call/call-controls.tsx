import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CapturedImagesGallery from "./captured-images-gallery";
import MediaCaptureDialog from "./media-capture-dialog";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Settings, 
  MessageCircle, 
  PhoneOff,
  Camera,
  Circle,
  Square,
  Plus
} from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  capturedImages: any[];
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onOpenSettings: () => void;
  onOpenChat: () => void;
  onEndCall: () => void;
  onImageClick: (image: any) => void;
  onCaptureImage?: (rotation?: number) => void;
  // Enhanced capture methods
  showImageCaptureDialog?: () => void;
  showVideoCaptureDialog?: () => void;
  captureImageWithCategory?: (categoryId: string, notes?: string, tags?: string[]) => Promise<void>;
  // Dialog state
  showCaptureDialog?: boolean;
  setShowCaptureDialog?: (show: boolean) => void;
  captureType?: 'image' | 'video';
  isCoordinator: boolean;
  videoRotation?: number;
  unreadCount?: number;
  isRecording?: boolean;
  isCapturing?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  hasStreamToRecord?: boolean;
}

export default function CallControls({
  isMuted,
  isVideoEnabled,
  capturedImages,
  onToggleMute,
  onToggleVideo,
  onOpenSettings,
  onOpenChat,
  onEndCall,
  onImageClick,
  onCaptureImage,
  // Enhanced capture methods
  showImageCaptureDialog,
  showVideoCaptureDialog,
  captureImageWithCategory,
  // Dialog state
  showCaptureDialog = false,
  setShowCaptureDialog,
  captureType = 'image',
  isCoordinator,
  videoRotation = 0,
  unreadCount = 0,
  isRecording = false,
  isCapturing = false,
  onStartRecording,
  onStopRecording,
  hasStreamToRecord = false,
}: CallControlsProps) {
  return (
    <div className={`border-t p-4 ${
      isCoordinator 
        ? "bg-card border-border" 
        : "bg-white border-gray-300"
    }`}>
      {/* Call Controls */}
      <div className="flex items-center justify-between mb-4">
        
        {/* Left Controls */}
        <div className="flex items-center space-x-3">
          <Button
            size="icon"
            variant={isMuted ? "destructive" : "secondary"}
            className={!isCoordinator ? "bg-white text-black border-gray-300 hover:bg-gray-100" : ""}
            onClick={onToggleMute}
            data-testid="button-toggle-mute"
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            size="icon"
            variant={!isVideoEnabled ? "destructive" : "secondary"}
            className={!isCoordinator ? "bg-white text-black border-gray-300 hover:bg-gray-100" : ""}
            onClick={onToggleVideo}
            data-testid="button-toggle-video"
          >
            {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>
          
          <Button
            size="icon"
            variant="secondary"
            className={!isCoordinator ? "bg-white text-black border-gray-300 hover:bg-gray-100" : ""}
            onClick={onOpenSettings}
            data-testid="button-open-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Center - Call Info */}
        <div className="text-center">
          <div className={`text-sm font-medium ${
            isCoordinator ? "text-foreground" : "text-black"
          }`}>
            Inspection Call Active
          </div>
          <div className={`text-xs ${
            isCoordinator ? "text-muted-foreground" : "text-gray-600"
          }`}>
            {isCoordinator ? "Monitor inspector's feed and capture images" : "Broadcasting to coordinator"}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {/* Enhanced capture buttons for coordinators */}
          {isCoordinator && (
            <div className="flex items-center space-x-2">
              {/* Enhanced capture with category selection */}
              {showImageCaptureDialog && (
                <Button 
                  variant="default"
                  onClick={showImageCaptureDialog}
                  disabled={isCapturing}
                  data-testid="button-capture-image-enhanced"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isCapturing ? "Capturing..." : "Capture Photo"}
                </Button>
              )}
              
              {/* Video capture with category selection */}
              {showVideoCaptureDialog && (
                <Button 
                  variant="outline"
                  onClick={showVideoCaptureDialog}
                  disabled={isCapturing}
                  data-testid="button-capture-video-enhanced"
                >
                  <Circle className="w-4 h-4 mr-2" />
                  {isCapturing ? "Capturing..." : "Record Video"}
                </Button>
              )}
              
              {/* Fallback to basic capture if enhanced methods not available */}
              {!showImageCaptureDialog && onCaptureImage && (
                <Button 
                  variant="default"
                  onClick={() => onCaptureImage?.(videoRotation)}
                  disabled={isCapturing}
                  data-testid="button-capture-image-basic"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isCapturing ? "Capturing..." : "Capture Photo"}
                </Button>
              )}
            </div>
          )}

          {isCoordinator && (
            <Button 
              variant={isRecording ? "destructive" : "secondary"}
              className={isRecording ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={isRecording ? onStopRecording : onStartRecording}
              data-testid="button-toggle-recording"
              disabled={!hasStreamToRecord && !isRecording}
              title={!hasStreamToRecord ? "No video stream available for recording" : ""}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          )}
          
          <div className="relative">
            <Button 
              variant="secondary"
              className={!isCoordinator ? "bg-white text-black border-gray-300 hover:bg-gray-100" : ""}
              onClick={onOpenChat}
              data-testid="button-open-chat"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 w-5 h-5 text-xs text-white bg-red-500 flex items-center justify-center rounded-full p-0 border-0"
                data-testid="badge-unread-count"
              >
                {unreadCount}
              </Badge>
            )}
          </div>
          
          <Button
            size="icon"
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 border-red-600"
            onClick={onEndCall}
            data-testid="button-end-call"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Captured Images Gallery - Only for Coordinators */}
      {isCoordinator && (
        <CapturedImagesGallery
          images={capturedImages}
          onImageClick={onImageClick}
        />
      )}

      {/* Enhanced Media Capture Dialog */}
      {isCoordinator && showCaptureDialog && setShowCaptureDialog && captureImageWithCategory && (
        <MediaCaptureDialog
          isOpen={showCaptureDialog}
          onClose={() => setShowCaptureDialog(false)}
          captureType={captureType}
          onCapture={async (categoryId, notes, tags) => {
            try {
              await captureImageWithCategory(categoryId, notes, tags);
              setShowCaptureDialog(false);
            } catch (error) {
              console.error('Enhanced capture failed:', error);
              // Dialog stays open on error so user can retry
            }
          }}
          isCapturing={isCapturing}
        />
      )}
    </div>
  );
}
