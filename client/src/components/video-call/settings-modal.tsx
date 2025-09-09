import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [videoQuality, setVideoQuality] = useState("auto");
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [captureQuality, setCaptureQuality] = useState("high");

  const handleSaveSettings = () => {
    // TODO: Apply settings to WebRTC connection
    console.log("Saving settings:", {
      videoQuality,
      noiseReduction,
      echoCancellation,
      captureQuality,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-settings">
        <DialogHeader>
          <DialogTitle>Call Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="video-quality" className="text-sm font-medium">Video Quality</Label>
            <Select value={videoQuality} onValueChange={setVideoQuality}>
              <SelectTrigger className="mt-2" data-testid="select-video-quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
                <SelectItem value="720p">720p HD</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
                <SelectItem value="360p">360p</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Audio Settings</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noise-reduction"
                  checked={noiseReduction}
                  onCheckedChange={(checked) => setNoiseReduction(checked === true)}
                  data-testid="checkbox-noise-reduction"
                />
                <Label htmlFor="noise-reduction" className="text-sm">Noise Reduction</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="echo-cancellation"
                  checked={echoCancellation}
                  onCheckedChange={(checked) => setEchoCancellation(checked === true)}
                  data-testid="checkbox-echo-cancellation"
                />
                <Label htmlFor="echo-cancellation" className="text-sm">Echo Cancellation</Label>
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="capture-quality" className="text-sm font-medium">Image Capture Quality</Label>
            <Select value={captureQuality} onValueChange={setCaptureQuality}>
              <SelectTrigger className="mt-2" data-testid="select-capture-quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (Recommended)</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button 
            onClick={handleSaveSettings} 
            className="flex-1"
            data-testid="button-save-settings"
          >
            Save Settings
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-settings"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
