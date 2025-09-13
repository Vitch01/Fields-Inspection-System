import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building, Plus, Calendar, MapPin, Eye, LogOut, Package2, Download, FileText, Image, Video, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { PackagePreview } from "@/components/package-preview";
import type { InspectionRequest } from "@shared/schema";

interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const storedClient = localStorage.getItem("client");
    if (storedClient) {
      setClient(JSON.parse(storedClient));
    } else {
      setLocation("/client/login");
    }
  }, [setLocation]);

  // Fetch inspection requests for authenticated client using secure endpoint
  const { data: inspectionRequests, isLoading, error } = useQuery<InspectionRequest[]>({
    queryKey: ['/api/inspection-requests/me'],
    enabled: !!client?.id,
  });

  // Fetch inspection packages for authenticated client
  const { data: inspectionPackages, isLoading: packagesLoading, error: packagesError } = useQuery<any[]>({
    queryKey: ['/api/inspection-packages/me'],
    enabled: !!client?.id,
  });

  // Download package mutation
  const downloadPackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest('GET', `/api/inspection-packages/${packageId}/download`);
      return response;
    },
    onSuccess: (data, packageId) => {
      // Track download in database
      queryClient.invalidateQueries({ queryKey: ['/api/inspection-packages/me'] });
      
      // Create download link for the zip file
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || 'inspection-package.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Download Started",
          description: "Your inspection package is downloading...",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download package",
        variant: "destructive",
      });
    },
  });

  // View individual file mutation
  const viewFileMutation = useMutation({
    mutationFn: async ({ packageId, filename, filetype }: { packageId: string, filename: string, filetype: string }) => {
      const response = await apiRequest('GET', `/api/inspection-packages/${packageId}/files/${filename}`);
      return response;
    },
    onSuccess: (data) => {
      if (data.fileUrl) {
        window.open(data.fileUrl, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "File Access Failed",
        description: error.message || "Failed to access file",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("client");
    localStorage.removeItem("authToken"); // Clear JWT token on logout
    toast({
      title: "Logged out successfully",
      description: "You have been signed out",
    });
    setLocation("/client/login");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "assigned":
        return "default";
      case "in_progress":
        return "default";
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending Review";
      case "assigned":
        return "Assigned";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "low":
        return "secondary";
      case "medium":
        return "default";
      case "high":
        return "default";
      case "urgent":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="bg-white border border-white mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building className="w-6 h-6 text-black" />
                <div>
                  <CardTitle className="text-black text-xl">{client.name}</CardTitle>
                  <p className="text-gray-600">{client.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Link href="/client/submit-request">
                  <Button 
                    className="bg-black text-white hover:bg-gray-800"
                    data-testid="button-new-request"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Request
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="border-black text-black hover:bg-gray-100"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Tabbed Interface */}
          <div className="lg:col-span-2">
            <Card className="bg-white border border-white">
              <CardContent className="p-0">
                <Tabs defaultValue="requests" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
                    <TabsTrigger value="requests" data-testid="tab-requests">Inspection Requests</TabsTrigger>
                    <TabsTrigger value="packages" data-testid="tab-packages">Inspection Packages</TabsTrigger>
                  </TabsList>

                  {/* Inspection Requests Tab */}
                  <TabsContent value="requests" className="m-4 mt-6">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="text-gray-600">Loading requests...</div>
                      </div>
                    ) : error ? (
                      <div className="text-center py-8">
                        <div className="text-red-600">Error loading requests</div>
                      </div>
                    ) : !inspectionRequests || inspectionRequests.length === 0 ? (
                      <div className="text-center py-8">
                        <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-black mb-2">No inspection requests yet</h3>
                        <p className="text-gray-600 mb-4">Submit your first inspection request to get started.</p>
                        <Link href="/client/submit-request">
                          <Button className="bg-black text-white hover:bg-gray-800">
                            <Plus className="w-4 h-4 mr-2" />
                            Submit Request
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {inspectionRequests.map((request) => (
                          <Card key={request.id} className="border border-gray-200 hover-elevate">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-medium text-black text-lg mb-1" data-testid={`text-request-title-${request.id}`}>
                                    {request.title}
                                  </h4>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                    <span className="flex items-center">
                                      <Calendar className="w-4 h-4 mr-1" />
                                      {request.requestedDate ? format(new Date(request.requestedDate), "MMM d, yyyy") : "No date set"}
                                    </span>
                                    {request.location && typeof request.location === 'object' && 'address' in request.location && (
                                      <span className="flex items-center">
                                        <MapPin className="w-4 h-4 mr-1" />
                                        {(request.location as any).address}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-700 text-sm mb-3">{request.description}</p>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant={getStatusBadgeVariant(request.status)} data-testid={`badge-status-${request.id}`}>
                                      {getStatusText(request.status)}
                                    </Badge>
                                    <Badge variant={getPriorityBadgeVariant(request.priority)} data-testid={`badge-priority-${request.id}`}>
                                      {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} Priority
                                    </Badge>
                                    <Badge variant="outline" className="text-black border-black">
                                      {request.assetType.replace('_', ' ').charAt(0).toUpperCase() + request.assetType.replace('_', ' ').slice(1)}
                                    </Badge>
                                  </div>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-black text-black hover:bg-gray-100"
                                  data-testid={`button-view-${request.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Inspection Packages Tab */}
                  <TabsContent value="packages" className="m-4 mt-6">
                    {packagesLoading ? (
                      <div className="text-center py-8">
                        <div className="text-gray-600">Loading packages...</div>
                      </div>
                    ) : packagesError ? (
                      <div className="text-center py-8">
                        <div className="text-red-600">Error loading packages</div>
                      </div>
                    ) : !inspectionPackages || inspectionPackages.length === 0 ? (
                      <div className="text-center py-8">
                        <Package2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-black mb-2">No inspection packages yet</h3>
                        <p className="text-gray-600 mb-4">Completed inspections will appear here for download.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {inspectionPackages.map((pkg) => {
                          // Find related inspection request
                          const relatedRequest = inspectionRequests?.find(req => req.id === pkg.inspectionRequestId);
                          return (
                            <PackagePreview
                              key={pkg.id}
                              inspectionPackage={pkg}
                              inspectionRequest={relatedRequest || { title: 'Unknown Inspection', id: pkg.inspectionRequestId }}
                              client={client}
                              onDownload={(packageId) => downloadPackageMutation.mutate(packageId)}
                              onViewFile={(filename, filetype) => viewFileMutation.mutate({ 
                                packageId: pkg.id, 
                                filename, 
                                filetype 
                              })}
                              data-testid={`package-${pkg.id}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Statistics */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-white border border-white">
              <CardHeader>
                <CardTitle className="text-black">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/client/submit-request">
                  <Button className="w-full bg-black text-white hover:bg-gray-800" data-testid="button-quick-submit">
                    <Plus className="w-4 h-4 mr-2" />
                    Submit New Request
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  className="w-full border-black text-black hover:bg-gray-100"
                  data-testid="button-contact-support"
                >
                  Contact Support
                </Button>
              </CardContent>
            </Card>

            {/* Request Statistics */}
            {inspectionRequests && inspectionRequests.length > 0 && (
              <Card className="bg-white border border-white">
                <CardHeader>
                  <CardTitle className="text-black">Request Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Requests</span>
                      <span className="font-medium text-black" data-testid="text-total-requests">{inspectionRequests.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-medium text-black" data-testid="text-pending-requests">
                        {inspectionRequests.filter(r => r.status === 'pending').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">In Progress</span>
                      <span className="font-medium text-black" data-testid="text-in-progress-requests">
                        {inspectionRequests.filter(r => r.status === 'in_progress').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-medium text-black" data-testid="text-completed-requests">
                        {inspectionRequests.filter(r => r.status === 'completed').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Package Statistics */}
            {inspectionPackages && inspectionPackages.length > 0 && (
              <Card className="bg-white border border-white">
                <CardHeader>
                  <CardTitle className="text-black flex items-center space-x-2">
                    <Package2 className="w-5 h-5" />
                    <span>Package Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Packages</span>
                      <span className="font-medium text-black" data-testid="text-total-packages">{inspectionPackages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ready</span>
                      <span className="font-medium text-black" data-testid="text-ready-packages">
                        {inspectionPackages.filter(p => p.status === 'ready').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivered</span>
                      <span className="font-medium text-black" data-testid="text-delivered-packages">
                        {inspectionPackages.filter(p => p.status === 'delivered').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Downloaded</span>
                      <span className="font-medium text-black" data-testid="text-downloaded-packages">
                        {inspectionPackages.filter(p => p.downloadCount > 0).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}