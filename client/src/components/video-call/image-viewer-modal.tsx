import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Edit, X } from "lucide-react";

interface ImageViewerModalProps {
  image: any;
  onClose: () => void;
}

export default function ImageViewerModal({ image, onClose }: ImageViewerModalProps) {
  if (!image) return null;

  const handleDownload = () => {
    // TODO: Implement image download
    console.log("Downloading image:", image);
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
            <img 
              src={image.originalUrl}
              alt={`Inspection image - ${image.filename}`}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: '85vh', maxWidth: '90vw' }}
              data-testid="image-full-size"
            />
          </div>
          
          {/* Image Info and Actions */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium" data-testid="text-image-title">
                  {image.filename || "Inspection Image"}
                </div>
                <div className="text-sm opacity-80" data-testid="text-image-timestamp">
                  Captured at {image.capturedAt ? new Date(image.capturedAt).toLocaleTimeString() : "Unknown time"}
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAnnotate}
                  data-testid="button-annotate-image"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Annotate
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
