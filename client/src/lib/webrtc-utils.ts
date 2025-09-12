// Mobile network detection utilities
export function isMobileConnection(): boolean {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    // Check if connection is cellular
    const cellularTypes = ['cellular', '2g', '3g', '4g', '5g'];
    if (cellularTypes.includes(connection.effectiveType?.toLowerCase()) || 
        cellularTypes.includes(connection.type?.toLowerCase())) {
      return true;
    }
  }
  
  // Fallback detection methods
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  return isMobileDevice;
}

export function getNetworkType(): 'wifi' | 'cellular' | 'unknown' {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    const cellularTypes = ['cellular', '2g', '3g', '4g', '5g'];
    if (cellularTypes.includes(connection.effectiveType?.toLowerCase()) || 
        cellularTypes.includes(connection.type?.toLowerCase())) {
      return 'cellular';
    }
    if (connection.type === 'wifi') {
      return 'wifi';
    }
  }
  
  return 'unknown';
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
