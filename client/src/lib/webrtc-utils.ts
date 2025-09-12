export function createPeerConnection(): RTCPeerConnection {
  const configuration: RTCConfiguration = {
    iceServers: [
      // STUN servers for NAT traversal
      // Using multiple Google STUN servers for redundancy
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // ============================================================
      // TEMPORARY PUBLIC TURN SERVERS FOR MOBILE CONNECTIVITY
      // ============================================================
      // WARNING: These are public demo TURN servers with public credentials
      // They enable connectivity for mobile devices on restrictive carrier-grade NAT networks
      // DO NOT use these in production - they are a temporary stopgap solution
      // 
      // PRODUCTION IMPLEMENTATION:
      // 1. Set up a backend endpoint to generate time-limited credentials (24-hour expiry)
      // 2. Use per-user authentication tokens for credential generation
      // 3. Implement secure credential rotation mechanism
      // 4. Consider using services like:
      //    - Twilio Network Traversal Service
      //    - Xirsys TURN servers
      //    - Self-hosted CoTURN server
      //    - Cloudflare Calls TURN service
      //
      // LIMITATIONS OF THESE PUBLIC SERVERS:
      // - May have usage limits or bandwidth restrictions
      // - Could be shut down at any time without notice
      // - No guarantee of availability or performance
      // - Shared with other users (potential congestion)
      //
      // These Cloudflare public TURN servers use "public" credentials intentionally
      // for demo/development purposes only
      { 
        urls: 'turn:turn.cloudflare.com:3478',
        username: 'public',
        credential: 'public'
      },
      { 
        urls: 'turn:turn.cloudflare.com:443?transport=tcp',
        username: 'public',
        credential: 'public'
      }
      // ============================================================
    ],
    // Optimize ICE gathering for slow cellular connections
    iceCandidatePoolSize: 20, // Further increased for slow mobile connectivity
    // Allow both STUN and TURN for maximum compatibility
    iceTransportPolicy: 'all',
    // Optimize for network changes and mobile connections
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
    // Note: Extended timeouts for slow networks are handled in the hook logic
    // Enhanced ICE settings for network transitions
    // Note: iceGatheringPolicy is not a standard RTCConfiguration property
  };

  const pc = new RTCPeerConnection(configuration);
  
  // Enhanced logging for debugging network transitions
  pc.onicegatheringstatechange = () => {
    console.log(`[WebRTC] ICE gathering state: ${pc.iceGatheringState}`);
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
      console.warn(`[WebRTC] ICE connection ${pc.iceConnectionState} - may need restart`);
    }
  };
  
  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
    if (pc.connectionState === 'failed') {
      console.error('[WebRTC] Connection failed - likely network transition issue');
    }
  };
  
  // Log ICE candidates for debugging network transitions
  const originalIceCandidateHandler = pc.onicecandidate;
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`[WebRTC] ICE candidate: ${event.candidate.type} (${event.candidate.protocol}) - ${event.candidate.candidate.substring(0, 50)}...`);
    } else {
      console.log('[WebRTC] ICE candidate gathering complete');
    }
    // Call the original handler if it exists
    if (originalIceCandidateHandler) {
      originalIceCandidateHandler.call(pc, event);
    }
  };
  
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

// Enhanced peer connection creation specifically for network recovery
export function createRecoveredPeerConnection(originalPC?: RTCPeerConnection): RTCPeerConnection {
  // If we have an original peer connection, copy some settings
  const pc = createPeerConnection();
  
  console.log('[WebRTC] Created recovered peer connection for network transition');
  
  return pc;
}

// Enhanced network quality types
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
export type VideoQuality = 'high' | 'medium' | 'low' | 'audio-only';

export interface NetworkCapabilities {
  supportsWebRTC: boolean;
  hasReliableConnection: boolean;
  networkType?: string;
  estimatedBandwidth?: number;
  latency: number;
  quality: NetworkQuality;
  recommendedVideoQuality: VideoQuality;
  canHandleVideo: boolean;
}

// Comprehensive bandwidth detection with multiple tests
export async function checkNetworkCapabilities(): Promise<NetworkCapabilities> {
  const capabilities: NetworkCapabilities = {
    supportsWebRTC: !!window.RTCPeerConnection,
    hasReliableConnection: navigator.onLine,
    latency: 0,
    quality: 'offline',
    recommendedVideoQuality: 'audio-only',
    canHandleVideo: false
  };

  // Get network information if available
  const connection = (navigator as any).connection || 
                   (navigator as any).mozConnection || 
                   (navigator as any).webkitConnection;
  
  if (connection) {
    capabilities.networkType = connection.effectiveType;
    capabilities.estimatedBandwidth = connection.downlink;
  }

  if (!navigator.onLine) {
    return capabilities;
  }

  try {
    // Enhanced connectivity test with multiple metrics
    const testResults = await performBandwidthTest();
    capabilities.latency = testResults.latency;
    capabilities.estimatedBandwidth = testResults.bandwidth;
    capabilities.hasReliableConnection = testResults.reliable;
    
    // Determine network quality and video capability
    const quality = determineNetworkQuality(testResults, connection);
    capabilities.quality = quality.networkQuality;
    capabilities.recommendedVideoQuality = quality.videoQuality;
    capabilities.canHandleVideo = quality.videoQuality !== 'audio-only';
    
  } catch (error) {
    console.warn('Network test failed:', error);
    capabilities.hasReliableConnection = false;
    capabilities.quality = 'poor';
  }

  return capabilities;
}

// Perform comprehensive bandwidth and latency testing
async function performBandwidthTest(): Promise<{
  latency: number;
  bandwidth: number;
  reliable: boolean;
  packetLoss: number;
}> {
  const results = {
    latency: 0,
    bandwidth: 0,
    reliable: false,
    packetLoss: 0
  };

  // Test 1: Basic latency test
  const latencyStart = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased for slow networks
    
    await fetch(window.location.origin + '/api', {
      method: 'HEAD',
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    results.latency = performance.now() - latencyStart;
    results.reliable = results.latency < 10000; // 10 second threshold for slow networks
  } catch (error) {
    results.latency = 15000; // Max timeout
    results.reliable = false;
  }

  // Test 2: Small data transfer test for bandwidth estimation
  if (results.reliable) {
    try {
      const dataSize = 50 * 1024; // 50KB test
      const testData = new Array(dataSize).fill('a').join('');
      
      const bandwidthStart = performance.now();
      const response = await fetch(window.location.origin + '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: testData,
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const duration = (performance.now() - bandwidthStart) / 1000; // seconds
        results.bandwidth = (dataSize * 8) / (1024 * 1024 * duration); // Mbps
      }
    } catch (error) {
      console.warn('Bandwidth test failed:', error);
      results.bandwidth = 0.1; // Assume very slow connection
    }
  }

  // Test 3: Stability test with multiple small requests
  if (results.reliable) {
    const stabilityTests = [];
    for (let i = 0; i < 3; i++) {
      stabilityTests.push(
        fetch(window.location.origin + '/api', {
          method: 'HEAD',
          cache: 'no-cache'
        }).then(
          () => true,
          () => false
        )
      );
    }
    
    try {
      const stabilityResults = await Promise.all(stabilityTests);
      const successRate = stabilityResults.filter(Boolean).length / stabilityResults.length;
      results.packetLoss = (1 - successRate) * 100;
      results.reliable = results.reliable && successRate >= 0.7; // 70% success rate
    } catch (error) {
      results.packetLoss = 50;
      results.reliable = false;
    }
  }

  return results;
}

// Determine network quality and recommended video settings
function determineNetworkQuality(
  testResults: { latency: number; bandwidth: number; reliable: boolean; packetLoss: number },
  connection?: any
): { networkQuality: NetworkQuality; videoQuality: VideoQuality } {
  const { latency, bandwidth, reliable, packetLoss } = testResults;
  
  // Use connection API data if available for cross-validation
  let effectiveBandwidth = bandwidth;
  if (connection && connection.downlink) {
    effectiveBandwidth = Math.min(bandwidth, connection.downlink);
  }
  
  // Network quality determination based on multiple factors
  if (!reliable || packetLoss > 30) {
    return { networkQuality: 'offline', videoQuality: 'audio-only' };
  }
  
  if (latency > 8000 || effectiveBandwidth < 0.2 || packetLoss > 20) {
    return { networkQuality: 'poor', videoQuality: 'audio-only' };
  }
  
  if (latency > 3000 || effectiveBandwidth < 0.5 || packetLoss > 10) {
    return { networkQuality: 'fair', videoQuality: 'low' };
  }
  
  if (latency > 1000 || effectiveBandwidth < 2.0 || packetLoss > 5) {
    return { networkQuality: 'good', videoQuality: 'medium' };
  }
  
  return { networkQuality: 'excellent', videoQuality: 'high' };
}

// Adaptive media constraints based on network conditions and device role
export function getAdaptiveMediaConstraints(
  videoQuality: VideoQuality,
  userRole: 'coordinator' | 'inspector',
  networkCapabilities?: NetworkCapabilities
): MediaStreamConstraints {
  // Enhanced audio settings optimized for various network conditions
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
    // Removed specific audio constraints that could cause failures on some devices
    // Let browser choose optimal audio settings
  };

  // Audio-only mode for very poor connections
  if (videoQuality === 'audio-only') {
    return {
      audio: audioConstraints,
      video: false
    };
  }

  // Device-specific camera preferences
  const baseCameraConstraints = userRole === "inspector" 
    ? { facingMode: { ideal: "environment" } } // Rear camera for inspections
    : { facingMode: "user" }; // Front camera for coordinator

  // Video constraints based on quality level - Made more flexible for mobile compatibility
  let videoConstraints: MediaTrackConstraints;
  
  switch (videoQuality) {
    case 'low':
      videoConstraints = {
        ...baseCameraConstraints,
        width: { ideal: 320 },  // Removed max to allow flexibility
        height: { ideal: 240 }, // Let browser choose if ideal isn't available
        frameRate: { ideal: 15 } // Simplified - no strict max
      };
      break;
      
    case 'medium':
      videoConstraints = {
        ...baseCameraConstraints,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 20 }
      };
      break;
      
    case 'high':
    default:
      videoConstraints = {
        ...baseCameraConstraints,
        width: { 
          ideal: userRole === 'inspector' ? 1280 : 640  // Reduced ideal for mobile compatibility
        },
        height: { 
          ideal: userRole === 'inspector' ? 720 : 480   // More reasonable defaults
        },
        frameRate: { ideal: 24 } // Let device choose best available
      };
      break;
  }

  return {
    audio: audioConstraints,
    video: videoConstraints
  };
}

// Legacy support function
export function getMediaConstraints(quality: 'low' | 'medium' | 'high') {
  const videoQualityMap: Record<string, VideoQuality> = {
    low: 'low',
    medium: 'medium', 
    high: 'high'
  };
  return getAdaptiveMediaConstraints(videoQualityMap[quality], 'coordinator');
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
