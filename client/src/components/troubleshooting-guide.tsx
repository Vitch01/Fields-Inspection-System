import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  CheckCircle, 
  ChevronDown, 
  ChevronRight,
  HelpCircle,
  Wifi,
  Camera,
  Mic,
  Globe,
  RefreshCw,
  Settings,
  Monitor,
  Smartphone,
  X,
  ExternalLink
} from "lucide-react";
import { getDeviceInfo, getBrowserCapabilities } from "@/lib/diagnostic-utils";

interface TroubleshootingStep {
  title: string;
  description: string;
  steps: string[];
  isAdvanced?: boolean;
}

interface TroubleshootingCategory {
  id: string;
  title: string;
  icon: any;
  description: string;
  steps: TroubleshootingStep[];
}

interface TroubleshootingGuideProps {
  currentIssue?: 'websocket' | 'media' | 'latency' | 'browser' | null;
  onClose?: () => void;
  className?: string;
}

export default function TroubleshootingGuide({
  currentIssue = null,
  onClose,
  className = ""
}: TroubleshootingGuideProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(currentIssue);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  
  const deviceInfo = getDeviceInfo();
  const capabilities = getBrowserCapabilities();

  const troubleshootingCategories: TroubleshootingCategory[] = [
    {
      id: 'websocket',
      title: 'Connection Problems',
      icon: Wifi,
      description: 'Issues with connecting to the video call server',
      steps: [
        {
          title: 'Check Internet Connection',
          description: 'Verify your basic internet connectivity',
          steps: [
            'Open a new browser tab and try visiting any website',
            'If websites don\'t load, check your WiFi or cellular connection',
            'Try switching between WiFi and mobile data if available',
            'Restart your router/modem if using WiFi'
          ]
        },
        {
          title: 'Firewall and Network Restrictions',
          description: 'Corporate or public networks may block video calling',
          steps: [
            'If on a corporate network, contact your IT department',
            'Try switching to a different network (mobile hotspot, home WiFi)',
            'If using a VPN, try disabling it temporarily',
            'Check if your network blocks WebSocket connections on port 443'
          ]
        },
        {
          title: 'Browser Issues',
          description: 'Clear browser data or try a different browser',
          steps: [
            'Refresh the page (F5 or Ctrl+R)',
            'Clear browser cache and cookies for this site',
            'Try opening the link in an incognito/private window',
            'Try a different browser (Chrome, Firefox, Safari, Edge)'
          ]
        },
        {
          title: 'Mobile Device Specific',
          description: 'Issues specific to mobile devices',
          steps: [
            'Make sure you have a strong cellular or WiFi signal',
            'Close other apps that might be using your connection',
            'Try turning airplane mode on and off to reset connections',
            'Update your browser app to the latest version'
          ],
          isAdvanced: false
        }
      ]
    },
    {
      id: 'media',
      title: 'Camera & Microphone',
      icon: Camera,
      description: 'Problems with accessing camera or microphone',
      steps: [
        {
          title: 'Grant Permissions',
          description: 'Allow the website to access your camera and microphone',
          steps: [
            'Look for a camera/microphone permission prompt in your browser',
            'Click "Allow" when prompted for camera and microphone access',
            'If you accidentally clicked "Block", you can reset permissions',
            deviceInfo.browserName === 'Chrome' 
              ? 'In Chrome: Click the camera icon in the address bar and select "Allow"'
              : deviceInfo.browserName === 'Firefox'
              ? 'In Firefox: Click the camera icon in the address bar and select "Allow"'
              : deviceInfo.browserName === 'Safari'
              ? 'In Safari: Go to Safari > Settings > Websites > Camera/Microphone'
              : 'Check your browser settings for camera/microphone permissions'
          ]
        },
        {
          title: 'Check Device Usage',
          description: 'Make sure no other application is using your camera/microphone',
          steps: [
            'Close other video calling apps (Zoom, Teams, Skype, etc.)',
            'Close other camera apps that might be running',
            'On Windows: Check Task Manager for apps using camera/microphone',
            'On Mac: Check Activity Monitor for camera/microphone usage',
            'Restart your browser if the issue persists'
          ]
        },
        {
          title: 'Device Troubleshooting',
          description: 'Hardware-related camera and microphone issues',
          steps: [
            'Test your camera in another app to verify it works',
            'Check if your camera/microphone is connected properly',
            'Try unplugging and reconnecting external cameras/microphones',
            'Update your camera/audio drivers',
            'Restart your computer if the issue persists'
          ],
          isAdvanced: true
        },
        {
          title: 'Mobile Camera Issues',
          description: 'Camera problems specific to mobile devices',
          steps: [
            'Check if other camera apps work on your device',
            'Make sure your camera lens is clean',
            'Try switching between front and rear cameras',
            'Close the browser and reopen the link',
            'Restart your phone if issues persist'
          ]
        }
      ]
    },
    {
      id: 'latency',
      title: 'Poor Call Quality',
      icon: Globe,
      description: 'Slow connection, lag, or poor video/audio quality',
      steps: [
        {
          title: 'Improve Network Performance',
          description: 'Optimize your internet connection for video calling',
          steps: [
            'Move closer to your WiFi router for stronger signal',
            'Close bandwidth-heavy applications (streaming, downloads)',
            'Ask others on your network to pause video streaming',
            'Switch to a 5GHz WiFi network if available',
            'Try using an ethernet cable instead of WiFi'
          ]
        },
        {
          title: 'Mobile Data Optimization',
          description: 'Improve call quality when using mobile data',
          steps: [
            'Make sure you have a strong cellular signal (3+ bars)',
            'Try moving to a different location with better signal',
            'Close other apps that use data in the background',
            'Switch to WiFi if available for better quality',
            'Consider upgrading your data plan if consistently slow'
          ]
        },
        {
          title: 'Video Quality Settings',
          description: 'Adjust video quality if your connection is slow',
          steps: [
            'Lower video quality in call settings if available',
            'Turn off video and use audio-only if needed',
            'Reduce screen resolution or close other browser tabs',
            'Disable other devices on your network temporarily'
          ],
          isAdvanced: true
        }
      ]
    },
    {
      id: 'browser',
      title: 'Browser Compatibility',
      icon: Monitor,
      description: 'Issues with browser support or outdated features',
      steps: [
        {
          title: 'Update Your Browser',
          description: 'Ensure you have the latest browser version',
          steps: [
            deviceInfo.browserName === 'Chrome' 
              ? 'Chrome: Click menu (⋮) > Help > About Google Chrome'
              : deviceInfo.browserName === 'Firefox'
              ? 'Firefox: Click menu (☰) > Help > About Firefox'
              : deviceInfo.browserName === 'Safari'
              ? 'Safari: Click Safari > About Safari (update through System Preferences)'
              : 'Check your browser\'s help menu for update options',
            'Restart your browser after updating',
            'Clear browser cache after updating',
            'Try the video call again'
          ]
        },
        {
          title: 'Switch Browsers',
          description: 'Try a different browser if yours isn\'t supported',
          steps: [
            'Download and try Google Chrome (recommended)',
            'Mozilla Firefox is also well-supported',
            'Safari works on Mac and iOS devices',
            'Microsoft Edge works on Windows devices',
            'Avoid Internet Explorer - it doesn\'t support video calling'
          ]
        },
        {
          title: 'Enable Browser Features',
          description: 'Make sure required browser features are enabled',
          steps: [
            'Enable JavaScript in your browser settings',
            'Disable browser extensions that might block video calling',
            'Allow pop-ups for this website if prompted',
            'Make sure hardware acceleration is enabled',
            'Disable strict privacy/tracking protection for this site'
          ],
          isAdvanced: true
        },
        {
          title: 'Mobile Browser Issues',
          description: 'Browser problems specific to mobile devices',
          steps: [
            'Use the built-in browser on your device (Safari on iOS, Chrome on Android)',
            'Update your mobile browser to the latest version',
            'Clear the browser app\'s cache and data',
            'Try requesting the desktop version of the site',
            'Restart your phone and try again'
          ]
        }
      ]
    }
  ];

  const getRecommendedCategory = () => {
    if (!capabilities.webrtc || !capabilities.websockets) return 'browser';
    if (!capabilities.mediaDevices) return 'media';
    return 'websocket';
  };

  const currentCategory = troubleshootingCategories.find(cat => cat.id === expandedCategory);

  return (
    <Card className={`${className}`} data-testid="troubleshooting-guide">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5" />
            <span>Troubleshooting Guide</span>
          </span>
          {onClose && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onClose}
              data-testid="button-close-troubleshooting"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardTitle>
        {deviceInfo && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {deviceInfo.isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            <span>{deviceInfo.browserName} on {deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Recommendations */}
        {!currentIssue && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md" data-testid="quick-recommendations">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800">Quick Check</span>
            </div>
            <div className="text-sm text-blue-700">
              Based on your device, we recommend checking{' '}
              <button 
                className="underline font-medium hover:no-underline"
                onClick={() => setExpandedCategory(getRecommendedCategory())}
                data-testid="button-recommended-category"
              >
                {troubleshootingCategories.find(cat => cat.id === getRecommendedCategory())?.title}
              </button>
              {' '}first.
            </div>
          </div>
        )}

        {/* Category List */}
        <div className="space-y-2" data-testid="troubleshooting-categories">
          {troubleshootingCategories.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedCategory === category.id;
            
            return (
              <Collapsible key={category.id} open={isExpanded} onOpenChange={(open) => {
                setExpandedCategory(open ? category.id : null);
                if (!open) setExpandedStep(null);
              }}>
                <CollapsibleTrigger 
                  className="flex items-center w-full justify-between p-3 hover:bg-gray-50 rounded border"
                  data-testid={`toggle-category-${category.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">{category.title}</div>
                      <div className="text-sm text-gray-600">{category.description}</div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2 pl-4" data-testid={`category-content-${category.id}`}>
                  {category.steps.map((step, stepIndex) => {
                    const stepId = `${category.id}-${stepIndex}`;
                    const isStepExpanded = expandedStep === stepId;
                    
                    return (
                      <Collapsible key={stepIndex} open={isStepExpanded} onOpenChange={(open) => {
                        setExpandedStep(open ? stepId : null);
                      }}>
                        <CollapsibleTrigger 
                          className="flex items-center w-full justify-between p-2 hover:bg-gray-50 rounded border-l-2 border-gray-200"
                          data-testid={`toggle-step-${stepId}`}
                        >
                          <div className="text-left">
                            <div className="font-medium text-sm flex items-center space-x-2">
                              <span>{step.title}</span>
                              {step.isAdvanced && (
                                <Badge variant="outline" className="text-xs">Advanced</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">{step.description}</div>
                          </div>
                          {isStepExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 ml-4" data-testid={`step-content-${stepId}`}>
                          <div className="space-y-2">
                            {step.steps.map((instruction, instructionIndex) => (
                              <div key={instructionIndex} className="flex items-start space-x-2 text-sm">
                                <span className="text-gray-400 mt-1 text-xs">{instructionIndex + 1}.</span>
                                <span className="text-gray-700">{instruction}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Contact Support */}
        <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-md" data-testid="contact-support">
          <div className="flex items-center space-x-2 mb-2">
            <HelpCircle className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-800">Still Need Help?</span>
          </div>
          <div className="text-sm text-gray-700 space-y-2">
            <p>If you've tried these steps and still have issues:</p>
            <div className="space-y-1">
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">•</span>
                <span>Note your device type: {deviceInfo?.isMobile ? 'Mobile' : 'Desktop'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">•</span>
                <span>Note your browser: {deviceInfo?.browserName} {deviceInfo?.browserVersion}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">•</span>
                <span>Contact technical support with this information</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}