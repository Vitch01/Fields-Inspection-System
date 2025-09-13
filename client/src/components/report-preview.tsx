import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Download, 
  Eye, 
  Building,
  TrendingDown,
  DollarSign,
  Camera,
  Play,
  Calendar,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench
} from "lucide-react";
import { format } from "date-fns";

interface ReportPreviewProps {
  inspectionRequestId: string;
  callId?: string;
  onGeneratePdf?: () => void;
  className?: string;
}

interface MediaItem {
  id: string;
  originalUrl: string;
  thumbnailUrl: string;
  notes?: string;
  capturedAt: string;
  type: 'image' | 'video';
}

interface AssessmentData {
  assetAssessments: any[];
  wearTearAssessments: any[];
  appraisalReports: any[];
  media: {
    images: MediaItem[];
    videos: MediaItem[];
  };
}

export default function ReportPreview({ inspectionRequestId, callId, onGeneratePdf, className }: ReportPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  
  // Fetch inspection request data
  const { data: inspectionRequest, isLoading: inspectionLoading } = useQuery({
    queryKey: ['/api/inspection-requests', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Fetch client data
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['/api/clients', inspectionRequest?.clientId],
    enabled: !!inspectionRequest?.clientId
  });

  // Fetch report data aggregation
  const { data: reportData, isLoading: reportDataLoading } = useQuery<AssessmentData>({
    queryKey: ['/api/reports/data/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Helper functions
  const getConditionColor = (condition: string) => {
    switch (condition?.toLowerCase()) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-yellow-500 text-white';
      case 'poor': return 'bg-orange-500 text-white';
      case 'critical': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getWearLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'minimal': return 'bg-green-500 text-white';
      case 'light': return 'bg-blue-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-white';
      case 'heavy': return 'bg-orange-500 text-white';
      case 'severe': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'bg-green-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'critical': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return 'N/A';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numValue);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'PPP');
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    if (!reportData) return { totalCost: 0, criticalIssues: 0, recommendationsCount: 0 };

    let totalCost = 0;
    let criticalIssues = 0;
    let recommendationsCount = 0;

    // Asset assessments
    reportData.assetAssessments?.forEach(assessment => {
      if (assessment.estimatedRepairCost) {
        totalCost += parseFloat(assessment.estimatedRepairCost) || 0;
      }
      if (assessment.overallCondition === 'critical' || assessment.urgencyLevel === 'critical') {
        criticalIssues++;
      }
      if (assessment.recommendedActions) {
        recommendationsCount++;
      }
    });

    // Wear & tear assessments
    reportData.wearTearAssessments?.forEach(assessment => {
      if (assessment.replacementCost) {
        totalCost += parseFloat(assessment.replacementCost) || 0;
      }
      if (assessment.wearLevel === 'severe' || assessment.replacementPriority === 'critical') {
        criticalIssues++;
      }
    });

    return { totalCost, criticalIssues, recommendationsCount };
  };

  const stats = calculateSummaryStats();

  if (inspectionLoading || clientLoading || reportDataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading report preview...</p>
        </div>
      </div>
    );
  }

  if (!inspectionRequest || !reportData) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">Unable to Load Report Preview</p>
        <p className="text-muted-foreground">Please ensure all assessments are completed.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Report Header */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="text-center bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-primary">Professional Field Inspection Services</div>
            <h1 className="text-xl font-semibold" data-testid="text-report-title">
              Comprehensive Inspection Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Generated on {formatDate(new Date())} | Report ID: REPORT-{Date.now()}
            </p>
          </div>
        </CardHeader>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Executive Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <DollarSign className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Estimated Total Cost</p>
              <p className="text-xl font-bold" data-testid="text-total-cost">{formatCurrency(stats.totalCost.toString())}</p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-xl font-bold text-red-600" data-testid="count-critical-issues">{stats.criticalIssues}</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Assessments Completed</p>
              <p className="text-xl font-bold text-green-600" data-testid="count-assessments-completed">
                {(reportData.assetAssessments?.length || 0) + (reportData.wearTearAssessments?.length || 0) + (reportData.appraisalReports?.length || 0)}
              </p>
            </div>
          </div>

          {/* Client and Asset Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Client Information
              </h3>
              <div className="space-y-1 text-sm">
                <p><strong>Name:</strong> {client?.name || 'N/A'}</p>
                <p><strong>Email:</strong> {client?.email || 'N/A'}</p>
                <p><strong>Phone:</strong> {client?.phone || 'N/A'}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Asset Information
              </h3>
              <div className="space-y-1 text-sm">
                <p><strong>Type:</strong> {inspectionRequest.assetType}</p>
                <p><strong>Priority:</strong> 
                  <Badge className={`ml-2 ${getPriorityColor(inspectionRequest.priority)}`}>
                    {inspectionRequest.priority?.toUpperCase()}
                  </Badge>
                </p>
                <p><strong>Estimated Value:</strong> {formatCurrency(inspectionRequest.estimatedValue)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Condition Assessments */}
      {reportData.assetAssessments && reportData.assetAssessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5" />
              <span>Asset Condition Assessments</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportData.assetAssessments.map((assessment: any, index: number) => (
              <div key={assessment.id || index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{assessment.assetType}</h4>
                  <div className="flex space-x-2">
                    <Badge className={getConditionColor(assessment.overallCondition)}>
                      {assessment.overallCondition?.toUpperCase()}
                    </Badge>
                    <Badge className={getPriorityColor(assessment.urgencyLevel)}>
                      {assessment.urgencyLevel?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{assessment.assetDescription}</p>
                
                {/* Assessment Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Condition Score</p>
                    <p className="font-medium">{assessment.conditionScore}/100</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Structural Integrity</p>
                    <p className="font-medium text-xs">{assessment.structuralIntegrity || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Functional Status</p>
                    <p className="font-medium text-xs">{assessment.functionalStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Repair Cost</p>
                    <p className="font-medium">{formatCurrency(assessment.estimatedRepairCost)}</p>
                  </div>
                </div>

                {assessment.recommendedActions && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Recommended Actions:</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">{assessment.recommendedActions}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Wear & Tear Analysis */}
      {reportData.wearTearAssessments && reportData.wearTearAssessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5" />
              <span>Wear & Tear Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportData.wearTearAssessments.map((assessment: any, index: number) => (
              <div key={assessment.id || index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{assessment.componentType}</h4>
                  <div className="flex space-x-2">
                    <Badge className={getWearLevelColor(assessment.wearLevel)}>
                      {assessment.wearLevel?.toUpperCase()}
                    </Badge>
                    <Badge className={getPriorityColor(assessment.replacementPriority)}>
                      {assessment.replacementPriority?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{assessment.componentDescription}</p>
                
                {/* Wear Assessment Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Wear Percentage</p>
                    <p className="font-medium">{assessment.wearPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Life Remaining</p>
                    <p className="font-medium text-xs">{assessment.expectedLifeRemaining || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Replacement Cost</p>
                    <p className="font-medium">{formatCurrency(assessment.replacementCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maintenance Cost</p>
                    <p className="font-medium">{formatCurrency(assessment.maintenanceCost)}</p>
                  </div>
                </div>

                {assessment.environmentalFactors && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Environmental Factors:</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{assessment.environmentalFactors}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Appraisal Reports */}
      {reportData.appraisalReports && reportData.appraisalReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <span>Asset Appraisal</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportData.appraisalReports.map((report: any, index: number) => (
              <div key={report.id || index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{report.assetType}</h4>
                  <div className="flex space-x-2">
                    <Badge className="bg-blue-500 text-white">
                      {report.appraisalMethod?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {report.certificationRequired && (
                      <Badge className="bg-purple-500 text-white">CERTIFIED</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{report.assetDescription}</p>
                
                {/* Valuation Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Market Value</p>
                    <p className="font-medium">{formatCurrency(report.currentMarketValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Replacement Cost</p>
                    <p className="font-medium">{formatCurrency(report.replacementCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Depreciation</p>
                    <p className="font-medium">{formatCurrency(report.depreciation)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Salvage Value</p>
                    <p className="font-medium">{formatCurrency(report.salvageValue)}</p>
                  </div>
                </div>

                {report.appraiserNotes && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                    <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">Appraiser Notes:</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{report.appraiserNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Media Documentation */}
      {reportData.media && (reportData.media.images.length > 0 || reportData.media.videos.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Documentation Media</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Photo Gallery */}
              {reportData.media.images.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Photographic Documentation ({reportData.media.images.length} photos)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {reportData.media.images.slice(0, 8).map((image, index) => (
                      <div key={image.id || index} className="relative group cursor-pointer">
                        <img
                          src={image.thumbnailUrl || image.originalUrl}
                          alt="Inspection Photo"
                          className="w-full h-32 object-cover rounded-lg border hover:opacity-75 transition-opacity"
                          onClick={() => setSelectedImage(image)}
                          data-testid={`image-thumbnail-${index}`}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {image.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{image.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {reportData.media.images.length > 8 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Additional {reportData.media.images.length - 8} photos available in full report.
                    </p>
                  )}
                </div>
              )}

              {/* Video Documentation */}
              {reportData.media.videos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Video Documentation ({reportData.media.videos.length} videos)</h4>
                  <div className="space-y-2">
                    {reportData.media.videos.map((video, index) => (
                      <div key={video.id || index} className="flex items-center space-x-3 p-2 border rounded">
                        <Play className="w-5 h-5 text-blue-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Video {index + 1}</p>
                          <p className="text-xs text-muted-foreground">
                            Captured {formatDate(video.capturedAt)}
                          </p>
                        </div>
                        {video.notes && (
                          <p className="text-xs text-muted-foreground max-w-32 truncate">{video.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Report ready for generation</p>
              <p className="text-xs text-muted-foreground mt-1">
                This preview shows how your final report will appear
              </p>
            </div>
            <Button 
              onClick={onGeneratePdf}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-generate-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate PDF Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Inspection Photo</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.originalUrl}
                alt="Full size inspection photo"
                className="w-full max-h-96 object-contain rounded-lg"
                data-testid="image-full-size"
              />
              <div className="text-sm text-muted-foreground">
                <p><strong>Captured:</strong> {formatDate(selectedImage.capturedAt)}</p>
                {selectedImage.notes && (
                  <p><strong>Notes:</strong> {selectedImage.notes}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}