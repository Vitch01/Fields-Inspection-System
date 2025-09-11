import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Edit, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";

// Helper function to get rotation class for captured images
function getImageRotationClass(videoRotation: number): string {
  switch (videoRotation) {
    case 90: return 'rotate-90';
    case -90: return '-rotate-90';
    case 180: return 'rotate-180';
    default: return '';
  }
}

interface ImageViewerModalProps {
  images: any[];
  selectedImage: any;
  onClose: () => void;
}

export default function ImageViewerModal({ images, selectedImage, onClose }: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastSelectedImageRef = useRef<any>(null);

  useEffect(() => {
    // Only run when selectedImage actually changes, not when images array changes
    if (selectedImage && images.length > 0 && selectedImage !== lastSelectedImageRef.current) {
      lastSelectedImageRef.current = selectedImage;
      
      // Try to find the index using multiple strategies
      let index = -1;
      
      // Strategy 1: Match by ID
      if (selectedImage.id) {
        index = images.findIndex(img => img.id === selectedImage.id);
      }
      
      // Strategy 2: Match by filename if ID match failed
      if (index === -1 && selectedImage.filename) {
        index = images.findIndex(img => img.filename === selectedImage.filename);
      }
      
      // Strategy 3: Match by originalUrl if filename match failed
      if (index === -1 && selectedImage.originalUrl) {
        index = images.findIndex(img => img.originalUrl === selectedImage.originalUrl);
      }
      
      // Strategy 4: Match by object reference
      if (index === -1) {
        index = images.findIndex(img => img === selectedImage);
      }
      
      // Strategy 5: Match by timestamp (for newly created items)
      if (index === -1 && (selectedImage.capturedAt || selectedImage.recordedAt)) {
        const selectedTimestamp = selectedImage.capturedAt || selectedImage.recordedAt;
        index = images.findIndex(img => 
          (img.capturedAt && img.capturedAt === selectedTimestamp) ||
          (img.recordedAt && img.recordedAt === selectedTimestamp)
        );
      }
      
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [selectedImage, images]);

  // Reset ref when modal closes
  useEffect(() => {
    if (!selectedImage) {
      lastSelectedImageRef.current = null;
    }
  }, [selectedImage]);

  if (!selectedImage || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => prev === 0 ? images.length - 1 : prev - 1);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => prev === images.length - 1 ? 0 : prev + 1);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentImage.originalUrl || currentImage.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentImage.filename || `media-${Date.now()}.${currentImage.type === 'video' ? 'webm' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const handleAnnotate = () => {
    // TODO: Implement image annotation
    console.log("Opening annotation for image:", currentImage);
  };

  return (
    <Dialog open={!!selectedImage} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0" data-testid="modal-image-viewer">
        <div className="relative w-full h-full flex items-center justify-center bg-black min-h-[80vh]">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={onClose}
            data-testid="button-close-image-viewer"
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                onClick={goToPrevious}
                data-testid="button-previous-image"
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                onClick={goToNext}
                data-testid="button-next-image"
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}
          
          <div className="w-full h-full flex items-center justify-center p-4">
            {currentImage.type === 'video' ? (
              <div
                className={`flex items-center justify-center transition-transform ${
                  getImageRotationClass(currentImage.metadata?.videoRotation || 0)
                }`}
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
              >
                <video
                  src={currentImage.originalUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-full object-contain"
                  data-testid="video-full-size"
                />
              </div>
            ) : (
              <img 
                src={currentImage.originalUrl}
                alt={`Inspection image - ${currentImage.filename}`}
                className={`max-w-full max-h-full object-contain transition-transform ${
                  getImageRotationClass(currentImage.metadata?.videoRotation || 0)
                }`}
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
                data-testid="image-full-size"
              />
            )}
          </div>
          
          {/* Image Info and Actions */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium" data-testid="text-image-title">
                  {currentImage.filename || (currentImage.type === 'video' ? "Inspection Video" : "Inspection Image")}
                  {images.length > 1 && (
                    <span className="ml-2 text-sm opacity-70">
                      ({currentIndex + 1} of {images.length})
                    </span>
                  )}
                </div>
                <div className="text-sm opacity-80" data-testid="text-image-timestamp">
                  {currentImage.type === 'video' ? 'Recorded' : 'Captured'} at {(currentImage.capturedAt || currentImage.recordedAt) ? new Date(currentImage.capturedAt || currentImage.recordedAt).toLocaleTimeString() : "Unknown time"}
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  data-testid="button-download-image"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {currentImage.type !== 'video' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAnnotate}
                    data-testid="button-annotate-image"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Annotate
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Thumbnail strip for quick navigation */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg p-2 z-10">
              <div className="flex space-x-2 max-w-md overflow-x-auto">
                {images.map((img, index) => (
                  <button
                    key={index}
                    className={`w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 transition-colors ${
                      index === currentIndex ? 'border-white' : 'border-transparent hover:border-gray-400'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                    data-testid={`thumbnail-${index}`}
                  >
                    {img.type === 'video' ? (
                      <div className={`w-full h-full flex items-center justify-center ${
                        getImageRotationClass(img.metadata?.videoRotation || 0)
                      }`}>
                        <video 
                          src={img.originalUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                      </div>
                    ) : (
                      <img 
                        src={img.thumbnailUrl || img.originalUrl}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
