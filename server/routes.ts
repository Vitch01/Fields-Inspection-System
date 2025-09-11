import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCallSchema, insertCapturedImageSchema, signalingMessageSchema, videoRecordingSchema, allowedVideoMimeTypes, allowedVideoExtensions } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Multer configuration for image uploads (10MB limit)
const imageUpload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (req, file, cb) => {
    // Allow common image types for image uploads
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Multer configuration for video uploads (100MB limit)
const videoUpload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
  fileFilter: (req, file, cb) => {
    // Strict MIME type validation for video files
    if (allowedVideoMimeTypes.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video format. Only ${allowedVideoMimeTypes.join(', ')} are allowed.`));
    }
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

interface WebSocketClient extends WebSocket {
  userId?: string;
  callId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for signaling
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, WebSocketClient>();

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const message = signalingMessageSchema.parse(JSON.parse(data.toString()));
        
        switch (message.type) {
          case 'join-call':
            ws.userId = message.userId;
            ws.callId = message.callId;
            clients.set(message.userId, ws);
            
            // Broadcast to other participants in the call
            broadcastToCall(message.callId, {
              type: 'user-joined',
              userId: message.userId,
              callId: message.callId
            }, message.userId);
            break;

          case 'leave-call':
            clients.delete(message.userId);
            broadcastToCall(message.callId, {
              type: 'user-left',
              userId: message.userId,
              callId: message.callId
            }, message.userId);
            break;

          case 'offer':
          case 'answer':
          case 'ice-candidate':
            // Forward WebRTC signaling to other participants
            broadcastToCall(message.callId, message, message.userId);
            break;

          case 'capture-image':
            // Notify about image capture
            broadcastToCall(message.callId, {
              type: 'image-captured',
              callId: message.callId,
              data: message.data
            });
            break;

          case 'chat-message':
            // Forward chat message to other participants
            broadcastToCall(message.callId, {
              type: 'chat-message',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        if (ws.callId) {
          broadcastToCall(ws.callId, {
            type: 'user-left',
            userId: ws.userId,
            callId: ws.callId
          }, ws.userId);
        }
      }
    });
  });

  function broadcastToCall(callId: string, message: any, excludeUserId?: string) {
    clients.forEach((client, userId) => {
      if (client.callId === callId && userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // API Routes

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name } });
    } catch (error) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Call management routes
  app.post('/api/calls', async (req, res) => {
    try {
      console.log('Creating call with data:', JSON.stringify(req.body, null, 2));
      const callData = insertCallSchema.parse(req.body);
      console.log('Parsed call data:', JSON.stringify(callData, null, 2));
      const call = await storage.createCall(callData);
      console.log('Created call:', JSON.stringify(call, null, 2));
      res.json(call);
    } catch (error: any) {
      console.error('Call creation failed:', error.message, error.stack);
      if (error.name === 'ZodError') {
        console.error('Zod validation errors:', JSON.stringify(error.errors, null, 2));
      }
      res.status(400).json({ message: 'Invalid call data', error: error.message });
    }
  });

  app.get('/api/calls/:id', async (req, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ message: 'Call not found' });
      }
      res.json(call);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get call' });
    }
  });

  app.patch('/api/calls/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const endedAt = status === 'ended' ? new Date() : undefined;
      
      const call = await storage.updateCallStatus(req.params.id, status, endedAt);
      if (!call) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      res.json(call);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update call status' });
    }
  });

  app.get('/api/users/:userId/active-call', async (req, res) => {
    try {
      const call = await storage.getActiveCallForUser(req.params.userId);
      res.json(call || null);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get active call' });
    }
  });

  // Location tracking routes
  app.post('/api/calls/:callId/location', async (req, res) => {
    try {
      const { callId } = req.params;
      const locationData = req.body;
      
      const success = await storage.updateCallLocation(callId, locationData);
      if (!success) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update location' });
    }
  });

  // Image capture routes
  app.post('/api/calls/:callId/images', imageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const { callId } = req.params;
      const { filename = req.file.originalname, videoRotation = "0" } = req.body;

      const imageData = insertCapturedImageSchema.parse({
        callId,
        filename,
        originalUrl: `/uploads/${req.file.filename}`,
        thumbnailUrl: `/uploads/${req.file.filename}`, // In production, generate actual thumbnail
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          videoRotation: parseInt(videoRotation, 10)
        }
      });

      const image = await storage.createCapturedImage(imageData);
      res.json(image);
    } catch (error) {
      res.status(400).json({ message: 'Failed to save image' });
    }
  });

  app.get('/api/calls/:callId/images', async (req, res) => {
    try {
      const images = await storage.getCapturedImages(req.params.callId);
      res.json(images);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get images' });
    }
  });

  app.delete('/api/images/:id', async (req, res) => {
    try {
      const success = await storage.deleteCapturedImage(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Image not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete image' });
    }
  });

  // Video recording routes with comprehensive security validation
  app.post('/api/recordings', videoUpload.single('video'), async (req, res) => {
    try {
      // Validate uploaded file exists
      if (!req.file) {
        return res.status(400).json({ 
          message: 'No video file provided',
          details: 'A video file is required for upload'
        });
      }

      // Validate request body using Zod schema
      const validationResult = videoRecordingSchema.safeParse(req.body);
      if (!validationResult.success) {
        // Clean up uploaded file on validation error
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup invalid upload:', cleanupError);
        }
        return res.status(400).json({
          message: 'Invalid request data',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }

      const { callId, timestamp } = validationResult.data;

      // Double-check MIME type (defense in depth)
      if (!allowedVideoMimeTypes.includes(req.file.mimetype as any)) {
        // Clean up uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup invalid upload:', cleanupError);
        }
        return res.status(400).json({
          message: 'Invalid video format',
          details: `Only ${allowedVideoMimeTypes.join(', ')} formats are allowed. Received: ${req.file.mimetype}`
        });
      }

      // Server-controlled file extension based on MIME type
      let serverExtension: string;
      switch (req.file.mimetype) {
        case 'video/webm':
          serverExtension = '.webm';
          break;
        case 'video/mp4':
          serverExtension = '.mp4';
          break;
        default:
          // This should never happen due to multer filtering, but included for safety
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error('Failed to cleanup invalid upload:', cleanupError);
          }
          return res.status(400).json({
            message: 'Unsupported video format',
            details: `MIME type ${req.file.mimetype} is not supported`
          });
      }

      // Generate secure, server-controlled filename
      const sanitizedCallId = callId.replace(/[^a-zA-Z0-9-_]/g, '');
      const uniqueFilename = `recording-${sanitizedCallId}-${Date.now()}${serverExtension}`;
      const finalPath = path.join('uploads', uniqueFilename);

      // Move the file to the final location with proper name
      try {
        fs.renameSync(req.file.path, finalPath);
      } catch (moveError) {
        console.error('Failed to move uploaded file:', moveError);
        // Attempt to clean up the temporary file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp file after move error:', cleanupError);
        }
        return res.status(500).json({
          message: 'Failed to process video file',
          details: 'Internal server error during file processing'
        });
      }
      
      console.log(`Recording saved securely: ${uniqueFilename} for call ${callId}, size: ${req.file.size} bytes`);
      
      res.json({ 
        success: true, 
        filename: uniqueFilename,
        callId,
        timestamp,
        url: `/uploads/${uniqueFilename}`,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error('Failed to save recording:', error);
      
      // Clean up uploaded file on any error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup file after error:', cleanupError);
        }
      }
      
      // Check if error is from multer (file upload errors)
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'File too large',
            details: 'Video file must be smaller than 100MB'
          });
        }
        return res.status(400).json({
          message: 'Upload error',
          details: error.message
        });
      }
      
      res.status(500).json({ 
        message: 'Failed to save recording',
        details: 'An unexpected error occurred during video processing'
      });
    }
  });

  // Serve uploaded files with proper Content-Type headers
  app.use('/uploads', (req, res, next) => {
    // Get file extension to determine content type
    const ext = path.extname(req.path).toLowerCase();
    
    // Set appropriate Content-Type headers based on file extension
    switch (ext) {
      case '.webm':
        res.setHeader('Content-Type', 'video/webm');
        break;
      case '.mp4':
        res.setHeader('Content-Type', 'video/mp4');
        break;
      case '.jpg':
      case '.jpeg':
        res.setHeader('Content-Type', 'image/jpeg');
        break;
      case '.png':
        res.setHeader('Content-Type', 'image/png');
        break;
      case '.webp':
        res.setHeader('Content-Type', 'image/webp');
        break;
      default:
        // For security, only serve known file types
        return res.status(404).json({ message: 'File not found or unsupported file type' });
    }
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    
    next();
  }, express.static('uploads'));

  // Error handling middleware for multer errors
  app.use((error: any, req: any, res: any, next: any) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File too large',
          details: error.field === 'video' ? 'Video file must be smaller than 100MB' : 'Image file must be smaller than 10MB'
        });
      }
      return res.status(400).json({
        message: 'Upload error',
        details: error.message
      });
    }
    
    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({
        message: 'Invalid file type',
        details: error.message
      });
    }
    
    next(error);
  });

  return httpServer;
}
