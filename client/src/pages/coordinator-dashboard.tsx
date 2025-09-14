import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Filter, 
  Search, 
  Calendar, 
  MapPin, 
  User, 
  Building, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  UserCheck,
  Eye,
  Play,
  ArrowRight,
  Briefcase,
  TrendingUp,
  Users,
  Map,
  Download,
  ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import type { InspectionRequest } from "@shared/schema";
import { FieldMap } from "@/components/field-map/field-map";

// Helper function to decode JWT token and get user data
function getCurrentUserFromToken() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  
  try {
    // JWT tokens have three parts separated by dots
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    return {
      id: payload.userId,
      name: payload.name,
      role: payload.role,
      username: payload.username,
      email: payload.email,
      departmentId: payload.departmentId
    };
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

// Mock data for coordinators and departments (in real app, fetch from API)
const mockCoordinators = [
  { id: "60fdfee6-cf4b-4841-b3e1-d52d36910eab", name: "Sarah Johnson", department: "Engineering" },
  { id: "baaafcf3-5306-4a53-a264-143e71902f22", name: "Sarah Johnson (Alt)", department: "Facilities" },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "Lisa Rodriguez", department: "Safety" }
];

const mockDepartments = [
  { id: "550e8400-e29b-41d4-a716-446655440010", name: "Engineering", description: "Structural and mechanical inspections" },
  { id: "550e8400-e29b-41d4-a716-446655440011", name: "Facilities", description: "Building and infrastructure assessments" },
  { id: "550e8400-e29b-41d4-a716-446655440012", name: "Safety", description: "Safety compliance and risk assessments" }
];

interface RequestDetailsProps {
  request: InspectionRequest;
  onAssign: (type: 'department' | 'coordinator', id: string) => void;
  onUpdateStatus: (requestId: string, status: string) => void;
  onStartCall: (requestId: string) => void;
  onClose: () => void;
}

function RequestDetails({ request, onAssign, onUpdateStatus, onStartCall, onClose }: RequestDetailsProps) {
  const [assignmentType, setAssignmentType] = useState<'department' | 'coordinator'>('coordinator');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(request.status);

  // Sync selectedStatus when request changes
  useEffect(() => {
    setSelectedStatus(request.status);
  }, [request.id, request.status]);

  const handleAssign = () => {
    if (selectedAssignee) {
      onAssign(assignmentType, selectedAssignee);
      onClose();
    }
  };

  const handleStatusUpdate = () => {
    if (selectedStatus && selectedStatus !== request.status) {
      onUpdateStatus(request.id, selectedStatus);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 border-red-200 text-red-800';
      case 'high': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200 text-green-800';
      case 'in_progress': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'assigned': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'pending': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const location = request.location as any;

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-request-title">{request.title}</h2>
          <p className="text-muted-foreground mt-1">Request ID: {request.id}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            className={`${getPriorityColor(request.priority)} border`}
            data-testid={`badge-priority-${request.priority}`}
          >
            {request.priority?.toUpperCase()}
          </Badge>
          <Badge 
            className={`${getStatusColor(request.status)} border`}
            data-testid={`badge-status-${request.status}`}
          >
            {request.status?.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Request Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5" />
            <span>Request Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Asset Type</label>
              <p className="text-foreground font-medium" data-testid="text-asset-type">{request.assetType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Inspection Type</label>
              <p className="text-foreground font-medium" data-testid="text-inspection-type">{request.inspectionType?.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Requested Date</label>
              <p className="text-foreground font-medium" data-testid="text-requested-date">
                {request.requestedDate ? format(new Date(request.requestedDate), 'PPP') : 'Not specified'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Estimated Value</label>
              <p className="text-foreground font-medium" data-testid="text-estimated-value">
                {request.estimatedValue ? `$${Number(request.estimatedValue).toLocaleString()}` : 'Not specified'}
              </p>
            </div>
          </div>
          
          {request.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-foreground mt-1" data-testid="text-description">{request.description}</p>
            </div>
          )}

          {request.assetDescription && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Asset Description</label>
              <p className="text-foreground mt-1" data-testid="text-asset-description">{request.assetDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Information */}
      {location && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-foreground" data-testid="text-location-address">
                {location.address}
              </p>
              <p className="text-muted-foreground" data-testid="text-location-city">
                {location.city}, {location.state} {location.zipCode}
              </p>
              {location.latitude && location.longitude && (
                <p className="text-sm text-muted-foreground" data-testid="text-location-coordinates">
                  Coordinates: {location.latitude}, {location.longitude}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Section */}
      {(request.status === 'pending' || request.status === 'assigned') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5" />
              <span>Assignment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Assignment Type</label>
              <Select value={assignmentType} onValueChange={(value: 'department' | 'coordinator') => setAssignmentType(value)}>
                <SelectTrigger data-testid="select-assignment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coordinator">Assign to Coordinator</SelectItem>
                  <SelectItem value="department">Assign to Department</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {assignmentType === 'coordinator' ? 'Select Coordinator' : 'Select Department'}
              </label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="select-assignee">
                  <SelectValue placeholder={`Choose ${assignmentType}`} />
                </SelectTrigger>
                <SelectContent>
                  {assignmentType === 'coordinator' 
                    ? mockCoordinators.map(coordinator => (
                        <SelectItem key={coordinator.id} value={coordinator.id}>
                          {coordinator.name} ({coordinator.department})
                        </SelectItem>
                      ))
                    : mockDepartments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleAssign} 
              disabled={!selectedAssignee}
              className="w-full"
              data-testid="button-assign"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Assign Request
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {request.status === 'assigned' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Play className="w-5 h-5" />
              <span>Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => {
                onStartCall(request.id);
                onClose();
              }} 
              className="w-full"
              data-testid="button-start-call"
            >
              <Map className="w-4 h-4 mr-2" />
              Select Inspector & Start Call
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Use the field map to select an available inspector and start the video call
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status Update Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Update Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Current Status</label>
            <Badge 
              className={`${getStatusColor(request.status)} border w-fit`}
              data-testid={`badge-current-status-${request.status}`}
            >
              {request.status?.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Change Status To</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="select-status-update">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleStatusUpdate} 
            disabled={!selectedStatus || selectedStatus === request.status}
            className="w-full"
            data-testid="button-update-status"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Update Status
          </Button>
        </CardContent>
      </Card>

      {/* Current Assignment Display */}
      {(request.assignedCoordinatorId || request.assignedDepartmentId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Current Assignment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {request.assignedCoordinatorId && (
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground" data-testid="text-assigned-coordinator">
                  Coordinator: {mockCoordinators.find(c => c.id === request.assignedCoordinatorId)?.name || 'Unknown'}
                </span>
              </div>
            )}
            {request.assignedDepartmentId && (
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground" data-testid="text-assigned-department">
                  Department: {mockDepartments.find(d => d.id === request.assignedDepartmentId)?.name || 'Unknown'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CoordinatorDashboard() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<InspectionRequest | null>(null);
  const [showFieldMap, setShowFieldMap] = useState(false);
  const [selectedInspector, setSelectedInspector] = useState<any>(null);
  const [requestForCall, setRequestForCall] = useState<InspectionRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Get authenticated user from JWT token
  const currentUser = getCurrentUserFromToken();
  
  // Redirect to home if not authenticated or not a coordinator
  useEffect(() => {
    if (!currentUser) {
      console.log('❌ No authenticated user found, redirecting to home');
      toast({
        title: "Authentication Required",
        description: "Please log in as a coordinator to access this page",
        variant: "destructive",
      });
      // Use wouter navigation instead of window.location to prevent hard reloads
      setTimeout(() => setLocation("/"), 100);
      return;
    }
    
    if (currentUser.role !== 'coordinator') {
      console.log('❌ User role mismatch:', currentUser.role, 'expected: coordinator');
      toast({
        title: "Authentication Required",
        description: "Please log in as a coordinator to access this page",
        variant: "destructive",
      });
      // Use wouter navigation instead of window.location to prevent hard reloads
      setTimeout(() => setLocation("/"), 100);
      return;
    }
    
    console.log('✅ Authentication validated for coordinator:', currentUser.name);
  }, [currentUser, setLocation, toast]);

  // Fetch inspection requests with filters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (priorityFilter !== "all") params.append("priority", priorityFilter);
    if (departmentFilter !== "all") params.append("departmentId", departmentFilter);
    return params.toString();
  };

  const { data: requests = [], isLoading, refetch } = useQuery<InspectionRequest[]>({
    queryKey: ["/api/coordinator/inspection-requests", statusFilter, priorityFilter, departmentFilter],
    queryFn: async () => {
      const params = buildQueryParams();
      const response = await apiRequest("GET", `/api/coordinator/inspection-requests?${params}`);
      return response.json();
    },
    enabled: !!currentUser && currentUser.role === 'coordinator' // Only fetch if authenticated
  });

  // Filter requests by search term
  const filteredRequests = requests.filter(request =>
    request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.assetType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Assignment mutations
  const assignToDepartmentMutation = useMutation({
    mutationFn: async ({ requestId, departmentId }: { requestId: string, departmentId: string }) => {
      const response = await apiRequest("PATCH", `/api/coordinator/inspection-requests/${requestId}/assign-department`, {
        departmentId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Assigned",
        description: "Request has been assigned to department successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinator/inspection-requests"] });
    },
    onError: (error: any) => {
      console.error('Department assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error?.message || "Failed to assign request to department",
        variant: "destructive",
      });
    }
  });

  const assignToCoordinatorMutation = useMutation({
    mutationFn: async ({ requestId, coordinatorId }: { requestId: string, coordinatorId: string }) => {
      const response = await apiRequest("PATCH", `/api/coordinator/inspection-requests/${requestId}/assign-coordinator`, {
        coordinatorId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Assigned",
        description: "Request has been assigned to coordinator successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinator/inspection-requests"] });
    },
    onError: (error: any) => {
      console.error('Assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error?.message || "Failed to assign request to coordinator",
        variant: "destructive",
      });
    }
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string, status: string }) => {
      const response = await apiRequest("PUT", `/api/inspection-requests/${requestId}/status`, {
        status
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Request status has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinator/inspection-requests"] });
    },
    onError: (error: any) => {
      console.error('Status update error:', error);
      toast({
        title: "Status Update Failed",
        description: error?.message || "Failed to update request status",
        variant: "destructive",
      });
    }
  });

  const handleAssignment = (type: 'department' | 'coordinator', id: string) => {
    if (!selectedRequest) return;

    if (type === 'department') {
      assignToDepartmentMutation.mutate({ requestId: selectedRequest.id, departmentId: id });
    } else {
      assignToCoordinatorMutation.mutate({ requestId: selectedRequest.id, coordinatorId: id });
    }
  };

  const handleStatusUpdate = (requestId: string, status: string) => {
    updateStatusMutation.mutate({ requestId, status });
  };

  const handleStartCall = (requestId: string) => {
    console.log('🚀 handleStartCall called with requestId:', requestId);
    const request = filteredRequests.find(r => r.id === requestId);
    if (request) {
      console.log('📋 Request found:', request.title);
      setRequestForCall(request);
      setShowFieldMap(true);
      console.log('🗺️ Field map should now be visible');
    } else {
      console.error('❌ Request not found for ID:', requestId);
    }
  };

  const handleGenerateReport = (requestId: string) => {
    setLocation(`/reports/generate/${requestId}`);
  };

  const handleInspectorSelection = async (inspector: any) => {
    if (!requestForCall) {
      toast({
        title: "No request selected",
        description: "Please select an inspection request first",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser?.id) {
      toast({
        title: "Authentication error",
        description: "Please log in again",
        variant: "destructive",
      });
      return;
    }

    if (!inspector?.id) {
      toast({
        title: "Inspector selection error",
        description: "Please select a valid inspector",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔍 Creating call with data:', {
        coordinatorId: currentUser.id,
        inspectorId: inspector.id,
        inspectionRequestId: requestForCall.id,
        inspector: inspector
      });

      // First create the call
      const response = await apiRequest("POST", "/api/calls", {
        coordinatorId: currentUser.id,
        inspectorId: inspector.id,
        inspectionRequestId: requestForCall.id,
        status: "pending",
        inspectionReference: `INS-${Date.now()}`,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Call creation failed:', errorData);
        throw new Error(`Failed to create call: ${errorData.message || response.statusText}`);
      }
      
      const call = await response.json();
      
      toast({
        title: "Call created",
        description: `Starting video call with ${inspector.name}...`,
      });
      
      // Update request status to in_progress
      await apiRequest("PATCH", `/api/coordinator/inspection-requests/${requestForCall.id}`, {
        status: "in_progress"
      });
      
      // Send email to inspector with inspection details and call link
      try {
        const emailResponse = await apiRequest("POST", "/api/emails/inspector-assignment", {
          inspectorEmail: inspector.email,
          inspectorName: inspector.name,
          inspectionRequestId: requestForCall.id,
          callId: call.id
        });

        const emailResult = await emailResponse.json();
        
        if (emailResult.success) {
          toast({
            title: "Inspector Notified",
            description: `Email sent to ${inspector.name} with inspection details and call link`,
          });
        } else {
          console.error("Email sending failed:", emailResult.error);
          toast({
            title: "Email Warning",
            description: "Call created but email notification failed. You may need to contact the inspector directly.",
            variant: "destructive",
          });
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        toast({
          title: "Email Warning", 
          description: "Call created but email notification failed. You may need to contact the inspector directly.",
          variant: "destructive",
        });
      }
      
      setShowFieldMap(false);
      setRequestForCall(null);
      setSelectedInspector(null);
      
      console.log('🚀 Redirecting to coordinator call page:', `/coordinator/call/${call.id}`);
      console.log('🚀 About to call setLocation with setTimeout to avoid dialog interference...');
      
      // Use setTimeout to defer navigation after dialog close to prevent interference
      setTimeout(() => {
        console.log('⏰ setTimeout executed, calling setLocation now...');
        setLocation(`/coordinator/call/${call.id}`);
        console.log('🚀 setLocation called, navigation should trigger');
      }, 100);
    } catch (error) {
      console.error("Failed to start call:", error);
      toast({
        title: "Failed to start call",
        description: (error as any)?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCloseFieldMap = () => {
    setShowFieldMap(false);
    setRequestForCall(null);
    setSelectedInspector(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'assigned': return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-50 border-red-200';
      case 'high': return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-500 bg-green-50 border-green-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getRequestStats = () => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      assigned: requests.filter(r => r.status === 'assigned').length,
      inProgress: requests.filter(r => r.status === 'in_progress').length,
      completed: requests.filter(r => r.status === 'completed').length,
    };
  };

  const stats = getRequestStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="title-dashboard">
              Coordinator Dashboard
            </h1>
            <p className="text-muted-foreground">Welcome back, {currentUser?.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-primary">
              {stats.total} Total Requests
            </Badge>
            {/* TEMPORARY TEST LINK - Remove after routing is fixed */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation("/coordinator/call/test-call-id")}
              data-testid="button-test-call-routing"
            >
              🧪 Test Call Route
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="stat-total">{stats.total}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="stat-pending">{stats.pending}</span>
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <UserCheck className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="stat-assigned">{stats.assigned}</span>
              </div>
              <p className="text-sm text-muted-foreground">Assigned</p>
            </CardContent>
          </Card>
          
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="stat-in-progress">{stats.inProgress}</span>
              </div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="stat-completed">{stats.completed}</span>
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger data-testid="select-priority-filter">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Department Filter */}
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger data-testid="select-department-filter">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {mockDepartments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Inspection Requests</span>
              <Badge variant="secondary">{filteredRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No inspection requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(request.status)}
                            <div>
                              <h3 className="font-medium text-foreground" data-testid={`text-request-title-${request.id}`}>
                                {request.title}
                              </h3>
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center space-x-1">
                                  <Building className="w-3 h-3" />
                                  <span data-testid={`text-asset-type-${request.id}`}>{request.assetType}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Calendar className="w-3 h-3" />
                                  <span data-testid={`text-created-date-${request.id}`}>
                                    {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'Unknown'}
                                  </span>
                                </span>
                                {request.estimatedValue && (
                                  <span className="flex items-center space-x-1">
                                    <TrendingUp className="w-3 h-3" />
                                    <span data-testid={`text-estimated-value-${request.id}`}>
                                      ${Number(request.estimatedValue).toLocaleString()}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Badge 
                            className={`${getPriorityColor(request.priority)} border`}
                            data-testid={`badge-priority-${request.id}`}
                          >
                            {request.priority?.toUpperCase()}
                          </Badge>
                          
                          {/* Generate Report Button for Completed Inspections */}
                          {request.status === 'completed' && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleGenerateReport(request.id)}
                              data-testid={`button-generate-report-${request.id}`}
                            >
                              <ClipboardList className="w-4 h-4 mr-2" />
                              Generate Report
                            </Button>
                          )}
                          
                          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setDialogOpen(true);
                                }}
                                data-testid={`button-view-details-${request.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>Request Details</DialogTitle>
                              </DialogHeader>
                              {selectedRequest && (
                                <RequestDetails
                                  request={selectedRequest}
                                  onAssign={handleAssignment}
                                  onUpdateStatus={handleStatusUpdate}
                                  onStartCall={(requestId) => {
                                    console.log('🔴 Start Call clicked from RequestDetails dialog');
                                    // Close dialog first, then defer start call to avoid interference
                                    setDialogOpen(false);
                                    setSelectedRequest(null);
                                    setTimeout(() => {
                                      console.log('⏰ Deferred start call execution');
                                      handleStartCall(requestId);
                                    }, 100);
                                  }}
                                  onClose={() => {
                                    console.log('🔴 Closing RequestDetails dialog');
                                    setSelectedRequest(null);
                                    setDialogOpen(false);
                                  }}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Field Map Modal for Inspector Selection */}
      <FieldMap
        isOpen={showFieldMap}
        onClose={handleCloseFieldMap}
        onSelectInspector={handleInspectorSelection}
        currentCallInspectorId={selectedInspector?.id}
      />
    </div>
  );
}