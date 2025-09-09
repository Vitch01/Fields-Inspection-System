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
  onCaptureImage?: () => void;
  isCoordinator: boolean;
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
}: CallControlsProps) {
  return (
    <div className="bg-card border-t border-border p-4">
      {/* Call Controls */}
      <div className="flex items-center justify-between mb-4">
        
        {/* Left Controls */}
        <div className="flex items-center space-x-3">
          <Button
            size="icon"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={onToggleMute}
            data-testid="button-toggle-mute"
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            size="icon"
            variant={!isVideoEnabled ? "destructive" : "secondary"}
            onClick={onToggleVideo}
            data-testid="button-toggle-video"
          >
            {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>
          
          <Button
            size="icon"
            variant="secondary"
            onClick={onOpenSettings}
            data-testid="button-open-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Center - Call Info */}
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">Inspection Call Active</div>
          <div className="text-xs text-muted-foreground">
            {isCoordinator ? "Monitor inspector's feed and capture images" : "Broadcasting to coordinator"}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {isCoordinator && onCaptureImage && (
            <Button 
              variant="default"
              onClick={onCaptureImage}
              data-testid="button-capture-image"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </Button>
          )}
          
          <Button 
            variant="secondary"
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
