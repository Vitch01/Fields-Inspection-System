import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Camera, 
  Play, 
  Tag, 
  Edit3, 
  Save, 
  X, 
  Eye,
  Upload,
  Trash2,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Building,
  TrendingDown,
  DollarSign,
  FileText,
  Grid3x3,
  List,
  Search
} from "lucide-react";
import { format } from "date-fns";

interface MediaItem {
  id: string;
  originalUrl: string;
  thumbnailUrl: string;
  notes?: string;
  capturedAt: string;
  type: 'image' | 'video';
  category?: string;
  tags?: string[];
  assessmentId?: string;
  assessmentType?: 'asset' | 'wear_tear' | 'appraisal';
}

interface MediaOrganizationProps {
  inspectionRequestId: string;
  callId?: string;
  onMediaUpdate?: () => void;
  className?: string;
}

const ASSESSMENT_CATEGORIES = [
  { value: 'asset', label: 'Asset Condition', icon: Building, color: 'bg-blue-500' },
  { value: 'wear_tear', label: 'Wear & Tear', icon: TrendingDown, color: 'bg-orange-500' },
  { value: 'appraisal', label: 'Appraisal', icon: DollarSign, color: 'bg-green-500' },
  { value: 'general', label: 'General', icon: Camera, color: 'bg-gray-500' },
  { value: 'documentation', label: 'Documentation', icon: FileText, color: 'bg-purple-500' }
];

const COMMON_TAGS = [
  'exterior', 'interior', 'structural', 'electrical', 'plumbing', 'hvac',
  'foundation', 'roofing', 'flooring', 'windows', 'doors', 'paint',
  'damage', 'wear', 'corrosion', 'crack', 'leak', 'maintenance',
  'before', 'after', 'detail', 'overview', 'closeup', 'wide-angle'
];

export default function MediaOrganization({ inspectionRequestId, callId, onMediaUpdate, className }: MediaOrganizationProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  
  // Form state for editing media
  const [editForm, setEditForm] = useState({
    notes: '',
    category: '',
    tags: [] as string[],
    assessmentType: '',
    assessmentId: ''
  });

  // Fetch media data
  const { data: mediaData, isLoading: mediaLoading, refetch: refetchMedia } = useQuery({
    queryKey: ['/api/reports/data/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Fetch assessments for linking
  const { data: assetAssessments = [] } = useQuery({
    queryKey: ['/api/assessments/asset/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  const { data: wearTearAssessments = [] } = useQuery({
    queryKey: ['/api/assessments/wear-tear/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  const { data: appraisalReports = [] } = useQuery({
    queryKey: ['/api/appraisals/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Mutation for updating media metadata
  const updateMediaMutation = useMutation({
    mutationFn: (data: { mediaId: string; updates: any }) => 
      apiRequest(`/api/media/${data.mediaId}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates)
      }),
    onSuccess: () => {
      toast({ title: "Media updated successfully" });
      refetchMedia();
      onMediaUpdate?.();
      setEditingMedia(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating media",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Combine all media items
  const allMedia = [
    ...(mediaData?.media?.images || []),
    ...(mediaData?.media?.videos || [])
  ];

  // Filter media based on category and search
  const filteredMedia = allMedia.filter((item: MediaItem) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Group media by category for organized display
  const mediaByCategory = ASSESSMENT_CATEGORIES.reduce((acc, category) => {
    acc[category.value] = allMedia.filter((item: MediaItem) => item.category === category.value);
    return acc;
  }, {} as Record<string, MediaItem[]>);

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setEditForm({
      notes: media.notes || '',
      category: media.category || 'general',
      tags: media.tags || [],
      assessmentType: media.assessmentType || '',
      assessmentId: media.assessmentId || ''
    });
  };

  const handleSaveMedia = () => {
    if (!editingMedia) return;
    
    updateMediaMutation.mutate({
      mediaId: editingMedia.id,
      updates: editForm
    });
  };

  const handleAddTag = (tag: string) => {
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const getCategoryInfo = (categoryValue: string) => {
    return ASSESSMENT_CATEGORIES.find(cat => cat.value === categoryValue) || ASSESSMENT_CATEGORIES[3];
  };

  const getAssessmentOptions = () => {
    const options = [];
    
    if (editForm.assessmentType === 'asset') {
      assetAssessments.forEach((assessment: any) => {
        options.push({
          value: assessment.id,
          label: `${assessment.assetType} - ${assessment.assetDescription?.substring(0, 30)}...`
        });
      });
    } else if (editForm.assessmentType === 'wear_tear') {
      wearTearAssessments.forEach((assessment: any) => {
        options.push({
          value: assessment.id,
          label: `${assessment.componentType} - ${assessment.componentDescription?.substring(0, 30)}...`
        });
      });
    } else if (editForm.assessmentType === 'appraisal') {
      appraisalReports.forEach((report: any) => {
        options.push({
          value: report.id,
          label: `${report.assetType} - ${report.assetDescription?.substring(0, 30)}...`
        });
      });
    }
    
    return options;
  };

  if (mediaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading media...</p>
        </div>
      </div>
    );
  }

  if (!allMedia.length) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No Media Available</p>
          <p className="text-muted-foreground">Media captured during inspections will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderOpen className="w-5 h-5" />
              <span>Media Organization</span>
              <Badge variant="secondary">{allMedia.length} items</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                data-testid="button-grid-view"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                data-testid="button-list-view"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search media by notes or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-media"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ASSESSMENT_CATEGORIES.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    <div className="flex items-center space-x-2">
                      <category.icon className="w-4 h-4" />
                      <span>{category.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {ASSESSMENT_CATEGORIES.map(category => {
              const count = mediaByCategory[category.value]?.length || 0;
              const Icon = category.icon;
              return (
                <div
                  key={category.value}
                  className="text-center p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                  onClick={() => setSelectedCategory(category.value)}
                  data-testid={`category-summary-${category.value}`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">{count}</p>
                  <p className="text-xs text-muted-foreground">{category.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Media Display */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCategory === 'all' ? 'All Media' : getCategoryInfo(selectedCategory).label}
            <Badge variant="secondary" className="ml-2">
              {filteredMedia.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredMedia.map((media: MediaItem) => {
                const categoryInfo = getCategoryInfo(media.category || 'general');
                const Icon = categoryInfo.icon;
                
                return (
                  <div key={media.id} className="group relative">
                    <div className="aspect-square relative overflow-hidden rounded-lg border">
                      {media.type === 'image' ? (
                        <img
                          src={media.thumbnailUrl || media.originalUrl}
                          alt="Media item"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => setSelectedMedia(media)}
                          data-testid={`media-thumbnail-${media.id}`}
                        />
                      ) : (
                        <div 
                          className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setSelectedMedia(media)}
                          data-testid={`media-video-${media.id}`}
                        >
                          <Play className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Category Badge */}
                      <div className="absolute top-2 left-2">
                        <Badge className={`${categoryInfo.color} text-white text-xs`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {categoryInfo.label}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMedia(media);
                          }}
                          data-testid={`button-edit-media-${media.id}`}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Media Info */}
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(media.capturedAt), 'MMM d, HH:mm')}
                      </p>
                      {media.notes && (
                        <p className="text-xs truncate" title={media.notes}>
                          {media.notes}
                        </p>
                      )}
                      {media.tags && media.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {media.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {media.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              +{media.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMedia.map((media: MediaItem) => {
                const categoryInfo = getCategoryInfo(media.category || 'general');
                const Icon = categoryInfo.icon;
                
                return (
                  <div key={media.id} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-muted/50">
                    <div className="w-16 h-16 relative overflow-hidden rounded border">
                      {media.type === 'image' ? (
                        <img
                          src={media.thumbnailUrl || media.originalUrl}
                          alt="Media item"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setSelectedMedia(media)}
                        />
                      ) : (
                        <div 
                          className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer"
                          onClick={() => setSelectedMedia(media)}
                        >
                          <Play className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={`${categoryInfo.color} text-white text-xs`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {categoryInfo.label}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(media.capturedAt), 'PPp')}
                        </p>
                      </div>
                      {media.notes && (
                        <p className="text-sm mb-1">{media.notes}</p>
                      )}
                      {media.tags && media.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {media.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditMedia(media)}
                      data-testid={`button-edit-media-list-${media.id}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Media Dialog */}
      <Dialog open={!!editingMedia} onOpenChange={() => setEditingMedia(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Media Details</DialogTitle>
          </DialogHeader>
          {editingMedia && (
            <div className="space-y-4">
              {/* Media Preview */}
              <div className="w-32 h-32 relative overflow-hidden rounded border mx-auto">
                {editingMedia.type === 'image' ? (
                  <img
                    src={editingMedia.thumbnailUrl || editingMedia.originalUrl}
                    alt="Media preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={editForm.category} onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger data-testid="select-edit-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSESSMENT_CATEGORIES.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center space-x-2">
                            <category.icon className="w-4 h-4" />
                            <span>{category.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Assessment Type</label>
                  <Select value={editForm.assessmentType} onValueChange={(value) => setEditForm(prev => ({ ...prev, assessmentType: value, assessmentId: '' }))}>
                    <SelectTrigger data-testid="select-assessment-type">
                      <SelectValue placeholder="Link to assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Link</SelectItem>
                      <SelectItem value="asset">Asset Assessment</SelectItem>
                      <SelectItem value="wear_tear">Wear & Tear Assessment</SelectItem>
                      <SelectItem value="appraisal">Appraisal Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editForm.assessmentType && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Link to Specific Assessment</label>
                  <Select value={editForm.assessmentId} onValueChange={(value) => setEditForm(prev => ({ ...prev, assessmentId: value }))}>
                    <SelectTrigger data-testid="select-assessment-id">
                      <SelectValue placeholder="Select assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Specific Assessment</SelectItem>
                      {getAssessmentOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Notes</label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add descriptive notes about this media item..."
                  rows={3}
                  data-testid="textarea-edit-notes"
                />
              </div>

              {/* Tags Management */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tags</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {editForm.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer">
                        {tag}
                        <X 
                          className="w-3 h-3 ml-1"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TAGS.filter(tag => !editForm.tags.includes(tag)).slice(0, 8).map(tag => (
                      <Button
                        key={tag}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddTag(tag)}
                        className="text-xs"
                        data-testid={`button-add-tag-${tag}`}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingMedia(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveMedia}
                  disabled={updateMediaMutation.isPending}
                  data-testid="button-save-media-edit"
                >
                  {updateMediaMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Media View Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {selectedMedia && (
            <div className="space-y-4">
              {selectedMedia.type === 'image' ? (
                <img
                  src={selectedMedia.originalUrl}
                  alt="Full size media"
                  className="w-full max-h-96 object-contain rounded-lg"
                  data-testid="image-full-view"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Video playback not available in preview</p>
                    <a 
                      href={selectedMedia.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open Video
                    </a>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <p><strong>Captured:</strong> {format(new Date(selectedMedia.capturedAt), 'PPp')}</p>
                {selectedMedia.notes && (
                  <p><strong>Notes:</strong> {selectedMedia.notes}</p>
                )}
                {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                  <div>
                    <strong>Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMedia.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}