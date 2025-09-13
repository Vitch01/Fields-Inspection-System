import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { inspectionRequestFormSchema, type InspectionRequestForm } from "@shared/schema";
import { Building, ArrowLeft, Calendar as CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UploadedFile {
  file: File;
  preview: string;
}

export default function SubmitRequest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const storedClient = localStorage.getItem("client");
    if (storedClient) {
      setClient(JSON.parse(storedClient));
    } else {
      setLocation("/client/login");
    }
  }, [setLocation]);

  const form = useForm<InspectionRequestForm>({
    resolver: zodResolver(inspectionRequestFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assetType: "building",
      assetDescription: "",
      location: {
        address: "",
        city: "",
        state: "",
        zipCode: "",
      },
      priority: "medium",
      inspectionType: "condition_assessment",
      requestedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
      estimatedValue: undefined,
      clientId: client?.id || "",
    },
  });

  useEffect(() => {
    if (client?.id) {
      form.setValue("clientId", client.id);
    }
  }, [client, form]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "Invalid files",
        description: "Only image files are allowed",
        variant: "destructive",
      });
    }

    const newFiles: UploadedFile[] = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async (data: InspectionRequestForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/inspection-requests", {
        ...data,
        clientId: client!.id,
      });
      
      const inspectionRequest = await response.json();
      
      // Invalidate the client's requests cache
      queryClient.invalidateQueries({ queryKey: ['/api/inspection-requests/client', client!.id] });
      
      toast({
        title: "Request submitted successfully",
        description: "Your inspection request has been submitted and is pending review.",
      });
      
      setLocation("/client/dashboard");
    } catch (error: any) {
      toast({
        title: "Failed to submit request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
            <div className="flex items-center space-x-3">
              <Link href="/client/dashboard">
                <Button variant="outline" size="icon" className="border-black text-black hover:bg-gray-100" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <CardTitle className="text-black text-xl">Submit Inspection Request</CardTitle>
                <p className="text-gray-600">Provide details about the asset you need inspected</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Form */}
        <Card className="bg-white border border-white">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-black">Basic Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black">Request Title *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Brief description of inspection needed"
                            data-testid="input-title"
                            className="bg-white text-black border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Detailed description of what needs to be inspected and any specific concerns"
                            data-testid="input-description"
                            className="bg-white text-black border-gray-300 min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assetType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">Asset Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-asset-type" className="bg-white text-black border-gray-300">
                                <SelectValue placeholder="Select asset type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border-black">
                              <SelectItem value="building" className="text-black hover:bg-gray-100">Building</SelectItem>
                              <SelectItem value="equipment" className="text-black hover:bg-gray-100">Equipment</SelectItem>
                              <SelectItem value="infrastructure" className="text-black hover:bg-gray-100">Infrastructure</SelectItem>
                              <SelectItem value="vehicle" className="text-black hover:bg-gray-100">Vehicle</SelectItem>
                              <SelectItem value="other" className="text-black hover:bg-gray-100">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="inspectionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">Inspection Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-inspection-type" className="bg-white text-black border-gray-300">
                                <SelectValue placeholder="Select inspection type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border-black">
                              <SelectItem value="condition_assessment" className="text-black hover:bg-gray-100">Condition Assessment</SelectItem>
                              <SelectItem value="wear_tear_analysis" className="text-black hover:bg-gray-100">Wear & Tear Analysis</SelectItem>
                              <SelectItem value="appraisal" className="text-black hover:bg-gray-100">Appraisal</SelectItem>
                              <SelectItem value="combined" className="text-black hover:bg-gray-100">Combined Assessment</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="assetDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black">Asset Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Detailed description of the asset (age, materials, condition, etc.)"
                            data-testid="input-asset-description"
                            className="bg-white text-black border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-black">Location Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="location.address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black">Street Address *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="123 Main Street"
                            data-testid="input-address"
                            className="bg-white text-black border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="location.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">City *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="San Francisco"
                              data-testid="input-city"
                              className="bg-white text-black border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">State *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="CA"
                              data-testid="input-state"
                              className="bg-white text-black border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location.zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">ZIP Code *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="94105"
                              data-testid="input-zip"
                              className="bg-white text-black border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Scheduling & Priority */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-black">Scheduling & Priority</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="requestedDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-black">Preferred Inspection Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal border-gray-300",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-date-picker"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-white border-black" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">Priority Level *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-priority" className="bg-white text-black border-gray-300">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white border-black">
                              <SelectItem value="low" className="text-black hover:bg-gray-100">Low Priority</SelectItem>
                              <SelectItem value="medium" className="text-black hover:bg-gray-100">Medium Priority</SelectItem>
                              <SelectItem value="high" className="text-black hover:bg-gray-100">High Priority</SelectItem>
                              <SelectItem value="urgent" className="text-black hover:bg-gray-100">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="estimatedValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black">Estimated Asset Value (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter estimated value in USD"
                            data-testid="input-estimated-value"
                            className="bg-white text-black border-gray-300"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-black">Supporting Images (Optional)</h3>
                  <p className="text-sm text-gray-600">Upload images of the asset to help inspectors prepare for the visit.</p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      data-testid="input-files"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-black font-medium">Click to upload images</p>
                      <p className="text-sm text-gray-600">PNG, JPG, WEBP up to 10MB each</p>
                    </label>
                  </div>

                  {/* Uploaded Files Preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={file.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => removeFile(index)}
                            data-testid={`button-remove-file-${index}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                          <p className="text-xs text-gray-600 mt-1 truncate">{file.file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <Link href="/client/dashboard">
                    <Button type="button" variant="outline" className="border-black text-black hover:bg-gray-100" data-testid="button-cancel">
                      Cancel
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    className="bg-black text-white hover:bg-gray-800" 
                    disabled={isLoading}
                    data-testid="button-submit"
                  >
                    {isLoading ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}