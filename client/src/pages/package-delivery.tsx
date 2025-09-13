import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Package2, 
  FileText, 
  Image, 
  Video, 
  BarChart3,
  Download,
  Send,
  Eye,
  Clock,
  CheckCircle,
  Settings,
  ArrowLeft,
  AlertCircle,
  Info,
  Calendar,
  MapPin,
  Building,
  User,
  Mail,
  Share
} from "lucide-react";
import { format } from "date-fns";

interface PackageDeliveryParams {
  id: string;
}

interface InspectionData {
  inspectionRequest: any;
  client: any;
  reports: any[];
  media: {
    images: any[];
    videos: any[];
  };
  assessments: {
    assetAssessments: any[];
    wearTearAssessments: any[];
    appraisalReports: any[];
  };
}

interface PackagePreparationData {
  packageType: 'complete' | 'reports_only' | 'media_only' | 'custom';
  includeReports: boolean;
  includeMedia: boolean;
  includeAssessments: boolean;
  customTitle: string;
  notes: string;
  selectedReports: string[];
  selectedImages: string[];
  selectedVideos: string[];
}

export default function PackageDelivery() {
  const { id } = useParams<PackageDeliveryParams>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [preparationData, setPreparationData] = useState<PackagePreparationData>({
    packageType: 'complete',
    includeReports: true,
    includeMedia: true,
    includeAssessments: true,
    customTitle: '',
    notes: '',
    selectedReports: [],
    selectedImages: [],
    selectedVideos: []
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch inspection data
  const { data: inspectionData, isLoading, error } = useQuery<InspectionData>({
    queryKey: ['/api/inspection-requests', id, 'package-data'],
    enabled: !!id,
  });

  // Generate package mutation
  const generatePackageMutation = useMutation({
    mutationFn: async (data: PackagePreparationData) => {
      return apiRequest('POST', `/api/inspection-requests/${id}/generate-package`, {
        ...data,
        inspectionRequestId: id
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Package Generated Successfully",
        description: `Package "${preparationData.customTitle || inspectionData?.inspectionRequest.title}" has been prepared for delivery.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/inspection-packages'] });
      
      // Navigate to package details or back to coordinator dashboard
      setLocation(`/coordinator/packages/${data.packageId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Package Generation Failed",
        description: error.message || "Failed to generate inspection package",
        variant: "destructive",
      });
    },
  });

  // Handle package type changes
  const handlePackageTypeChange = (type: string) => {
    const newPreparationData = { ...preparationData, packageType: type as any };
    
    switch (type) {
      case 'reports_only':
        newPreparationData.includeReports = true;
        newPreparationData.includeMedia = false;
        newPreparationData.includeAssessments = false;
        break;
      case 'media_only':
        newPreparationData.includeReports = false;
        newPreparationData.includeMedia = true;
        newPreparationData.includeAssessments = false;
        break;
      case 'complete':
        newPreparationData.includeReports = true;
        newPreparationData.includeMedia = true;
        newPreparationData.includeAssessments = true;
        break;
      // 'custom' allows manual selection
    }
    
    setPreparationData(newPreparationData);
  };

  // Handle generate package
  const handleGeneratePackage = () => {
    if (!preparationData.customTitle.trim()) {
      setPreparationData(prev => ({
        ...prev,
        customTitle: `Inspection Package - ${inspectionData?.inspectionRequest.title}`
      }));
    }
    setShowConfirmDialog(true);
  };

  const confirmGeneratePackage = () => {
    generatePackageMutation.mutate(preparationData);
    setShowConfirmDialog(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Package2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <div className="text-white">Loading inspection data...</div>
        </div>
      </div>
    );
  }

  if (error || !inspectionData) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <div className="text-white mb-4">Failed to load inspection data</div>
          <Link href="/coordinator/dashboard">
            <Button variant="outline" className="border-white text-white hover:bg-white hover:text-slate-800">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { inspectionRequest, client, reports, media, assessments } = inspectionData;

  // Calculate package statistics
  const packageStats = {
    reports: reports.length,
    images: media.images.length,
    videos: media.videos.length,
    totalAssessments: assessments.assetAssessments.length + assessments.wearTearAssessments.length + assessments.appraisalReports.length
  };

  return (
    <div className="min-h-screen bg-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/coordinator/dashboard">
              <Button variant="outline" size="sm" className="border-white text-white hover:bg-white hover:text-slate-800">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          
          <Card className="bg-white border border-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Package2 className="w-6 h-6 text-black" />
                  <div>
                    <CardTitle className="text-black text-xl">Package Preparation</CardTitle>
                    <p className="text-gray-600">{inspectionRequest.title}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-black text-black">
                  {inspectionRequest.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Package Configuration */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
                <TabsTrigger value="media" data-testid="tab-media">Media</TabsTrigger>
                <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
                <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Info className="w-5 h-5" />
                      <span>Inspection Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Client Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600">Client</label>
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-500" />
                          <span className="font-medium" data-testid="text-client-name">{client.name}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600">Contact</label>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>{client.contactPerson || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location & Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600">Location</label>
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                          <span className="text-sm">
                            {inspectionRequest.location?.address 
                              ? `${inspectionRequest.location.address}, ${inspectionRequest.location.city}, ${inspectionRequest.location.state}`
                              : 'Location on file'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600">Completed Date</label>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{format(new Date(inspectionRequest.completedDate || Date.now()), 'PPP')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Package Contents Summary */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Package Contents</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-md">
                          <FileText className="w-6 h-6 text-red-500 mx-auto mb-1" />
                          <div className="font-bold text-lg" data-testid="count-reports">{packageStats.reports}</div>
                          <div className="text-xs text-gray-600">Reports</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-md">
                          <Image className="w-6 h-6 text-green-500 mx-auto mb-1" />
                          <div className="font-bold text-lg" data-testid="count-images">{packageStats.images}</div>
                          <div className="text-xs text-gray-600">Images</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-md">
                          <Video className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                          <div className="font-bold text-lg" data-testid="count-videos">{packageStats.videos}</div>
                          <div className="text-xs text-gray-600">Videos</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-md">
                          <BarChart3 className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                          <div className="font-bold text-lg" data-testid="count-assessments">{packageStats.totalAssessments}</div>
                          <div className="text-xs text-gray-600">Assessments</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5" />
                        <span>Inspection Reports ({reports.length})</span>
                      </div>
                      <Checkbox
                        checked={preparationData.includeReports}
                        onCheckedChange={(checked) => 
                          setPreparationData(prev => ({ ...prev, includeReports: checked as boolean }))
                        }
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {reports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={preparationData.selectedReports.includes(report.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPreparationData(prev => ({
                                    ...prev,
                                    selectedReports: [...prev.selectedReports, report.id]
                                  }));
                                } else {
                                  setPreparationData(prev => ({
                                    ...prev,
                                    selectedReports: prev.selectedReports.filter(id => id !== report.id)
                                  }));
                                }
                              }}
                              data-testid={`checkbox-report-${report.id}`}
                            />
                            <div>
                              <p className="font-medium">{report.title}</p>
                              <p className="text-sm text-gray-600">
                                Type: {report.reportType.replace('_', ' ')} | 
                                Status: {report.status.replace('_', ' ')} |
                                Generated: {format(new Date(report.generatedAt), 'PPp')}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" data-testid={`button-preview-report-${report.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      
                      {reports.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p>No inspection reports available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media">
                <div className="space-y-6">
                  {/* Images */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Image className="w-5 h-5" />
                          <span>Images ({media.images.length})</span>
                        </div>
                        <Checkbox
                          checked={preparationData.includeMedia && media.images.length > 0}
                          onCheckedChange={(checked) => 
                            setPreparationData(prev => ({ ...prev, includeMedia: checked as boolean }))
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {media.images.map((image) => (
                          <div key={image.id} className="relative">
                            <div className="aspect-square bg-gray-100 rounded-md overflow-hidden">
                              <img 
                                src={image.thumbnailUrl || image.originalUrl} 
                                alt={image.filename}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute top-2 left-2">
                              <Checkbox
                                checked={preparationData.selectedImages.includes(image.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPreparationData(prev => ({
                                      ...prev,
                                      selectedImages: [...prev.selectedImages, image.id]
                                    }));
                                  } else {
                                    setPreparationData(prev => ({
                                      ...prev,
                                      selectedImages: prev.selectedImages.filter(id => id !== image.id)
                                    }));
                                  }
                                }}
                                className="bg-white"
                                data-testid={`checkbox-image-${image.id}`}
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-1 truncate">{image.filename}</p>
                          </div>
                        ))}
                      </div>
                      
                      {media.images.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p>No images captured</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Videos */}
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Video className="w-5 h-5" />
                        <span>Videos ({media.videos.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {media.videos.map((video) => (
                          <div key={video.id} className="flex items-center justify-between p-3 border rounded-md">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={preparationData.selectedVideos.includes(video.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPreparationData(prev => ({
                                      ...prev,
                                      selectedVideos: [...prev.selectedVideos, video.id]
                                    }));
                                  } else {
                                    setPreparationData(prev => ({
                                      ...prev,
                                      selectedVideos: prev.selectedVideos.filter(id => id !== video.id)
                                    }));
                                  }
                                }}
                                data-testid={`checkbox-video-${video.id}`}
                              />
                              <Video className="w-8 h-8 text-blue-500" />
                              <div>
                                <p className="font-medium">{video.filename}</p>
                                <p className="text-sm text-gray-600">
                                  Duration: {video.duration || 'Unknown'} | 
                                  Size: {video.size || 'Unknown'} |
                                  Recorded: {format(new Date(video.recordedAt), 'PPp')}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" data-testid={`button-preview-video-${video.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        
                        {media.videos.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p>No videos recorded</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Assessments Tab */}
              <TabsContent value="assessments">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-5 h-5" />
                        <span>Assessments ({packageStats.totalAssessments})</span>
                      </div>
                      <Checkbox
                        checked={preparationData.includeAssessments}
                        onCheckedChange={(checked) => 
                          setPreparationData(prev => ({ ...prev, includeAssessments: checked as boolean }))
                        }
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Asset Assessments */}
                    <div>
                      <h4 className="font-medium mb-3">Asset Assessments ({assessments.assetAssessments.length})</h4>
                      <div className="space-y-2">
                        {assessments.assetAssessments.map((assessment, index) => (
                          <div key={assessment.id} className="p-3 border rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Assessment #{index + 1}</p>
                                <p className="text-sm text-gray-600">
                                  Asset: {assessment.assetType.replace('_', ' ')} | 
                                  Condition: {assessment.overallCondition} |
                                  Score: {assessment.conditionScore}/100
                                </p>
                              </div>
                              <Badge variant={
                                assessment.overallCondition === 'excellent' ? 'default' :
                                assessment.overallCondition === 'good' ? 'secondary' :
                                assessment.overallCondition === 'fair' ? 'outline' : 'destructive'
                              }>
                                {assessment.overallCondition}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wear & Tear Assessments */}
                    <div>
                      <h4 className="font-medium mb-3">Wear & Tear Assessments ({assessments.wearTearAssessments.length})</h4>
                      <div className="space-y-2">
                        {assessments.wearTearAssessments.map((assessment, index) => (
                          <div key={assessment.id} className="p-3 border rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Component #{index + 1}</p>
                                <p className="text-sm text-gray-600">
                                  Type: {assessment.componentType.replace('_', ' ')} | 
                                  Wear: {assessment.wearLevel} ({assessment.wearPercentage}%) |
                                  Priority: {assessment.replacementPriority}
                                </p>
                              </div>
                              <Badge variant={
                                assessment.wearLevel === 'minimal' ? 'default' :
                                assessment.wearLevel === 'light' ? 'secondary' :
                                assessment.wearLevel === 'moderate' ? 'outline' : 'destructive'
                              }>
                                {assessment.wearLevel}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Appraisal Reports */}
                    <div>
                      <h4 className="font-medium mb-3">Appraisal Reports ({assessments.appraisalReports.length})</h4>
                      <div className="space-y-2">
                        {assessments.appraisalReports.map((appraisal, index) => (
                          <div key={appraisal.id} className="p-3 border rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Appraisal #{index + 1}</p>
                                <p className="text-sm text-gray-600">
                                  Method: {appraisal.appraisalMethod.replace('_', ' ')} | 
                                  Value: ${appraisal.currentMarketValue || 'TBD'} |
                                  Valid until: {appraisal.validUntil ? format(new Date(appraisal.validUntil), 'PPP') : 'No expiration'}
                                </p>
                              </div>
                              <Badge variant="outline">
                                ${appraisal.currentMarketValue || 'TBD'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {packageStats.totalAssessments === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p>No assessments completed</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="w-5 h-5" />
                      <span>Package Settings</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Package Type */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Package Type</label>
                      <Select 
                        value={preparationData.packageType} 
                        onValueChange={handlePackageTypeChange}
                      >
                        <SelectTrigger data-testid="select-package-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="complete">Complete Package (All Components)</SelectItem>
                          <SelectItem value="reports_only">Reports Only</SelectItem>
                          <SelectItem value="media_only">Media Only</SelectItem>
                          <SelectItem value="custom">Custom Selection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Title */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Package Title</label>
                      <Input
                        value={preparationData.customTitle}
                        onChange={(e) => setPreparationData(prev => ({ ...prev, customTitle: e.target.value }))}
                        placeholder={`Inspection Package - ${inspectionRequest.title}`}
                        data-testid="input-package-title"
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Delivery Notes</label>
                      <Textarea
                        value={preparationData.notes}
                        onChange={(e) => setPreparationData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add any special instructions or notes for the client..."
                        rows={4}
                        data-testid="textarea-package-notes"
                      />
                    </div>

                    {/* Component Options */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Include Components</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <label className="font-medium">Inspection Reports</label>
                            <p className="text-sm text-gray-600">{packageStats.reports} report(s) available</p>
                          </div>
                          <Checkbox
                            checked={preparationData.includeReports}
                            onCheckedChange={(checked) => 
                              setPreparationData(prev => ({ ...prev, includeReports: checked as boolean }))
                            }
                            data-testid="checkbox-include-reports"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <label className="font-medium">Media Files</label>
                            <p className="text-sm text-gray-600">{packageStats.images + packageStats.videos} file(s) available</p>
                          </div>
                          <Checkbox
                            checked={preparationData.includeMedia}
                            onCheckedChange={(checked) => 
                              setPreparationData(prev => ({ ...prev, includeMedia: checked as boolean }))
                            }
                            data-testid="checkbox-include-media"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <label className="font-medium">Assessment Data</label>
                            <p className="text-sm text-gray-600">{packageStats.totalAssessments} assessment(s) available</p>
                          </div>
                          <Checkbox
                            checked={preparationData.includeAssessments}
                            onCheckedChange={(checked) => 
                              setPreparationData(prev => ({ ...prev, includeAssessments: checked as boolean }))
                            }
                            data-testid="checkbox-include-assessments"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Package Summary & Actions */}
          <div className="space-y-6">
            {/* Client Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="w-5 h-5" />
                  <span>Delivery Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Client</label>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-gray-600">{client.email}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Contact Person</label>
                  <p>{client.contactPerson || 'Not specified'}</p>
                </div>
                
                {client.phone && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <p>{client.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Package Summary */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package2 className="w-5 h-5" />
                  <span>Package Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Package Type</label>
                  <Badge variant="outline" className="capitalize">
                    {preparationData.packageType.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Components</label>
                  <div className="space-y-1">
                    {preparationData.includeReports && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Reports</span>
                        <Badge variant="secondary">{packageStats.reports}</Badge>
                      </div>
                    )}
                    {preparationData.includeMedia && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span>Images</span>
                          <Badge variant="secondary">{packageStats.images}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Videos</span>
                          <Badge variant="secondary">{packageStats.videos}</Badge>
                        </div>
                      </>
                    )}
                    {preparationData.includeAssessments && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Assessments</span>
                        <Badge variant="secondary">{packageStats.totalAssessments}</Badge>
                      </div>
                    )}
                  </div>
                </div>

                {preparationData.customTitle && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Custom Title</label>
                    <p className="text-sm">{preparationData.customTitle}</p>
                  </div>
                )}

                {preparationData.notes && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Notes</label>
                    <p className="text-sm text-gray-600">{preparationData.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button 
                    className="w-full bg-black text-white hover:bg-gray-800"
                    onClick={handleGeneratePackage}
                    disabled={generatePackageMutation.isPending}
                    data-testid="button-generate-package"
                  >
                    {generatePackageMutation.isPending ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Generating Package...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Generate & Deliver Package
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-black text-black hover:bg-gray-100"
                    data-testid="button-save-draft"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Save as Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Package2 className="w-5 h-5" />
                <span>Confirm Package Generation</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will generate and deliver the inspection package to <strong>{client.name}</strong>.
                An email notification will be sent to <strong>{client.email}</strong> with access instructions.
              </p>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Package will include:</h4>
                <ul className="text-sm space-y-1 ml-4">
                  {preparationData.includeReports && <li>• {packageStats.reports} inspection report(s)</li>}
                  {preparationData.includeMedia && (
                    <>
                      <li>• {packageStats.images} image(s)</li>
                      <li>• {packageStats.videos} video(s)</li>
                    </>
                  )}
                  {preparationData.includeAssessments && <li>• {packageStats.totalAssessments} assessment(s)</li>}
                </ul>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1"
                  data-testid="button-cancel-generate"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmGeneratePackage}
                  disabled={generatePackageMutation.isPending}
                  className="flex-1 bg-black text-white hover:bg-gray-800"
                  data-testid="button-confirm-generate"
                >
                  Generate Package
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}