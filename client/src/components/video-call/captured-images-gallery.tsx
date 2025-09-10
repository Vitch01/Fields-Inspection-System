import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Check } from "lucide-react";
import { useState } from "react";

// Helper function to get rotation class for captured images
function getImageRotationClass(videoRotation: number): string {
  switch (videoRotation) {
    case 90: return 'rotate-90';
    case -90: return '-rotate-90';
    case 180: return 'rotate-180';
    default: return '';
  }
}

interface CapturedImagesGalleryProps {
  images: any[];
  onImageClick: (image: any) => void;
}

export default function CapturedImagesGallery({ images, onImageClick }: CapturedImagesGalleryProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const selectAllImages = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img, idx) => img.id || idx.toString())));
    }
  };

  const downloadSelectedImages = async () => {
    const imagesToDownload = images.filter((img, idx) => 
      selectedImages.has(img.id || idx.toString())
    );
    
    for (const image of imagesToDownload) {
      try {
        const response = await fetch(image.originalUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inspection-image-${image.id || Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to download image:', error);
      }
    }
  };

  const handleImageClick = (image: any, index: number) => {
    if (isSelectionMode) {
      toggleImageSelection(image.id || index.toString());
    } else {
      onImageClick(image);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Captured Images</h3>
        <div className="flex items-center space-x-2">
          {isSelectionMode && (
            <span className="text-xs text-muted-foreground">
              {selectedImages.size} of {images.length} selected
            </span>
          )}
          <span className="text-xs text-muted-foreground" data-testid="text-captured-count">
            {images.length} images captured
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-xs bg-black text-white hover:bg-gray-800"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            data-testid="button-toggle-selection"
          >
            {isSelectionMode ? 'Cancel' : 'Select'}
          </Button>
        </div>
      </div>
      
      <div className="flex space-x-3 overflow-x-auto pb-2">
        {images.map((image, index) => {
          const imageId = image.id || index.toString();
          const isSelected = selectedImages.has(imageId);
          
          return (
            <div 
              key={imageId}
              className="flex-shrink-0 relative group cursor-pointer"
              onClick={() => handleImageClick(image, index)}
              data-testid={`image-thumbnail-${index}`}
            >
              <img 
                src={image.thumbnailUrl || image.originalUrl}
                alt={`Captured inspection image ${index + 1}`}
                className={`w-20 h-20 object-contain rounded border-2 transition-colors bg-gray-100 dark:bg-gray-800 ${
                  isSelected 
                    ? 'border-blue-500' 
                    : 'border-border group-hover:border-primary'
                } ${getImageRotationClass(image.metadata?.videoRotation || 0)}`}
              />
              <div className={`absolute inset-0 rounded transition-colors ${
                isSelected ? 'bg-blue-500/20' : 'bg-black/0 group-hover:bg-black/20'
              }`}></div>
              
              {/* Selection checkbox */}
              {isSelectionMode && (
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-white border-gray-300'
                }`}>
                  {isSelected && <Check className="w-2 h-2 text-white" />}
                </div>
              )}
              
              <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-xs px-1 rounded">
                {index + 1}
              </div>
            </div>
          );
        })}
        
        {/* Add More Button */}
        <div className="flex-shrink-0 w-20 h-20 border-2 border-dashed border-border rounded flex items-center justify-center hover:border-primary transition-colors cursor-pointer">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Image Actions */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div>
          {isSelectionMode ? 'Select images to download' : 'Click images to view full size'}
        </div>
        <div className="flex space-x-4">
          {isSelectionMode && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-xs hover:text-primary"
                onClick={selectAllImages}
                data-testid="button-select-all"
              >
                {selectedImages.size === images.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-xs hover:text-primary"
                onClick={downloadSelectedImages}
                disabled={selectedImages.size === 0}
                data-testid="button-download-selected"
              >
                <Download className="w-3 h-3 mr-1" />
                Download ({selectedImages.size})
              </Button>
            </>
          )}
          {!isSelectionMode && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-xs hover:text-primary"
                onClick={async () => {
                  setSelectedImages(new Set(images.map((img, idx) => img.id || idx.toString())));
                  await downloadSelectedImages();
                  setSelectedImages(new Set());
                }}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
