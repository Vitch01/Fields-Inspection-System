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
    // Improve ICE gathering on mobile networks
    iceCandidatePoolSize: 10,
    // Force all traffic through TURN for mobile connections if needed
    iceTransportPolicy: 'all', // Use 'all' to allow both STUN and TURN
    // Better handling of network changes
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  return new RTCPeerConnection(configuration);
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
