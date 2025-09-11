import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Edit, X, Play } from "lucide-react";

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
  image: any;
  onClose: () => void;
}

export default function ImageViewerModal({ image, onClose }: ImageViewerModalProps) {
  if (!image) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(image.originalUrl || image.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename || `media-${Date.now()}.${image.type === 'video' ? 'webm' : 'jpg'}`;
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
    console.log("Opening annotation for image:", image);
  };

  return (
    <Dialog open={!!image} onOpenChange={onClose}>
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
          
          <div className="w-full h-full flex items-center justify-center p-4">
            {image.type === 'video' ? (
              <video
                src={image.originalUrl}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
                data-testid="video-full-size"
              />
            ) : (
              <img 
                src={image.originalUrl}
                alt={`Inspection image - ${image.filename}`}
                className={`max-w-full max-h-full object-contain transition-transform ${
                  getImageRotationClass(image.metadata?.videoRotation || 0)
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
                  {image.filename || (image.type === 'video' ? "Inspection Video" : "Inspection Image")}
                </div>
                <div className="text-sm opacity-80" data-testid="text-image-timestamp">
                  {image.type === 'video' ? 'Recorded' : 'Captured'} at {(image.capturedAt || image.recordedAt) ? new Date(image.capturedAt || image.recordedAt).toLocaleTimeString() : "Unknown time"}
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
                {image.type !== 'video' && (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
