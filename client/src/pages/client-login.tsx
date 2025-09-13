import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { clientLoginSchema, clientRegistrationSchema, type ClientLogin, type ClientRegistration } from "@shared/schema";
import { Building, User, Mail, Phone, MapPin } from "lucide-react";
import logoImage from "@assets/1767 copy_1757516319425.png";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Login form
  const loginForm = useForm<ClientLogin>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Registration form
  const registrationForm = useForm<ClientRegistration>({
    resolver: zodResolver(clientRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      contactPerson: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
    },
  });

  const handleLogin = async (data: ClientLogin) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/client/login", data);
      const result = await response.json();
      
      // Store both client data and JWT token
      localStorage.setItem("client", JSON.stringify(result.client));
      localStorage.setItem("authToken", result.token);
      
      toast({
        title: "Logged in successfully",
        description: `Welcome, ${result.client.name}`,
      });
      
      setLocation("/client/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistration = async (data: ClientRegistration) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/client/register", data);
      const result = await response.json();
      
      // Store both client data and JWT token
      localStorage.setItem("client", JSON.stringify(result.client));
      localStorage.setItem("authToken", result.token);
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${result.client.name}! Your account has been created.`,
      });
      
      setLocation("/client/dashboard");
    } catch (error: any) {
      const errorMessage = error.message === "Email already registered" 
        ? "This email is already registered. Please try logging in instead."
        : "Registration failed. Please try again.";
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoImage} 
            alt="Company Logo" 
            className="h-20 w-auto"
          />
        </div>

        <Card className="bg-white border border-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-black text-center">
              <Building className="w-5 h-5 text-black mx-auto" />
              <span>Client Portal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                <TabsTrigger value="login" className="text-black data-[state=active]:bg-black data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="text-black data-[state=active]:bg-black data-[state=active]:text-white">
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="your@email.com"
                              data-testid="input-email"
                              className="bg-white text-black border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black">Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter password"
                              data-testid="input-password"
                              className="bg-white text-black border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit"
                      className="w-full bg-black text-white hover:bg-gray-800" 
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register" className="mt-6">
                <Form {...registrationForm}>
                  <form onSubmit={registrationForm.handleSubmit(handleRegistration)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registrationForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-black">Company Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Your Company Inc."
                                data-testid="input-company-name"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-black">Contact Person</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="John Smith"
                                data-testid="input-contact-person"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-black">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="contact@yourcompany.com"
                                data-testid="input-email-register"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-black">Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="tel"
                                placeholder="(555) 123-4567"
                                data-testid="input-phone"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-black">Street Address</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="123 Business Ave"
                                data-testid="input-address"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-black">City</FormLabel>
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
                        control={registrationForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-black">State</FormLabel>
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
                        control={registrationForm.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-black">ZIP Code</FormLabel>
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
                      <FormField
                        control={registrationForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-black">Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Enter password"
                                data-testid="input-password-register"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-black">Confirm Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Confirm password"
                                data-testid="input-confirm-password"
                                className="bg-white text-black border-gray-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button 
                      type="submit"
                      className="w-full bg-black text-white hover:bg-gray-800" 
                      disabled={isLoading}
                      data-testid="button-register"
                    >
                      {isLoading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
            
            <div className="text-center text-sm text-black mt-6">
              IFS Client Portal
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}