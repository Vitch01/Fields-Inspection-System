import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package2, 
  FileText, 
  Image, 
  Video, 
  BarChart3,
  Download,
  Eye,
  Calendar,
  User,
  MapPin,
  Building
} from "lucide-react";
import { format } from "date-fns";

interface PackagePreviewProps {
  inspectionPackage: any;
  inspectionRequest: any;
  client: any;
  onDownload?: (packageId: string) => void;
  onViewFile?: (fileId: string, fileType: string) => void;
  className?: string;
}

export function PackagePreview({ 
  inspectionPackage, 
  inspectionRequest, 
  client,
  onDownload,
  onViewFile,
  className = ""
}: PackagePreviewProps) {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const packageContents = inspectionPackage.packageContents || {};
  const reportCount = packageContents.reports?.length || 0;
  const imageCount = packageContents.media?.images?.length || 0;
  const videoCount = packageContents.media?.videos?.length || 0;
  const assessmentCount = packageContents.assessments?.length || 0;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ready":
        return "default";
      case "delivered":
        return "secondary";
      case "accessed":
        return "outline";
      case "draft":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ready":
        return "Ready for Delivery";
      case "delivered":
        return "Delivered";
      case "accessed":
        return "Client Accessed";
      case "draft":
        return "Draft";
      default:
        return status;
    }
  };

  // Format file size
  const formatFileSize = (sizeInBytes: string | number) => {
    const bytes = typeof sizeInBytes === 'string' ? parseInt(sizeInBytes) : sizeInBytes;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Card className={`bg-white hover:shadow-md transition-shadow ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package2 className="w-6 h-6 text-black" />
              <div>
                <CardTitle className="text-black text-lg">{inspectionPackage.title}</CardTitle>
                <p className="text-gray-600 text-sm">{inspectionRequest.title}</p>
              </div>
            </div>
            <Badge 
              variant={getStatusBadgeVariant(inspectionPackage.status)}
              data-testid={`badge-package-status-${inspectionPackage.status}`}
            >
              {getStatusText(inspectionPackage.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client Information */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{client.name}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(inspectionPackage.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>

          {/* Package Contents Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <FileText className="w-4 h-4 text-red-500 mx-auto mb-1" />
              <div className="font-bold text-sm" data-testid={`count-reports-${inspectionPackage.id}`}>{reportCount}</div>
              <div className="text-xs text-gray-600">Reports</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <Image className="w-4 h-4 text-green-500 mx-auto mb-1" />
              <div className="font-bold text-sm" data-testid={`count-images-${inspectionPackage.id}`}>{imageCount}</div>
              <div className="text-xs text-gray-600">Images</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <Video className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <div className="font-bold text-sm" data-testid={`count-videos-${inspectionPackage.id}`}>{videoCount}</div>
              <div className="text-xs text-gray-600">Videos</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <BarChart3 className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
              <div className="font-bold text-sm" data-testid={`count-assessments-${inspectionPackage.id}`}>{assessmentCount}</div>
              <div className="text-xs text-gray-600">Data</div>
            </div>
          </div>

          {/* Package Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Package Size:</span>
              <span className="font-medium">{formatFileSize(inspectionPackage.zipFileSize || 0)}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Package Type:</span>
              <Badge variant="outline" className="capitalize text-xs">
                {inspectionPackage.packageType.replace('_', ' ')}
              </Badge>
            </div>

            {inspectionPackage.deliveredAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delivered:</span>
                <span className="font-medium">{format(new Date(inspectionPackage.deliveredAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}

            {inspectionPackage.lastAccessedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Accessed:</span>
                <span className="font-medium">{format(new Date(inspectionPackage.lastAccessedAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}

            {inspectionPackage.downloadCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Downloads:</span>
                <span className="font-medium">{inspectionPackage.downloadCount}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setShowDetailsDialog(true)}
              data-testid={`button-view-details-${inspectionPackage.id}`}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
            
            <Button 
              size="sm" 
              className="flex-1 bg-black text-white hover:bg-gray-800"
              onClick={() => onDownload?.(inspectionPackage.id)}
              data-testid={`button-download-${inspectionPackage.id}`}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>

          {inspectionPackage.description && (
            <p className="text-sm text-gray-600 border-t pt-2 mt-2">
              {inspectionPackage.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Package Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package2 className="w-5 h-5" />
              <span>Package Details</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Package Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Package Title</label>
                <p className="font-medium">{inspectionPackage.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(inspectionPackage.status)}>
                    {getStatusText(inspectionPackage.status)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Inspection Information */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Inspection Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Client</label>
                  <p>{client.name}</p>
                  <p className="text-sm text-gray-600">{client.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Inspection Request</label>
                  <p>{inspectionRequest.title}</p>
                  <p className="text-sm text-gray-600">
                    {inspectionRequest.assetType.replace('_', ' ')} | {inspectionRequest.inspectionType.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Package Contents Detail */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Package Contents</h4>
              
              {/* Reports */}
              {reportCount > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-2">Reports ({reportCount})</h5>
                  <div className="space-y-2">
                    {packageContents.reports?.map((report: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-red-500" />
                          <span className="text-sm">{report.fileName}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">{report.type.toUpperCase()}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => onViewFile?.(report.fileName, 'report')}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Images */}
              {imageCount > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-2">Images ({imageCount})</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {packageContents.media?.images?.slice(0, 4).map((image: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <Image className="w-4 h-4 text-green-500" />
                          <span className="text-sm truncate">{image.fileName}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onViewFile?.(image.fileName, 'image')}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {imageCount > 4 && (
                      <div className="text-center text-sm text-gray-600 p-2">
                        +{imageCount - 4} more images
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videoCount > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-2">Videos ({videoCount})</h5>
                  <div className="space-y-2">
                    {packageContents.media?.videos?.map((video: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <Video className="w-4 h-4 text-blue-500" />
                          <div>
                            <span className="text-sm">{video.fileName}</span>
                            {video.duration && (
                              <p className="text-xs text-gray-600">Duration: {video.duration}</p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onViewFile?.(video.fileName, 'video')}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessments */}
              {assessmentCount > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-2">Assessment Data ({assessmentCount})</h5>
                  <div className="space-y-2">
                    {packageContents.assessments?.map((assessment: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">{assessment.fileName}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{assessment.type.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Package Metadata */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Package Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-600">Created</label>
                  <p>{format(new Date(inspectionPackage.createdAt), 'PPP p')}</p>
                </div>
                <div>
                  <label className="text-gray-600">Package Size</label>
                  <p>{formatFileSize(inspectionPackage.zipFileSize || 0)}</p>
                </div>
                {inspectionPackage.deliveredAt && (
                  <div>
                    <label className="text-gray-600">Delivered</label>
                    <p>{format(new Date(inspectionPackage.deliveredAt), 'PPP p')}</p>
                  </div>
                )}
                {inspectionPackage.expiresAt && (
                  <div>
                    <label className="text-gray-600">Expires</label>
                    <p>{format(new Date(inspectionPackage.expiresAt), 'PPP')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {inspectionPackage.notes && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{inspectionPackage.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-4 flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDetailsDialog(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button 
                onClick={() => onDownload?.(inspectionPackage.id)}
                className="flex-1 bg-black text-white hover:bg-gray-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Package
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}