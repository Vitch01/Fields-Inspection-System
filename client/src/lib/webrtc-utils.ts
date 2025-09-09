export function createPeerConnection(): RTCPeerConnection {
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0);
      
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
