import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Package2, 
  FileText, 
  Image, 
  Video, 
  Download,
  Eye,
  Clock,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Calendar,
  User,
  Mail,
  Send,
  Settings
} from "lucide-react";
import { format } from "date-fns";

interface PackageDetailsParams {
  id: string;
}

interface InspectionPackage {
  id: string;
  title: string;
  description: string;
  status: string;
  packageType: string;
  packageContents: any;
  createdAt: string;
  deliveredAt?: string;
  firstAccessedAt?: string;
  lastAccessedAt?: string;
  downloadCount: number;
  notificationsSent: number;
  inspectionRequest: {
    id: string;
    title: string;
    assetType: string;
    location: any;
  };
  client: {
    id: string;
    name: string;
    email: string;
  };
}

export default function CoordinatorPackageDetails() {
  const { id } = useParams<PackageDetailsParams>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendNotes, setResendNotes] = useState("");

  // Fetch package details
  const { data: packageDetails, isLoading, error } = useQuery<InspectionPackage>({
    queryKey: ['/api/coordinator/inspection-packages', id],
    enabled: !!id,
  });

  // Update package status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      return apiRequest('PATCH', `/api/coordinator/inspection-packages/${id}/status`, { status, notes });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Package status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/coordinator/inspection-packages', id] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update package status",
        variant: "destructive",
      });
    },
  });

  // Resend notification mutation
  const resendNotificationMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest('POST', `/api/coordinator/inspection-packages/${id}/resend-notification`, { notes });
    },
    onSuccess: () => {
      toast({
        title: "Notification Sent",
        description: "Email notification has been sent to the client.",
      });
      setShowResendDialog(false);
      setResendNotes("");
      queryClient.invalidateQueries({ queryKey: ['/api/coordinator/inspection-packages', id] });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate({ status: newStatus });
  };

  const handleResendNotification = () => {
    resendNotificationMutation.mutate(resendNotes);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "ready":
        return "default";
      case "delivered":
        return "default";
      case "accessed":
        return "default";
      case "archived":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "ready":
        return "Ready for Delivery";
      case "delivered":
        return "Delivered";
      case "accessed":
        return "Client Accessed";
      case "archived":
        return "Archived";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Package2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <div className="text-white">Loading package details...</div>
        </div>
      </div>
    );
  }

  if (error || !packageDetails) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <div className="text-white mb-4">Failed to load package details</div>
          <Link href="/coordinator/dashboard">
            <Button variant="outline" className="border-white text-white hover:bg-white hover:text-slate-800">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate package statistics
  const packageStats = {
    totalFiles: packageDetails.packageContents?.files?.length || 0,
    reports: packageDetails.packageContents?.reports?.length || 0,
    images: packageDetails.packageContents?.images?.length || 0,
    videos: packageDetails.packageContents?.videos?.length || 0
  };

  return (
    <div className="min-h-screen bg-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="bg-white border border-white mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link href="/coordinator/dashboard">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-black hover:bg-gray-100"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <Package2 className="w-6 h-6 text-black" />
                <div>
                  <CardTitle className="text-black text-xl">{packageDetails.title}</CardTitle>
                  <p className="text-gray-600">{packageDetails.inspectionRequest.title}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge 
                  variant={getStatusBadgeVariant(packageDetails.status)}
                  data-testid={`badge-status-${packageDetails.status}`}
                >
                  {getStatusText(packageDetails.status)}
                </Badge>
                <Dialog open={showResendDialog} onOpenChange={setShowResendDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline"
                      className="border-black text-black hover:bg-gray-100"
                      data-testid="button-resend-notification"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Resend Notification
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Resend Package Notification</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Additional Notes (Optional)</label>
                        <Textarea
                          value={resendNotes}
                          onChange={(e) => setResendNotes(e.target.value)}
                          placeholder="Add any additional message for the client..."
                          className="mt-1"
                          data-testid="textarea-resend-notes"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowResendDialog(false)}
                          data-testid="button-cancel-resend"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleResendNotification}
                          disabled={resendNotificationMutation.isPending}
                          data-testid="button-confirm-resend"
                        >
                          {resendNotificationMutation.isPending ? "Sending..." : "Send Notification"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Package Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Package Overview */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black flex items-center">
                  <Package2 className="w-5 h-5 mr-2" />
                  Package Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">{packageStats.totalFiles}</div>
                    <div className="text-sm text-gray-600">Total Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">{packageStats.reports}</div>
                    <div className="text-sm text-gray-600">Reports</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">{packageStats.images}</div>
                    <div className="text-sm text-gray-600">Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">{packageStats.videos}</div>
                    <div className="text-sm text-gray-600">Videos</div>
                  </div>
                </div>
                {packageDetails.description && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-black mb-2">Description</h4>
                    <p className="text-gray-600">{packageDetails.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Package Contents */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black">Package Contents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {packageDetails.packageContents?.reports && packageDetails.packageContents.reports.length > 0 && (
                    <div>
                      <h4 className="font-medium text-black mb-2 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Reports ({packageDetails.packageContents.reports.length})
                      </h4>
                      <div className="space-y-2">
                        {packageDetails.packageContents.reports.map((report: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm text-gray-700">{report.title || `Report ${index + 1}`}</span>
                            <Badge variant="secondary" className="text-xs">PDF</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {packageDetails.packageContents?.images && packageDetails.packageContents.images.length > 0 && (
                    <div>
                      <h4 className="font-medium text-black mb-2 flex items-center">
                        <Image className="w-4 h-4 mr-2" />
                        Images ({packageDetails.packageContents.images.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {packageDetails.packageContents.images.slice(0, 8).map((image: any, index: number) => (
                          <div key={index} className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                            <Image className="w-8 h-8 text-gray-400" />
                          </div>
                        ))}
                        {packageDetails.packageContents.images.length > 8 && (
                          <div className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-sm text-gray-500">+{packageDetails.packageContents.images.length - 8}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {packageDetails.packageContents?.videos && packageDetails.packageContents.videos.length > 0 && (
                    <div>
                      <h4 className="font-medium text-black mb-2 flex items-center">
                        <Video className="w-4 h-4 mr-2" />
                        Videos ({packageDetails.packageContents.videos.length})
                      </h4>
                      <div className="space-y-2">
                        {packageDetails.packageContents.videos.map((video: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm text-gray-700">{video.filename || `Video ${index + 1}`}</span>
                            <Badge variant="secondary" className="text-xs">{video.duration || 'Video'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Information */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Name</div>
                    <div className="font-medium text-black">{packageDetails.client.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Email</div>
                    <div className="font-medium text-black">{packageDetails.client.email}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Package Activity */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Package Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Downloads</span>
                    <Badge variant="secondary">{packageDetails.downloadCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notifications Sent</span>
                    <Badge variant="secondary">{packageDetails.notificationsSent}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-600">Created:</span>
                      <div className="font-medium text-black">
                        {format(new Date(packageDetails.createdAt), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                    {packageDetails.deliveredAt && (
                      <div className="text-sm">
                        <span className="text-gray-600">Delivered:</span>
                        <div className="font-medium text-black">
                          {format(new Date(packageDetails.deliveredAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    )}
                    {packageDetails.firstAccessedAt && (
                      <div className="text-sm">
                        <span className="text-gray-600">First Accessed:</span>
                        <div className="font-medium text-black">
                          {format(new Date(packageDetails.firstAccessedAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    )}
                    {packageDetails.lastAccessedAt && (
                      <div className="text-sm">
                        <span className="text-gray-600">Last Accessed:</span>
                        <div className="font-medium text-black">
                          {format(new Date(packageDetails.lastAccessedAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Management */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Package Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    variant={packageDetails.status === 'ready' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusUpdate('ready')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-ready"
                  >
                    Mark as Ready
                  </Button>
                  <Button
                    variant={packageDetails.status === 'delivered' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusUpdate('delivered')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-delivered"
                  >
                    Mark as Delivered
                  </Button>
                  <Button
                    variant={packageDetails.status === 'archived' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => handleStatusUpdate('archived')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-archived"
                  >
                    Archive Package
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}