import { Button } from "@/components/ui/button";
import CapturedImagesGallery from "./captured-images-gallery";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Settings, 
  MessageCircle, 
  PhoneOff,
  Camera 
} from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  capturedImages: any[];
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onOpenSettings: () => void;
  onEndCall: () => void;
  onImageClick: (image: any) => void;
  onCaptureImage?: (rotation?: number) => void;
  isCoordinator: boolean;
  videoRotation?: number;
}

export default function CallControls({
  isMuted,
  isVideoEnabled,
  capturedImages,
  onToggleMute,
  onToggleVideo,
  onOpenSettings,
  onEndCall,
  onImageClick,
  onCaptureImage,
  isCoordinator,
  videoRotation = 0,
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
          {isCoordinator && onCaptureImage && (
            <Button 
              variant="default"
              onClick={() => onCaptureImage?.(videoRotation)}
              data-testid="button-capture-image"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </Button>
          )}
          
          <Button 
            variant="secondary"
            className={!isCoordinator ? "bg-white text-black border-gray-300 hover:bg-gray-100" : ""}
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Chat
          </Button>
          
          <Button
            size="icon"
            variant="destructive"
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
    </div>
  );
}
