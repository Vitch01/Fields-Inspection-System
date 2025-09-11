export function createPeerConnection(): RTCPeerConnection {
  const configuration: RTCConfiguration = {
    iceServers: [
      // STUN servers for NAT discovery
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Public TURN servers for mobile/cross-network connectivity
      // These relay traffic when direct connections fail
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject', 
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    // Improve ICE gathering for mobile networks
    iceCandidatePoolSize: 10,
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

// Adaptive video constraints for mobile/poor connections
export function getAdaptiveVideoConstraints(userRole: string, qualityLevel: 'minimal' | 'low' | 'medium' | 'high') {
  const baseAudioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  let videoConstraints: any;

  switch (qualityLevel) {
    case 'minimal':
      // Ultra-low quality for initial connection
      videoConstraints = {
        width: { ideal: 320, max: 480 },
        height: { ideal: 240, max: 360 },
        frameRate: { ideal: 15, max: 20 },
        facingMode: userRole === "inspector" ? { ideal: "environment" } : "user"
      };
      break;
    
    case 'low':
      // Low quality for poor connections
      videoConstraints = {
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 20, max: 25 },
        facingMode: userRole === "inspector" ? { ideal: "environment" } : "user"
      };
      break;
    
    case 'medium':
      // Medium quality for decent connections
      videoConstraints = {
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 25, max: 30 },
        facingMode: userRole === "inspector" ? { ideal: "environment" } : "user"
      };
      break;
    
    case 'high':
      // High quality for good connections
      videoConstraints = userRole === "inspector" 
        ? { 
            width: { ideal: 1280, max: 1920 }, 
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 },
            facingMode: { ideal: "environment" }
          }
        : { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: "user"
          };
      break;
  }

  return {
    video: videoConstraints,
    audio: baseAudioConstraints,
  };
}

// Monitor connection quality and suggest adaptations
export class ConnectionQualityMonitor {
  private pc: RTCPeerConnection;
  private qualityCallbacks: ((quality: 'poor' | 'fair' | 'good') => void)[] = [];
  private monitoringInterval?: number;
  private lastStats: any = {};

  constructor(peerConnection: RTCPeerConnection) {
    this.pc = peerConnection;
  }

  startMonitoring() {
    this.monitoringInterval = window.setInterval(async () => {
      try {
        const stats = await this.pc.getStats();
        this.analyzeStats(stats);
      } catch (error) {
        console.error('Failed to get connection stats:', error);
      }
    }, 3000); // Check every 3 seconds
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  onQualityChange(callback: (quality: 'poor' | 'fair' | 'good') => void) {
    this.qualityCallbacks.push(callback);
  }

  private analyzeStats(stats: RTCStatsReport) {
    let inboundRtp: any = null;
    let outboundRtp: any = null;

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        inboundRtp = report;
      }
      if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        outboundRtp = report;
      }
    });

    if (inboundRtp) {
      const packetsLost = inboundRtp.packetsLost || 0;
      const packetsReceived = inboundRtp.packetsReceived || 0;
      const lossRate = packetsReceived > 0 ? packetsLost / (packetsLost + packetsReceived) : 0;
      
      const framesDropped = inboundRtp.framesDropped || 0;
      const framesDecoded = inboundRtp.framesDecoded || 0;
      const dropRate = framesDecoded > 0 ? framesDropped / (framesDropped + framesDecoded) : 0;

      let quality: 'poor' | 'fair' | 'good' = 'good';
      
      if (lossRate > 0.05 || dropRate > 0.1) {
        quality = 'poor';
      } else if (lossRate > 0.02 || dropRate > 0.05) {
        quality = 'fair';
      }

      this.qualityCallbacks.forEach(callback => callback(quality));
    }
  }
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
