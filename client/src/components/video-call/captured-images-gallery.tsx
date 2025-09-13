import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Download, Share, Plus, Check, Play, Video, Filter, Search, MapPin, Tag, FileText, Eye, Grid, List } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// Helper function to get rotation class for captured images
function getImageRotationClass(videoRotation: number): string {
  switch (videoRotation) {
    case 90: return 'rotate-90';
    case -90: return '-rotate-90';
    case 180: return 'rotate-180';
    default: return '';
  }
}

interface EnhancedCapturedImage {
  id: string;
  callId: string;
  categoryId?: string;
  filename: string;
  originalUrl: string;
  thumbnailUrl: string;
  tags: string[];
  notes?: string;
  inspectorLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  };
  sequenceNumber: number;
  capturedAt: string;
  metadata: {
    originalName: string;
    size: number;
    mimetype: string;
    videoRotation?: number;
    enhancedCapture?: boolean;
    directory?: string;
  };
  type: 'image' | 'video';
  category?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
  };
}

interface CapturedImagesGalleryProps {
  images: EnhancedCapturedImage[];
  onImageClick: (image: EnhancedCapturedImage) => void;
}

export default function CapturedImagesGallery({ images, onImageClick }: CapturedImagesGalleryProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Fetch media categories for filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/media-categories'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map((img) => img.id)));
    }
  };

  // Enhanced filtering logic
  const filteredImages = useMemo(() => {
    let filtered = images;
    
    // Filter by category
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(img => img.categoryId === categoryFilter);
    }
    
    // Filter by search term (notes, tags, filename)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(img => 
        img.filename.toLowerCase().includes(searchLower) ||
        img.notes?.toLowerCase().includes(searchLower) ||
        img.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        img.category?.name.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => {
      // Sort by category first, then by sequence number within category
      if (a.categoryId !== b.categoryId) {
        return (a.category?.name || '').localeCompare(b.category?.name || '');
      }
      return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
    });
  }, [images, categoryFilter, searchTerm]);

  // Group images by category for organized display
  const imagesByCategory = useMemo(() => {
    const grouped = filteredImages.reduce((acc, img) => {
      const categoryName = img.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(img);
      return acc;
    }, {} as Record<string, EnhancedCapturedImage[]>);
    
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredImages]);

  const downloadSelectedImages = async () => {
    const imagesToDownload = filteredImages.filter((img) => 
      selectedImages.has(img.id)
    );
    
    for (const image of imagesToDownload) {
      try {
        const response = await fetch(image.originalUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Enhanced filename with category and sequence
        const categoryPrefix = image.category?.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'uncategorized';
        const sequenceStr = image.sequenceNumber ? `_${String(image.sequenceNumber).padStart(3, '0')}` : '';
        a.download = `${categoryPrefix}${sequenceStr}_${image.filename}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to download image:', error);
      }
    }
  };

  const handleImageClick = (image: EnhancedCapturedImage) => {
    if (isSelectionMode) {
      toggleImageSelection(image.id);
    } else {
      onImageClick(image);
    }
  };

  const getCategoryColor = (categoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6b7280';
  };

  const MediaItemCard = ({ image, index }: { image: EnhancedCapturedImage; index: number }) => {
    const isSelected = selectedImages.has(image.id);
    
    return (
      <TooltipProvider key={image.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card 
              className={`flex-shrink-0 relative group cursor-pointer transition-all hover-elevate ${
                viewMode === 'grid' ? 'w-32' : 'w-full'
              } ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleImageClick(image)}
              data-testid={`image-card-${index}`}
            >
              <div className={`relative overflow-hidden rounded-lg ${
                viewMode === 'grid' ? 'aspect-square' : 'h-20 w-20 flex-shrink-0'
              }`}>
                {image.type === 'video' ? (
                  <>
                    <video 
                      src={image.originalUrl}
                      className={`w-full h-full object-cover transition-transform ${
                        getImageRotationClass(image.metadata?.videoRotation || 0)
                      }`}
                      preload="metadata"
                      muted
                      data-testid={`video-preview-${index}`}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-2">
                        <Play className="w-4 h-4 text-gray-900" fill="currentColor" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img 
                    src={image.thumbnailUrl || image.originalUrl}
                    alt={`${image.category?.name || 'Inspection'} image ${image.sequenceNumber}`}
                    className={`w-full h-full object-cover transition-transform ${
                      getImageRotationClass(image.metadata?.videoRotation || 0)
                    }`}
                  />
                )}
                
                {/* Category badge */}
                {image.category && (
                  <Badge 
                    className="absolute top-2 left-2 text-xs" 
                    style={{ 
                      backgroundColor: getCategoryColor(image.categoryId),
                      color: 'white'
                    }}
                  >
                    {image.category.name}
                  </Badge>
                )}
                
                {/* Sequence number */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  #{image.sequenceNumber || index + 1}
                </div>
                
                {/* Selection overlay */}
                {isSelectionMode && (
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white/80 border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
                
                {/* Metadata indicators */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  {image.notes && (
                    <div className="bg-black/70 rounded p-1">
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {image.tags?.length > 0 && (
                    <div className="bg-black/70 rounded p-1">
                      <Tag className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {image.inspectorLocation && (
                    <div className="bg-black/70 rounded p-1">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* List view metadata */}
              {viewMode === 'list' && (
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">
                        {image.category?.name || 'Uncategorized'} #{image.sequenceNumber}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(image.capturedAt), 'MMM d, HH:mm')}
                      </p>
                      {image.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {image.notes}
                        </p>
                      )}
                      {image.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {image.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {image.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{image.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-sm">
              <div className="font-medium">{image.category?.name || 'Uncategorized'} #{image.sequenceNumber}</div>
              <div className="text-muted-foreground">{format(new Date(image.capturedAt), 'MMM d, yyyy HH:mm')}</div>
              {image.notes && <div className="mt-1">{image.notes}</div>}
              {image.tags?.length > 0 && (
                <div className="mt-1">
                  <span className="text-muted-foreground">Tags: </span>
                  {image.tags.join(', ')}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Captured Media</h3>
        <div className="flex items-center space-x-2">
          {isSelectionMode && (
            <span className="text-xs text-muted-foreground">
              {selectedImages.size} of {filteredImages.length} selected
            </span>
          )}
          <span className="text-xs text-muted-foreground" data-testid="text-captured-count">
            {filteredImages.filter(m => m.type === 'image').length} images, {filteredImages.filter(m => m.type === 'video').length} videos
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            data-testid="button-toggle-view"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </Button>
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

      {/* Enhanced Filtering Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by notes, tags, or filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-media"
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger data-testid="select-category-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Enhanced Media Display */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="mb-2">
            {images.length === 0 ? (
              <>No media captured yet</>
            ) : (
              <>No media matches your filters</>
            )}
          </div>
          {(categoryFilter || searchTerm) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setCategoryFilter('');
                setSearchTerm('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'space-y-6' : 'space-y-2'}>
          {viewMode === 'grid' ? (
            // Grid view organized by category
            imagesByCategory.map(([categoryName, categoryImages]) => (
              <div key={categoryName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">{categoryName}</h4>
                  <Badge variant="outline" className="text-xs">
                    {categoryImages.length} {categoryImages.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <div className="flex space-x-3 overflow-x-auto pb-2">
                  {categoryImages.map((image, index) => (
                    <MediaItemCard key={image.id} image={image} index={index} />
                  ))}
                  {/* Add More Button - shown only for first category */}
                  {categoryName === imagesByCategory[0]?.[0] && (
                    <Card className="flex-shrink-0 w-32 aspect-square border-2 border-dashed border-border rounded flex items-center justify-center hover:border-primary transition-colors cursor-pointer hover-elevate">
                      <Plus className="w-6 h-6 text-muted-foreground" />
                    </Card>
                  )}
                </div>
              </div>
            ))
          ) : (
            // List view
            <div className="space-y-2">
              {filteredImages.map((image, index) => (
                <div key={image.id} className="flex">
                  <MediaItemCard image={image} index={index} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Enhanced Action Bar */}
      {filteredImages.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              {isSelectionMode ? 'Select media to download' : 'Click to view full size'}
            </span>
            {!isSelectionMode && (
              <div className="flex items-center gap-2">
                <Eye className="w-3 h-3" />
                <span>{filteredImages.length} of {images.length} shown</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isSelectionMode && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-0 text-xs hover:text-primary"
                  onClick={selectAllImages}
                  data-testid="button-select-all"
                >
                  {selectedImages.size === filteredImages.length ? 'Deselect All' : 'Select All'}
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
          </div>
        </div>
      )}
    </div>
  );
}
