// Network and connection diagnostic utilities
import { isMobileDevice } from './webrtc-utils';

export interface NetworkDiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  message: string;
  details?: any;
  timestamp: Date;
  duration?: number;
}

export interface BrowserCapabilities {
  webrtc: boolean;
  websockets: boolean;
  mediaDevices: boolean;
  canvas: boolean;
  mediaRecorder: boolean;
  supportedVideoCodecs: string[];
  supportedAudioCodecs: string[];
}

export interface DeviceInfo {
  isMobile: boolean;
  platform: string;
  browserName: string;
  browserVersion: string;
  userAgent: string;
  screenResolution: string;
  connectionType?: string;
  effectiveType?: string;
}

export interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  notifications: 'granted' | 'denied' | 'default' | 'unknown';
}

// Test WebSocket connectivity
export async function testWebSocketConnectivity(
  url?: string,
  timeout: number = 5000
): Promise<NetworkDiagnosticResult> {
  const startTime = Date.now();
  const testUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(testUrl);
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = (result: NetworkDiagnosticResult) => {
        if (timeoutId) clearTimeout(timeoutId);
        try {
          ws.close();
        } catch (e) {}
        resolve({
          ...result,
          duration: Date.now() - startTime,
          timestamp: new Date()
        });
      };

      timeoutId = setTimeout(() => {
        cleanup({
          test: 'WebSocket Connectivity',
          status: 'fail',
          message: 'WebSocket connection timed out',
          details: { timeout, url: testUrl }
        });
      }, timeout);

      ws.onopen = () => {
        cleanup({
          test: 'WebSocket Connectivity',
          status: 'pass',
          message: 'WebSocket connection established successfully',
          details: { url: testUrl }
        });
      };

      ws.onerror = (error) => {
        cleanup({
          test: 'WebSocket Connectivity',
          status: 'fail',
          message: 'WebSocket connection failed',
          details: { error: error.toString(), url: testUrl }
        });
      };

      ws.onclose = (event) => {
        if (!event.wasClean) {
          cleanup({
            test: 'WebSocket Connectivity',
            status: 'fail',
            message: `WebSocket connection closed unexpectedly (code: ${event.code})`,
            details: { code: event.code, reason: event.reason, url: testUrl }
          });
        }
      };

    } catch (error) {
      resolve({
        test: 'WebSocket Connectivity',
        status: 'fail',
        message: 'WebSocket not supported or initialization failed',
        details: { error: error.toString() },
        duration: Date.now() - startTime,
        timestamp: new Date()
      });
    }
  });
}

// Test network latency
export async function testNetworkLatency(
  endpoint?: string,
  attempts: number = 3
): Promise<NetworkDiagnosticResult> {
  const startTime = Date.now();
  const testEndpoint = endpoint || '/api';
  const latencies: number[] = [];
  
  try {
    for (let i = 0; i < attempts; i++) {
      const pingStart = performance.now();
      
      try {
        await fetch(testEndpoint, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        const pingEnd = performance.now();
        latencies.push(pingEnd - pingStart);
      } catch (error) {
        // Continue with other attempts even if one fails
        console.warn(`Latency test attempt ${i + 1} failed:`, error);
      }
    }

    if (latencies.length === 0) {
      return {
        test: 'Network Latency',
        status: 'fail',
        message: 'All latency test attempts failed',
        details: { attempts, endpoint: testEndpoint },
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `Average latency: ${Math.round(avgLatency)}ms`;

    if (avgLatency > 1000) {
      status = 'fail';
      message += ' (Very High - Connection issues likely)';
    } else if (avgLatency > 500) {
      status = 'warning';
      message += ' (High - May affect call quality)';
    } else if (avgLatency > 200) {
      status = 'warning';
      message += ' (Moderate)';
    } else {
      message += ' (Good)';
    }

    return {
      test: 'Network Latency',
      status,
      message,
      details: {
        average: Math.round(avgLatency),
        min: Math.round(minLatency),
        max: Math.round(maxLatency),
        attempts: latencies.length,
        measurements: latencies.map(l => Math.round(l))
      },
      duration: Date.now() - startTime,
      timestamp: new Date()
    };

  } catch (error) {
    return {
      test: 'Network Latency',
      status: 'fail',
      message: 'Network latency test failed',
      details: { error: error.toString(), endpoint: testEndpoint },
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }
}

// Test media device access
export async function testMediaDeviceAccess(): Promise<NetworkDiagnosticResult> {
  const startTime = Date.now();
  
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        test: 'Media Device Access',
        status: 'fail',
        message: 'Media devices API not supported',
        details: { reason: 'getUserMedia not available' },
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    // Test successful - clean up
    stream.getTracks().forEach(track => track.stop());

    return {
      test: 'Media Device Access',
      status: 'pass',
      message: 'Camera and microphone access granted',
      details: {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      },
      duration: Date.now() - startTime,
      timestamp: new Date()
    };

  } catch (error: any) {
    let message = 'Media device access failed';
    let status: 'fail' | 'warning' = 'fail';

    if (error.name === 'NotAllowedError') {
      message = 'Camera/microphone permission denied';
    } else if (error.name === 'NotFoundError') {
      message = 'No camera or microphone found';
    } else if (error.name === 'NotReadableError') {
      message = 'Camera/microphone already in use';
      status = 'warning';
    } else if (error.name === 'OverconstrainedError') {
      message = 'Camera/microphone constraints not supported';
    }

    return {
      test: 'Media Device Access',
      status,
      message,
      details: { 
        error: error.name || 'Unknown',
        message: error.message || error.toString()
      },
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }
}

// Get browser capabilities
export function getBrowserCapabilities(): BrowserCapabilities {
  const capabilities: BrowserCapabilities = {
    webrtc: false,
    websockets: false,
    mediaDevices: false,
    canvas: false,
    mediaRecorder: false,
    supportedVideoCodecs: [],
    supportedAudioCodecs: []
  };

  // Test WebRTC support
  capabilities.webrtc = !!(window.RTCPeerConnection || 
                         (window as any).webkitRTCPeerConnection || 
                         (window as any).mozRTCPeerConnection);

  // Test WebSocket support
  capabilities.websockets = !!window.WebSocket;

  // Test MediaDevices API
  capabilities.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // Test Canvas support
  try {
    const canvas = document.createElement('canvas');
    capabilities.canvas = !!(canvas.getContext && canvas.getContext('2d'));
  } catch (e) {
    capabilities.canvas = false;
  }

  // Test MediaRecorder support
  capabilities.mediaRecorder = !!window.MediaRecorder;

  // Test codec support
  if (capabilities.webrtc) {
    try {
      const pc = new RTCPeerConnection();
      
      // Test video codecs
      const videoCodecs = ['video/VP9', 'video/VP8', 'video/H264'];
      for (const codec of videoCodecs) {
        try {
          const transceiver = pc.addTransceiver('video');
          const capabilities = RTCRtpSender.getCapabilities('video');
          if (capabilities?.codecs.some(c => c.mimeType.toLowerCase().includes(codec.toLowerCase()))) {
            capabilities.supportedVideoCodecs.push(codec);
          }
        } catch (e) {}
      }

      // Test audio codecs
      const audioCodecs = ['audio/opus', 'audio/PCMU', 'audio/PCMA'];
      for (const codec of audioCodecs) {
        try {
          const capabilities = RTCRtpSender.getCapabilities('audio');
          if (capabilities?.codecs.some(c => c.mimeType.toLowerCase().includes(codec.toLowerCase()))) {
            capabilities.supportedAudioCodecs.push(codec);
          }
        } catch (e) {}
      }

      pc.close();
    } catch (e) {}
  }

  return capabilities;
}

// Get device information
export function getDeviceInfo(): DeviceInfo {
  const navigator = window.navigator;
  
  // Detect browser
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';
  
  if (navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edg')) {
    browserName = 'Chrome';
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (navigator.userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    const match = navigator.userAgent.match(/Firefox\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
    browserName = 'Safari';
    const match = navigator.userAgent.match(/Version\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (navigator.userAgent.includes('Edg')) {
    browserName = 'Edge';
    const match = navigator.userAgent.match(/Edg\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
  }

  // Get connection info if available
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    isMobile: isMobileDevice(),
    platform: navigator.platform,
    browserName,
    browserVersion,
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    connectionType: connection?.type || 'unknown',
    effectiveType: connection?.effectiveType || 'unknown'
  };
}

// Check permissions status
export async function checkPermissions(): Promise<PermissionStatus> {
  const permissions: PermissionStatus = {
    camera: 'unknown',
    microphone: 'unknown',
    notifications: 'unknown'
  };

  if (navigator.permissions) {
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      permissions.camera = cameraPermission.state as any;
    } catch (e) {
      permissions.camera = 'unknown';
    }

    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      permissions.microphone = micPermission.state as any;
    } catch (e) {
      permissions.microphone = 'unknown';
    }

    try {
      const notificationPermission = await navigator.permissions.query({ name: 'notifications' as PermissionName });
      permissions.notifications = notificationPermission.state as any;
    } catch (e) {
      permissions.notifications = 'unknown';
    }
  }

  return permissions;
}

// Run full diagnostic suite
export async function runFullDiagnostics(): Promise<NetworkDiagnosticResult[]> {
  const results: NetworkDiagnosticResult[] = [];

  // Run tests in parallel where possible
  const [websocketResult, latencyResult, mediaResult] = await Promise.all([
    testWebSocketConnectivity(),
    testNetworkLatency(),
    testMediaDeviceAccess()
  ]);

  results.push(websocketResult, latencyResult, mediaResult);

  // Add browser capabilities as a diagnostic result
  const capabilities = getBrowserCapabilities();
  let capabilityStatus: 'pass' | 'warning' | 'fail' = 'pass';
  let capabilityMessage = 'All required browser features supported';

  const requiredFeatures = ['webrtc', 'websockets', 'mediaDevices'];
  const missingFeatures = requiredFeatures.filter(feature => !capabilities[feature as keyof BrowserCapabilities]);

  if (missingFeatures.length > 0) {
    capabilityStatus = 'fail';
    capabilityMessage = `Missing required features: ${missingFeatures.join(', ')}`;
  } else if (!capabilities.canvas || !capabilities.mediaRecorder) {
    capabilityStatus = 'warning';
    capabilityMessage = 'Some optional features not supported (recording/image capture may be limited)';
  }

  results.push({
    test: 'Browser Compatibility',
    status: capabilityStatus,
    message: capabilityMessage,
    details: capabilities,
    timestamp: new Date()
  });

  return results;
}

// Get troubleshooting recommendations based on diagnostic results
export function getTroubleshootingRecommendations(results: NetworkDiagnosticResult[]): string[] {
  const recommendations: string[] = [];
  const deviceInfo = getDeviceInfo();

  for (const result of results) {
    if (result.status === 'fail' || result.status === 'warning') {
      switch (result.test) {
        case 'WebSocket Connectivity':
          recommendations.push('Check your internet connection and firewall settings');
          recommendations.push('Try refreshing the page or switching networks');
          if (deviceInfo.isMobile) {
            recommendations.push('If on mobile data, try switching to WiFi');
          }
          break;

        case 'Network Latency':
          if (result.details?.average > 500) {
            recommendations.push('Your network connection is slow - consider switching to a faster network');
            recommendations.push('Close other bandwidth-heavy applications');
            if (deviceInfo.isMobile) {
              recommendations.push('Move closer to your WiFi router or try mobile data');
            }
          }
          break;

        case 'Media Device Access':
          recommendations.push('Grant camera and microphone permissions when prompted');
          recommendations.push('Check that no other application is using your camera/microphone');
          recommendations.push('Try closing other video conferencing applications');
          if (deviceInfo.browserName === 'Safari') {
            recommendations.push('Safari users: Make sure you\'re using HTTPS and have the latest version');
          }
          break;

        case 'Browser Compatibility':
          if (!result.details?.webrtc) {
            recommendations.push('Your browser doesn\'t support video calling - try Chrome, Firefox, or Safari');
          }
          if (!result.details?.websockets) {
            recommendations.push('Your browser doesn\'t support real-time communication - please update your browser');
          }
          break;
      }
    }
  }

  // Add general recommendations
  if (recommendations.length === 0) {
    recommendations.push('All systems appear to be working correctly');
  } else {
    recommendations.push('If problems persist, try restarting your browser or device');
    recommendations.push('Contact technical support if issues continue');
  }

  return Array.from(new Set(recommendations)); // Remove duplicates
}