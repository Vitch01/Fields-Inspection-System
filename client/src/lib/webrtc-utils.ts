// ============================================================
// ENHANCED MOBILE CARRIER DETECTION AND TRANSPORT SELECTION
// ============================================================

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'unknown';
  effectiveType: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  isMobileDevice: boolean;
  carrierLikelihood: 'high' | 'medium' | 'low';
  recommendedTransport: 'websocket' | 'http-polling' | 'auto';
}

export interface CarrierDetectionResult {
  isProblematicCarrier: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  recommendHttpPolling: boolean;
}

// Enhanced mobile carrier detection with WebSocket blocking indicators
export function detectMobileCarrierBlocking(): CarrierDetectionResult {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const userAgent = navigator.userAgent.toLowerCase();
  
  let isProblematic = false;
  let reason = '';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Check for mobile device first
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  if (!isMobileDevice) {
    return {
      isProblematicCarrier: false,
      reason: 'Not a mobile device',
      confidence: 'high',
      recommendHttpPolling: false
    };
  }
  
  // Analyze connection characteristics for carrier blocking indicators
  if (connection) {
    const cellularTypes = ['cellular', '2g', '3g', '4g', '5g'];
    const isOnCellular = cellularTypes.includes(connection.effectiveType?.toLowerCase()) || 
                        cellularTypes.includes(connection.type?.toLowerCase());
    
    if (isOnCellular) {
      // High RTT combined with cellular connection indicates potential proxy/filtering
      const highRTT = connection.rtt && connection.rtt > 500;
      const lowBandwidth = connection.downlink && connection.downlink < 1.0;
      const dataRestrictions = connection.saveData;
      
      if (highRTT || dataRestrictions) {
        isProblematic = true;
        reason = `Cellular network with${highRTT ? ' high latency' : ''}${dataRestrictions ? ' data restrictions' : ''}`;
        confidence = 'high';
      } else if (lowBandwidth) {
        isProblematic = true;
        reason = 'Cellular network with limited bandwidth - may block WebSocket';
        confidence = 'medium';
      } else {
        // General cellular connection - moderate risk
        isProblematic = true;
        reason = 'Cellular connection detected - some carriers block WebSocket';
        confidence = 'medium';
      }
    }
  } else if (isMobileDevice) {
    // Mobile device without connection API - assume risk
    isProblematic = true;
    reason = 'Mobile device without network info - assuming carrier risk';
    confidence = 'medium';
  }
  
  // Additional mobile-specific indicators
  const operaMini = userAgent.includes('opera mini');
  const chromeDataSaver = userAgent.includes('chrome') && userAgent.includes('mobile') && connection?.saveData;
  
  if (operaMini || chromeDataSaver) {
    isProblematic = true;
    reason = 'Data compression/proxy detected - likely blocks WebSocket';
    confidence = 'high';
  }
  
  return {
    isProblematicCarrier: isProblematic,
    reason,
    confidence,
    recommendHttpPolling: isProblematic && confidence !== 'low'
  };
}

// Enhanced network analysis for transport selection
export function analyzeNetworkConnection(): NetworkInfo {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  const networkInfo: NetworkInfo = {
    type: 'unknown',
    effectiveType: 'unknown',
    isMobileDevice,
    carrierLikelihood: 'low',
    recommendedTransport: 'websocket'
  };
  
  if (connection) {
    networkInfo.downlink = connection.downlink;
    networkInfo.rtt = connection.rtt;
    networkInfo.saveData = connection.saveData;
    networkInfo.effectiveType = connection.effectiveType || connection.type || 'unknown';
    
    // Determine network type
    const cellularTypes = ['cellular', '2g', '3g', '4g', '5g'];
    if (cellularTypes.includes(connection.effectiveType?.toLowerCase()) || 
        cellularTypes.includes(connection.type?.toLowerCase())) {
      networkInfo.type = 'cellular';
    } else if (connection.type === 'wifi') {
      networkInfo.type = 'wifi';
    }
  }
  
  // Assess carrier blocking likelihood
  const carrierDetection = detectMobileCarrierBlocking();
  
  if (carrierDetection.isProblematicCarrier) {
    if (carrierDetection.confidence === 'high') {
      networkInfo.carrierLikelihood = 'high';
      networkInfo.recommendedTransport = 'http-polling';
    } else if (carrierDetection.confidence === 'medium') {
      networkInfo.carrierLikelihood = 'medium';
      networkInfo.recommendedTransport = 'auto'; // Try WebSocket first, fallback to HTTP
    }
  }
  
  // Override for known good connections
  if (networkInfo.type === 'wifi' && !isMobileDevice) {
    networkInfo.carrierLikelihood = 'low';
    networkInfo.recommendedTransport = 'websocket';
  }
  
  return networkInfo;
}

// Legacy functions maintained for compatibility
export function isMobileConnection(): boolean {
  const networkInfo = analyzeNetworkConnection();
  return networkInfo.isMobileDevice || networkInfo.type === 'cellular';
}

export function getNetworkType(): 'wifi' | 'cellular' | 'unknown' {
  const networkInfo = analyzeNetworkConnection();
  return networkInfo.type;
}

// Transport selection utility
export function selectOptimalTransport(): 'websocket' | 'http-polling' {
  const networkInfo = analyzeNetworkConnection();
  
  console.log('🔍 [Transport Selection] Network analysis:', {
    type: networkInfo.type,
    effectiveType: networkInfo.effectiveType,
    isMobile: networkInfo.isMobileDevice,
    carrierRisk: networkInfo.carrierLikelihood,
    recommended: networkInfo.recommendedTransport,
    rtt: networkInfo.rtt,
    downlink: networkInfo.downlink
  });
  
  // Force HTTP polling for high-risk mobile connections
  if (networkInfo.recommendedTransport === 'http-polling') {
    console.log('📱 [Transport Selection] Selecting HTTP polling due to high carrier blocking risk');
    return 'http-polling';
  }
  
  // Default to WebSocket for most connections
  return 'websocket';
}

// WebSocket blocking detection utilities
export function isWebSocketLikelyBlocked(errorCode?: number): boolean {
  // WebSocket error codes that indicate mobile carrier blocking
  const blockingCodes = [1005, 1006, 1015]; // No status code, abnormal closure, TLS handshake failure
  
  if (errorCode && blockingCodes.includes(errorCode)) {
    return true;
  }
  
  // Additional heuristics based on network analysis
  const networkInfo = analyzeNetworkConnection();
  return networkInfo.carrierLikelihood === 'high';
}

// Connectivity testing utilities
export async function testWebSocketConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const testWs = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      testWs.close();
      resolve(false);
    }, 5000); // 5 second timeout
    
    testWs.onopen = () => {
      clearTimeout(timeout);
      testWs.close();
      resolve(true);
    };
    
    testWs.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    
    testWs.onclose = (event) => {
      clearTimeout(timeout);
      // Successful close after open means connectivity is working
      resolve(event.wasClean);
    };
  });
}

export function createPeerConnection(forceMobileOptimization: boolean = false): RTCPeerConnection {
  const isMobile = isMobileConnection() || forceMobileOptimization;
  const networkType = getNetworkType();
  
  console.log(`Creating peer connection - Mobile: ${isMobile}, Network: ${networkType}`);
  
  const configuration: RTCConfiguration = {
    iceServers: [
      // STUN servers for NAT traversal - More reliable Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Additional STUN servers for better mobile connectivity
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.ekiga.net' },
      
      // ============================================================
      // ENHANCED TURN SERVERS FOR MOBILE CONNECTIVITY
      // ============================================================
      // Multiple TURN server providers for maximum reliability
      // These provide better mobile carrier compatibility
      
      // Cloudflare TURN servers (primary)
      { 
        urls: 'turn:turn.cloudflare.com:3478',
        username: 'public',
        credential: 'public'
      },
      { 
        urls: 'turn:turn.cloudflare.com:443?transport=tcp',
        username: 'public',
        credential: 'public'
      },
      
      // Additional public TURN servers for fallback
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      
      // Backup TURN servers on different ports for mobile carriers
      {
        urls: 'turn:relay.backups.cz',
        username: 'webrtc',
        credential: 'webrtc'
      },
      {
        urls: 'turn:relay.backups.cz?transport=tcp',
        username: 'webrtc',
        credential: 'webrtc'
      }
      // ============================================================
    ],
    
    // Mobile-optimized ICE configuration
    iceCandidatePoolSize: isMobile ? 20 : 10, // More candidates for mobile
    
    // For mobile networks, allow both STUN and TURN but prioritize TURN
    iceTransportPolicy: 'all',
    
    // Mobile-specific connection policies
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
  
  // Force relay (TURN only) for known problematic mobile networks if needed
  if (isMobile && networkType === 'cellular') {
    console.log('Detected cellular connection - using enhanced mobile configuration');
    configuration.iceCandidatePoolSize = 25; // Even more candidates for cellular
  }

  const pc = new RTCPeerConnection(configuration);
  
  // Add mobile-specific event logging
  if (isMobile) {
    pc.addEventListener('connectionstatechange', () => {
      console.log(`🔄 [Mobile] Connection state: ${pc.connectionState}`);
    });
    
    pc.addEventListener('icegatheringstatechange', () => {
      console.log(`🧊 [Mobile] ICE gathering: ${pc.iceGatheringState}`);
    });
    
    pc.addEventListener('iceconnectionstatechange', () => {
      console.log(`❄️ [Mobile] ICE connection: ${pc.iceConnectionState}`);
    });
  }
  
  return pc;
}

export async function captureImageFromStream(stream: MediaStream): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.srcObject = stream;
    video.play();

    video.onloadedmetadata = () => {
      // Save photo exactly as it appears in the video frame
      // This preserves the orientation as seen when capturing
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame at its natural size and orientation
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.9);
    };

    video.onerror = () => {
      reject(new Error('Video load error'));
    };
  });
}

// New function to capture photo using device camera
export async function capturePhotoFromCamera(): Promise<Blob> {
  try {
    // Request high-resolution photo capture from rear camera with natural orientation
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }, // Rear camera
        // Remove specific width/height constraints to preserve natural orientation
        // Let the camera use its natural resolution and orientation
      }
    });

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        // Use natural video dimensions to preserve orientation
        // If video is wider than tall = horizontal/landscape
        // If video is taller than wide = vertical/portrait
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame to canvas preserving natural orientation
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        // Stop the camera stream after capture
        stream.getTracks().forEach(track => track.stop());
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.95); // Higher quality for photos
      };

      video.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Video load error'));
      };
    });
  } catch (error) {
    throw new Error(`Camera access failed: ${error}`);
  }
}

export function getMediaConstraints(quality: 'low' | 'medium' | 'high') {
  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: true,
  };

  switch (quality) {
    case 'low':
      constraints.video = { width: 640, height: 480 };
      break;
    case 'medium':
      constraints.video = { width: 1280, height: 720 };
      break;
    case 'high':
      constraints.video = { width: 1920, height: 1080 };
      break;
  }

  return constraints;
}

// Utility function to get rotation class for images based on video rotation
export function getImageRotationClass(videoRotation: number): string {
  switch (videoRotation) {
    case 90: return 'rotate-90';
    case -90: return '-rotate-90';
    case 180: return 'rotate-180';
    default: return '';
  }
}

// Canvas-based recording utilities for baked-in rotation
export interface CanvasRecordingElements {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  context: CanvasRenderingContext2D;
  stream: MediaStream;
  cleanup: () => void;
}

// Create a canvas-based recording stream with rotation baked in
export function createCanvasRecordingStream(
  sourceStream: MediaStream,
  videoRotation: number = 0,
  frameRate: number = 30
): Promise<CanvasRecordingElements> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Feature detection for canvas.captureStream
    if (typeof canvas.captureStream !== 'function') {
      reject(new Error('Canvas captureStream not supported by this browser'));
      return;
    }
    
    const video = document.createElement('video');

    // Create cleanup function
    let animationId: number | null = null;
    let isRendering = false;
    let lastFrameTime = 0;
    const frameDuration = 1000 / frameRate; // Convert to milliseconds

    const cleanup = () => {
      isRendering = false;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      // Don't stop the source stream, just clean up our rendering
      video.srcObject = null;
      
      // CRITICAL FIX: Remove DOM elements to prevent memory leaks
      try {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      } catch (error) {
        console.warn('Error removing DOM elements during cleanup:', error);
      }
      
      // Canvas stream tracks will be stopped by the calling code
    };

    // Hide elements
    video.style.position = 'absolute';
    video.style.left = '-9999px';
    video.style.top = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.muted = true;
    video.playsInline = true;

    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';

    // Append to document
    document.body.appendChild(video);
    document.body.appendChild(canvas);

    video.srcObject = sourceStream;
    video.play().catch(reject);

    video.onloadedmetadata = () => {
      try {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
          cleanup();
          reject(new Error('Invalid video dimensions'));
          return;
        }

        // Calculate canvas dimensions based on rotation
        const needsSwap = Math.abs(videoRotation) === 90 || Math.abs(videoRotation) === 270;
        canvas.width = needsSwap ? videoHeight : videoWidth;
        canvas.height = needsSwap ? videoWidth : videoHeight;

        // Start the canvas stream
        const canvasStream = canvas.captureStream(frameRate);
        
        // Setup optimized rendering loop with frame rate limiting
        isRendering = true;
        lastFrameTime = performance.now();
        
        const renderFrame = (currentTime: number) => {
          if (!isRendering) return;

          // PERFORMANCE FIX: Frame rate limiting - only render when enough time has passed
          const timeSinceLastFrame = currentTime - lastFrameTime;
          if (timeSinceLastFrame < frameDuration) {
            animationId = requestAnimationFrame(renderFrame);
            return;
          }
          
          lastFrameTime = currentTime;

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Save context state
          ctx.save();

          // Apply rotation transformation
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;

          ctx.translate(centerX, centerY);
          ctx.rotate((videoRotation * Math.PI) / 180);

          // Draw video frame centered after rotation
          const drawWidth = needsSwap ? videoHeight : videoWidth;
          const drawHeight = needsSwap ? videoWidth : videoHeight;
          
          ctx.drawImage(
            video,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
          );

          // Restore context state
          ctx.restore();

          // Schedule next frame
          animationId = requestAnimationFrame(renderFrame);
        };

        // Start rendering with initial timestamp
        renderFrame(performance.now());

        resolve({
          canvas,
          video,
          context: ctx,
          stream: canvasStream,
          cleanup
        });

      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Video load error'));
    };
  });
}

// Create a composed stream with rotated video and original audio
export async function createRotatedRecordingStream(
  sourceStream: MediaStream,
  videoRotation: number = 0,
  frameRate: number = 30
): Promise<{ stream: MediaStream; cleanup: () => void }> {
  try {
    // Feature detection fallback
    const testCanvas = document.createElement('canvas');
    if (typeof testCanvas.captureStream !== 'function') {
      throw new Error('Canvas captureStream not supported - falling back to direct recording');
    }
    
    // Create canvas recording for video
    const canvasElements = await createCanvasRecordingStream(sourceStream, videoRotation, frameRate);
    
    // Create composed stream
    const composedStream = new MediaStream();
    
    // Add rotated video track from canvas
    const videoTracks = canvasElements.stream.getVideoTracks();
    videoTracks.forEach(track => {
      composedStream.addTrack(track);
    });
    
    // CRITICAL FIX: Clone audio tracks to prevent stopping original call audio
    const audioTracks = sourceStream.getAudioTracks();
    audioTracks.forEach(originalTrack => {
      // Clone the audio track so we can stop the cloned version without affecting the original
      const clonedTrack = originalTrack.clone();
      composedStream.addTrack(clonedTrack);
    });

    const cleanup = () => {
      // Stop composed stream tracks (only affects our cloned audio tracks and canvas video)
      composedStream.getTracks().forEach(track => {
        track.stop();
      });
      
      // Cleanup canvas elements
      canvasElements.cleanup();
    };

    return {
      stream: composedStream,
      cleanup
    };

  } catch (error) {
    throw new Error(`Failed to create rotated recording stream: ${error}`);
  }
}
