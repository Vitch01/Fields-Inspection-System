import { Button } from "@/components/ui/button";
import { Download, Share, Plus } from "lucide-react";
import { getImageRotationClass } from "@/lib/webrtc-utils";

interface CapturedImagesGalleryProps {
  images: any[];
  onImageClick: (image: any) => void;
  videoRotation?: number;
}

export default function CapturedImagesGallery({ images, onImageClick, videoRotation = 0 }: CapturedImagesGalleryProps) {
  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Captured Images</h3>
        <span className="text-xs text-muted-foreground" data-testid="text-captured-count">
          {images.length} images captured
        </span>
      </div>
      
      <div className="flex space-x-3 overflow-x-auto pb-2">
        {images.map((image, index) => (
          <div 
            key={image.id || index}
            className="flex-shrink-0 relative group cursor-pointer"
            onClick={() => onImageClick(image)}
            data-testid={`image-thumbnail-${index}`}
          >
            <img 
              src={image.thumbnailUrl || image.originalUrl}
              alt={`Captured inspection image ${index + 1}`}
              className={`w-20 h-16 object-cover rounded border-2 border-border group-hover:border-primary transition-all duration-500 ${getImageRotationClass(videoRotation)}`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors"></div>
            <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-xs px-1 rounded">
              {index + 1}
            </div>
          </div>
        ))}
        
        {/* Add More Button */}
        <div className="flex-shrink-0 w-20 h-16 border-2 border-dashed border-border rounded flex items-center justify-center hover:border-primary transition-colors cursor-pointer">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Image Actions */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div>Click images to view full size</div>
        <div className="flex space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 text-xs hover:text-primary"
            data-testid="button-download-all"
          >
            <Download className="w-3 h-3 mr-1" />
            Download All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 text-xs hover:text-primary"
            data-testid="button-share-images"
          >
            <Share className="w-3 h-3 mr-1" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
