import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import logoImage from "@assets/1767 copy_1757516319425.png";
import { Link } from "wouter";

export default function InspectorThankYou() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src={logoImage} 
              alt="Company Logo" 
              className="h-16 w-auto mx-auto"
            />
          </div>
          
          {/* Success Icon */}
          <div className="mb-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          </div>
          
          {/* Thank You Message */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Thank You!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Your inspection has been completed successfully.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The coordinator has received all captured images and recordings from your session.
            </p>
          </div>
          
          {/* Action Button */}
          <Link href="/">
            <Button 
              className="w-full"
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}