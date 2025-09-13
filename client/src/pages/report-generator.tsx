import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Camera, 
  Download, 
  Eye, 
  Plus, 
  Trash2, 
  Save, 
  Upload,
  Building,
  Settings,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  User,
  CalendarDays,
  Wrench
} from "lucide-react";
import { format } from "date-fns";

// Define form schemas for different assessment types
const assetAssessmentSchema = z.object({
  assetType: z.string().min(1, "Asset type is required"),
  assetDescription: z.string().min(1, "Asset description is required"),
  overallCondition: z.enum(["excellent", "good", "fair", "poor", "critical"]),
  conditionScore: z.number().min(1).max(100),
  structuralIntegrity: z.string(),
  functionalStatus: z.string(),
  safetyCompliance: z.string(),
  maintenanceRequirements: z.string(),
  recommendedActions: z.string(),
  urgencyLevel: z.enum(["low", "medium", "high", "immediate"]).default("medium"),
  estimatedRepairCost: z.string().optional(),
  estimatedLifespan: z.string().optional(),
});

const wearTearAssessmentSchema = z.object({
  componentType: z.string().min(1, "Component type is required"),
  componentDescription: z.string().min(1, "Component description is required"),
  wearLevel: z.enum(["minimal", "light", "moderate", "heavy", "severe"]),
  wearPercentage: z.number().min(0).max(100),
  expectedLifeRemaining: z.string(),
  maintenanceHistory: z.string(),
  environmentalFactors: z.string(),
  usagePatterns: z.string(),
  replacementPriority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  replacementCost: z.string().optional(),
  maintenanceCost: z.string().optional(),
});

const appraisalReportSchema = z.object({
  assetType: z.string().min(1, "Asset type is required"),
  assetDescription: z.string().min(1, "Asset description is required"),
  appraisalMethod: z.enum(["cost_approach", "market_approach", "income_approach"]),
  currentMarketValue: z.string().optional(),
  replacementCost: z.string().optional(),
  depreciation: z.string().optional(),
  salvageValue: z.string().optional(),
  appreciationRate: z.string().optional(),
  certificationRequired: z.boolean().default(false),
  certificationDetails: z.string().optional(),
  appraiserNotes: z.string().optional(),
});

const inspectionReportSchema = z.object({
  title: z.string().min(1, "Report title is required"),
  reportType: z.enum(["condition_only", "wear_tear_only", "appraisal_only", "comprehensive"]),
  executiveSummary: z.string().optional(),
  recommendations: z.string().optional(),
});

type AssetAssessmentForm = z.infer<typeof assetAssessmentSchema>;
type WearTearAssessmentForm = z.infer<typeof wearTearAssessmentSchema>;
type AppraisalReportForm = z.infer<typeof appraisalReportSchema>;
type InspectionReportForm = z.infer<typeof inspectionReportSchema>;

interface ReportGeneratorProps {
  inspectionRequestId?: string;
  callId?: string;
}

export default function ReportGenerator() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/reports/generate/:inspectionRequestId?/:callId?");
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetAssessments, setAssetAssessments] = useState<any[]>([]);
  const [wearTearAssessments, setWearTearAssessments] = useState<any[]>([]);
  const [appraisalReports, setAppraisalReports] = useState<any[]>([]);
  
  const inspectionRequestId = params?.inspectionRequestId;
  const callId = params?.callId;

  // Form instances for different assessment types
  const assetForm = useForm<AssetAssessmentForm>({
    resolver: zodResolver(assetAssessmentSchema),
    defaultValues: {
      overallCondition: "good",
      conditionScore: 75,
      urgencyLevel: "medium"
    }
  });

  const wearTearForm = useForm<WearTearAssessmentForm>({
    resolver: zodResolver(wearTearAssessmentSchema),
    defaultValues: {
      wearLevel: "light",
      wearPercentage: 25,
      replacementPriority: "medium"
    }
  });

  const appraisalForm = useForm<AppraisalReportForm>({
    resolver: zodResolver(appraisalReportSchema),
    defaultValues: {
      appraisalMethod: "cost_approach",
      certificationRequired: false
    }
  });

  const reportForm = useForm<InspectionReportForm>({
    resolver: zodResolver(inspectionReportSchema),
    defaultValues: {
      reportType: "comprehensive"
    }
  });

  // Fetch inspection request data
  const { data: inspectionRequest, isLoading: inspectionLoading } = useQuery({
    queryKey: ['/api/inspection-requests', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Fetch call data if available
  const { data: callData, isLoading: callLoading } = useQuery({
    queryKey: ['/api/calls', callId],
    enabled: !!callId
  });

  // Fetch report data aggregation
  const { data: reportData, isLoading: reportDataLoading } = useQuery({
    queryKey: ['/api/reports/data/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Fetch existing assessments
  const { data: existingAssetAssessments = [] } = useQuery({
    queryKey: ['/api/assessments/asset/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  const { data: existingWearTearAssessments = [] } = useQuery({
    queryKey: ['/api/assessments/wear-tear/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  const { data: existingAppraisalReports = [] } = useQuery({
    queryKey: ['/api/appraisals/request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Mutations for creating assessments
  const createAssetAssessment = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/assessments/asset', {
      ...data,
      callId: callId,
      inspectionRequestId: inspectionRequestId
    }),
    onSuccess: () => {
      toast({ title: "Asset assessment saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments/asset/request', inspectionRequestId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/data/request', inspectionRequestId] });
      assetForm.reset();
    }
  });

  const createWearTearAssessment = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/assessments/wear-tear', {
      ...data,
      callId: callId,
      inspectionRequestId: inspectionRequestId
    }),
    onSuccess: () => {
      toast({ title: "Wear & tear assessment saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments/wear-tear/request', inspectionRequestId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/data/request', inspectionRequestId] });
      wearTearForm.reset();
    }
  });

  const createAppraisalReport = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/appraisals', {
      ...data,
      callId: callId,
      inspectionRequestId: inspectionRequestId
    }),
    onSuccess: () => {
      toast({ title: "Appraisal report saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/appraisals/request', inspectionRequestId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/data/request', inspectionRequestId] });
      appraisalForm.reset();
    }
  });

  const createInspectionReport = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/reports', {
      ...data,
      inspectionRequestId: inspectionRequestId,
      clientId: inspectionRequest?.clientId,
      coordinatorId: inspectionRequest?.assignedCoordinatorId,
      inspectorId: callData?.inspectorId || 'unknown'
    }),
    onSuccess: (result) => {
      toast({ title: "Inspection report created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/data/request', inspectionRequestId] });
      // Navigate to report preview or dashboard
      setLocation(`/reports/${result.id}`);
    }
  });

  // PDF download mutation
  const downloadPdf = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/${reportId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: "PDF downloaded successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to download PDF", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Check if we have existing reports
  const { data: existingReports = [] } = useQuery({
    queryKey: ['/api/reports', 'by-inspection-request', inspectionRequestId],
    enabled: !!inspectionRequestId
  });

  // Helper functions
  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-yellow-500 text-white';
      case 'poor': return 'bg-orange-500 text-white';
      case 'critical': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getWearLevelColor = (level: string) => {
    switch (level) {
      case 'minimal': return 'bg-green-500 text-white';
      case 'light': return 'bg-blue-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-white';
      case 'heavy': return 'bg-orange-500 text-white';
      case 'severe': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'critical': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (inspectionLoading || callLoading || reportDataLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading inspection data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!inspectionRequest) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Inspection Request Not Found</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The inspection request could not be found or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/coordinator/dashboard")} data-testid="button-back-dashboard">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Report Generator</h1>
            <p className="text-muted-foreground mt-1">Create comprehensive inspection reports with assessments</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setPreviewOpen(true)}
              data-testid="button-preview-report"
              disabled={existingAssetAssessments.length === 0 && existingWearTearAssessments.length === 0 && existingAppraisalReports.length === 0}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Report
            </Button>
            <Button onClick={() => setLocation("/coordinator/dashboard")} data-testid="button-back-dashboard">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Inspection Request Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5" />
            <span>Inspection Request Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Asset Type</p>
              <p className="font-medium" data-testid="text-asset-type">{inspectionRequest.assetType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Priority</p>
              <Badge className={getPriorityColor(inspectionRequest.priority)} data-testid={`badge-priority-${inspectionRequest.priority}`}>
                {inspectionRequest.priority?.toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant="secondary" data-testid={`badge-status-${inspectionRequest.status}`}>
                {inspectionRequest.status?.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Requested Date</p>
              <p className="font-medium" data-testid="text-requested-date">
                {inspectionRequest.requestedDate ? format(new Date(inspectionRequest.requestedDate), 'PPP') : 'Not specified'}
              </p>
            </div>
          </div>
          {inspectionRequest.description && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-1" data-testid="text-description">{inspectionRequest.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Report Generation Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="asset-condition" data-testid="tab-asset-condition">
            <Building className="w-4 h-4 mr-2" />
            Asset Condition
          </TabsTrigger>
          <TabsTrigger value="wear-tear" data-testid="tab-wear-tear">
            <TrendingDown className="w-4 h-4 mr-2" />
            Wear & Tear
          </TabsTrigger>
          <TabsTrigger value="appraisal" data-testid="tab-appraisal">
            <DollarSign className="w-4 h-4 mr-2" />
            Appraisal
          </TabsTrigger>
          <TabsTrigger value="finalize" data-testid="tab-finalize">
            <CheckCircle className="w-4 h-4 mr-2" />
            Finalize Report
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Assessment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Asset Assessments</p>
                        <p className="text-2xl font-bold" data-testid="count-asset-assessments">{existingAssetAssessments.length}</p>
                      </div>
                      <Building className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Wear & Tear Assessments</p>
                        <p className="text-2xl font-bold" data-testid="count-wear-tear-assessments">{existingWearTearAssessments.length}</p>
                      </div>
                      <TrendingDown className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Appraisal Reports</p>
                        <p className="text-2xl font-bold" data-testid="count-appraisal-reports">{existingAppraisalReports.length}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Media Summary */}
              {reportData?.media && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Camera className="w-5 h-5" />
                      <span>Captured Media</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Photos</p>
                        <p className="text-xl font-bold" data-testid="count-captured-images">{reportData.media.images.length}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Videos</p>
                        <p className="text-xl font-bold" data-testid="count-captured-videos">{reportData.media.videos.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Next Steps */}
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {existingAssetAssessments.length === 0 && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Clock className="w-4 h-4" />
                        <span>Complete asset condition assessments</span>
                      </div>
                    )}
                    {existingWearTearAssessments.length === 0 && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Clock className="w-4 h-4" />
                        <span>Add wear and tear analysis</span>
                      </div>
                    )}
                    {existingAppraisalReports.length === 0 && inspectionRequest.inspectionType?.includes('appraisal') && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Clock className="w-4 h-4" />
                        <span>Complete asset appraisal</span>
                      </div>
                    )}
                    {existingAssetAssessments.length > 0 && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Asset assessments completed</span>
                      </div>
                    )}
                    {(existingAssetAssessments.length > 0 || existingWearTearAssessments.length > 0 || existingAppraisalReports.length > 0) && (
                      <div className="flex items-center space-x-2 text-blue-600">
                        <FileText className="w-4 h-4" />
                        <span>Ready to generate final report</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Asset Condition Tab */}
        <TabsContent value="asset-condition" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Condition Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...assetForm}>
                <form onSubmit={assetForm.handleSubmit((data) => createAssetAssessment.mutate(data))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="assetType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Type</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., HVAC System, Roofing, Electrical Panel" data-testid="input-asset-type" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="assetDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Detailed description of the asset" data-testid="input-asset-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="overallCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overall Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-overall-condition">
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="poor">Poor</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="conditionScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition Score (1-100)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="100" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-condition-score"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="urgencyLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-urgency-level">
                                <SelectValue placeholder="Select urgency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="immediate">Immediate</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="structuralIntegrity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Structural Integrity</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Assessment of structural integrity" data-testid="textarea-structural-integrity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="functionalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Functional Status</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Assessment of functional capabilities" data-testid="textarea-functional-status" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="safetyCompliance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Safety Compliance</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Safety compliance assessment" data-testid="textarea-safety-compliance" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="maintenanceRequirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance Requirements</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Required maintenance actions" data-testid="textarea-maintenance-requirements" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={assetForm.control}
                    name="recommendedActions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recommended Actions</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Specific recommended actions and repairs" data-testid="textarea-recommended-actions" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={assetForm.control}
                      name="estimatedRepairCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Repair Cost</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-estimated-repair-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assetForm.control}
                      name="estimatedLifespan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Lifespan</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 5-10 years" data-testid="input-estimated-lifespan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={createAssetAssessment.isPending}
                    data-testid="button-save-asset-assessment"
                  >
                    {createAssetAssessment.isPending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Asset Assessment
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Existing Asset Assessments */}
          {existingAssetAssessments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing Asset Assessments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {existingAssetAssessments.map((assessment: any) => (
                    <Card key={assessment.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-semibold">{assessment.assetType}</h4>
                              <Badge className={getConditionColor(assessment.overallCondition)}>
                                {assessment.overallCondition}
                              </Badge>
                              <Badge className={getPriorityColor(assessment.urgencyLevel)}>
                                {assessment.urgencyLevel}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{assessment.assetDescription}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Condition Score: </span>
                                <span>{assessment.conditionScore}/100</span>
                              </div>
                              <div>
                                <span className="font-medium">Repair Cost: </span>
                                <span>{assessment.estimatedRepairCost ? `$${assessment.estimatedRepairCost}` : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Similar comprehensive forms for Wear & Tear and Appraisal tabs would go here */}
        {/* For brevity, I'm showing the structure - the actual forms would follow the same pattern */}
        
        <TabsContent value="wear-tear" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wear & Tear Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...wearTearForm}>
                <form onSubmit={wearTearForm.handleSubmit((data) => createWearTearAssessment.mutate(data))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={wearTearForm.control}
                      name="componentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Component Type</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Motor, Bearing, Belt, Valve" data-testid="input-component-type" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wearTearForm.control}
                      name="componentDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Component Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Detailed description of the component" data-testid="input-component-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={wearTearForm.control}
                      name="wearLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wear Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-wear-level">
                                <SelectValue placeholder="Select wear level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="minimal">Minimal</SelectItem>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                              <SelectItem value="heavy">Heavy</SelectItem>
                              <SelectItem value="severe">Severe</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wearTearForm.control}
                      name="wearPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wear Percentage (0-100%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="100" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-wear-percentage"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wearTearForm.control}
                      name="replacementPriority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Replacement Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-replacement-priority">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={wearTearForm.control}
                    name="expectedLifeRemaining"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Life Remaining</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 6 months, 2 years, Immediate replacement needed" data-testid="input-expected-life-remaining" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={wearTearForm.control}
                      name="maintenanceHistory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance History</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Previous maintenance activities and dates" data-testid="textarea-maintenance-history" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wearTearForm.control}
                      name="environmentalFactors"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Environmental Factors</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Temperature, moisture, chemicals, vibration, etc." data-testid="textarea-environmental-factors" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={wearTearForm.control}
                    name="usagePatterns"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage Patterns</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Operating hours, load cycles, usage intensity" data-testid="textarea-usage-patterns" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={wearTearForm.control}
                      name="replacementCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Replacement Cost</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-replacement-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wearTearForm.control}
                      name="maintenanceCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ongoing Maintenance Cost</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00 per year" data-testid="input-maintenance-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={createWearTearAssessment.isPending}
                    data-testid="button-save-wear-tear-assessment"
                  >
                    {createWearTearAssessment.isPending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Wear & Tear Assessment
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Existing Wear & Tear Assessments */}
          {existingWearTearAssessments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing Wear & Tear Assessments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {existingWearTearAssessments.map((assessment: any) => (
                    <Card key={assessment.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-semibold">{assessment.componentType}</h4>
                              <Badge className={getWearLevelColor(assessment.wearLevel)}>
                                {assessment.wearLevel}
                              </Badge>
                              <Badge className={getPriorityColor(assessment.replacementPriority)}>
                                {assessment.replacementPriority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{assessment.componentDescription}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Wear Percentage: </span>
                                <span>{assessment.wearPercentage}%</span>
                              </div>
                              <div>
                                <span className="font-medium">Life Remaining: </span>
                                <span>{assessment.expectedLifeRemaining || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Replacement Cost: </span>
                                <span>{assessment.replacementCost ? `$${assessment.replacementCost}` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Maintenance Cost: </span>
                                <span>{assessment.maintenanceCost ? `$${assessment.maintenanceCost}` : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appraisal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Appraisal</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...appraisalForm}>
                <form onSubmit={appraisalForm.handleSubmit((data) => createAppraisalReport.mutate(data))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={appraisalForm.control}
                      name="assetType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Type</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Equipment, Building, Machinery, Vehicle" data-testid="input-appraisal-asset-type" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={appraisalForm.control}
                      name="assetDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Detailed description for appraisal" data-testid="input-appraisal-asset-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={appraisalForm.control}
                    name="appraisalMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appraisal Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-appraisal-method">
                              <SelectValue placeholder="Select appraisal method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cost_approach">Cost Approach</SelectItem>
                            <SelectItem value="market_approach">Market Approach</SelectItem>
                            <SelectItem value="income_approach">Income Approach</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={appraisalForm.control}
                      name="currentMarketValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Market Value</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-current-market-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={appraisalForm.control}
                      name="replacementCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Replacement Cost</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-appraisal-replacement-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={appraisalForm.control}
                      name="depreciation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Depreciation</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-depreciation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={appraisalForm.control}
                      name="salvageValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salvage Value</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$0.00" data-testid="input-salvage-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={appraisalForm.control}
                    name="appreciationRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appreciation Rate (%)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 3.5% annual" data-testid="input-appreciation-rate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center space-x-2">
                    <FormField
                      control={appraisalForm.control}
                      name="certificationRequired"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              data-testid="checkbox-certification-required"
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Certification Required
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {appraisalForm.watch('certificationRequired') && (
                    <FormField
                      control={appraisalForm.control}
                      name="certificationDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certification Details</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Certification requirements and details" data-testid="textarea-certification-details" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={appraisalForm.control}
                    name="appraiserNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appraiser Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Additional notes, methodology details, market conditions, etc." rows={4} data-testid="textarea-appraiser-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={createAppraisalReport.isPending}
                    data-testid="button-save-appraisal-report"
                  >
                    {createAppraisalReport.isPending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Appraisal Report
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Existing Appraisal Reports */}
          {existingAppraisalReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing Appraisal Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {existingAppraisalReports.map((report: any) => (
                    <Card key={report.id} className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-semibold">{report.assetType}</h4>
                              <Badge className="bg-blue-500 text-white">
                                {report.appraisalMethod?.replace('_', ' ').toUpperCase()}
                              </Badge>
                              {report.certificationRequired && (
                                <Badge className="bg-purple-500 text-white">CERTIFIED</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{report.assetDescription}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Market Value: </span>
                                <span>{report.currentMarketValue ? `$${report.currentMarketValue}` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Replacement Cost: </span>
                                <span>{report.replacementCost ? `$${report.replacementCost}` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Depreciation: </span>
                                <span>{report.depreciation ? `$${report.depreciation}` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Salvage Value: </span>
                                <span>{report.salvageValue ? `$${report.salvageValue}` : 'N/A'}</span>
                              </div>
                            </div>
                            {report.appraiserNotes && (
                              <div className="mt-2">
                                <p className="text-sm"><span className="font-medium">Notes: </span>{report.appraiserNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Finalize Report Tab */}
        <TabsContent value="finalize" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Finalize Inspection Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...reportForm}>
                <form onSubmit={reportForm.handleSubmit((data) => createInspectionReport.mutate(data))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={reportForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Comprehensive Inspection Report" data-testid="input-report-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={reportForm.control}
                      name="reportType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-report-type">
                                <SelectValue placeholder="Select report type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="comprehensive">Comprehensive Report</SelectItem>
                              <SelectItem value="condition_only">Condition Assessment Only</SelectItem>
                              <SelectItem value="wear_tear_only">Wear & Tear Analysis Only</SelectItem>
                              <SelectItem value="appraisal_only">Appraisal Report Only</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={reportForm.control}
                    name="executiveSummary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Executive Summary</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="High-level summary of key findings and recommendations" rows={4} data-testid="textarea-executive-summary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={reportForm.control}
                    name="recommendations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overall Recommendations</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detailed recommendations based on all assessments" rows={4} data-testid="textarea-recommendations" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center space-x-4">
                    <Button 
                      type="submit" 
                      disabled={createInspectionReport.isPending}
                      data-testid="button-create-report"
                    >
                      {createInspectionReport.isPending ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Creating Report...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Create Inspection Report
                        </>
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setPreviewOpen(true)}
                      disabled={existingAssetAssessments.length === 0 && existingWearTearAssessments.length === 0 && existingAppraisalReports.length === 0}
                      data-testid="button-preview-final-report"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Report
                    </Button>
                    {existingReports.length > 0 && (
                      <Button 
                        type="button" 
                        variant="default"
                        onClick={() => downloadPdf.mutate(existingReports[0].id)}
                        disabled={downloadPdf.isPending}
                        data-testid="button-download-pdf"
                      >
                        {downloadPdf.isPending ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">Preview functionality will be implemented with the report preview component.</p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Report Preview</p>
              <p className="text-muted-foreground">Preview will show formatted report with all assessments and media</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}