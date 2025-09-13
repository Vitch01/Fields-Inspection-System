import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Camera, Search, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface MediaCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface MediaCaptureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (categoryId: string, notes: string, tags: string[]) => Promise<void>;
  captureType: "image" | "video";
  isCapturing?: boolean;
}

// Icon mapping for category icons
const iconMap = {
  MapPin,
  Camera,
  Search,
  AlertTriangle,
  CheckCircle,
};

// Color mapping for category badges
const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function MediaCaptureDialog({
  isOpen,
  onClose,
  onCapture,
  captureType,
  isCapturing = false
}: MediaCaptureDialogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Fetch available media categories
  const { data: categories = [], isLoading } = useQuery<MediaCategory[]>({
    queryKey: ["/api/media-categories"],
    enabled: isOpen,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCategoryId("");
      setNotes("");
      setTags([]);
    }
  }, [isOpen]);

  const handleCapture = async () => {
    if (!selectedCategoryId) return;
    
    try {
      await onCapture(selectedCategoryId, notes, tags);
      onClose();
    } catch (error) {
      console.error(`Error capturing ${captureType}:`, error);
    }
  };

  const handleTagInput = (value: string) => {
    // Simple tag parsing - split by comma and trim
    const newTags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setTags(newTags);
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Camera;
    return IconComponent;
  };

  const getCategoryColorClass = (color: string) => {
    return colorMap[color] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-media-capture">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="w-5 h-5" />
            <span>Capture {captureType === "image" ? "Photo" : "Video"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-3">
            <Label htmlFor="category-selection">Select Category</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading categories...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2" id="category-selection">
                {categories.map((category) => {
                  const IconComponent = getIcon(category.icon);
                  const isSelected = selectedCategoryId === category.id;
                  
                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer transition-all ${
                        isSelected 
                          ? "ring-2 ring-primary border-primary" 
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedCategoryId(category.id)}
                      data-testid={`category-option-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`p-2 rounded-full ${getCategoryColorClass(category.color)}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-medium text-foreground">
                                {category.name}
                              </h4>
                              <Badge 
                                variant="secondary" 
                                className={getCategoryColorClass(category.color)}
                              >
                                {category.name}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {category.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <Label htmlFor="capture-notes">
              Notes & Annotations
              <span className="text-xs text-muted-foreground ml-1">(optional)</span>
            </Label>
            <Textarea
              id="capture-notes"
              placeholder="Add any notes or observations about this capture..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] resize-none"
              data-testid="input-capture-notes"
            />
          </div>

          {/* Tags Input */}
          <div className="space-y-2">
            <Label htmlFor="capture-tags">
              Tags
              <span className="text-xs text-muted-foreground ml-1">(optional, comma-separated)</span>
            </Label>
            <Textarea
              id="capture-tags"
              placeholder="e.g., damage, structural, electrical, safety"
              onChange={(e) => handleTagInput(e.target.value)}
              className="min-h-[60px] resize-none"
              data-testid="input-capture-tags"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isCapturing}
            data-testid="button-cancel-capture"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCapture}
            disabled={!selectedCategoryId || isCapturing}
            data-testid="button-confirm-capture"
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {captureType === "image" ? "Capturing..." : "Recording..."}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                Capture {captureType === "image" ? "Photo" : "Video"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}