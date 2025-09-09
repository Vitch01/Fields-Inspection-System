import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCallSchema, insertCapturedImageSchema, signalingMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
      const callData = insertCallSchema.parse(req.body);
      const call = await storage.createCall(callData);
      res.json(call);
    } catch (error) {
      res.status(400).json({ message: 'Invalid call data' });
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

  // Image capture routes
  app.post('/api/calls/:callId/images', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const { callId } = req.params;
      const { filename = req.file.originalname } = req.body;

      const imageData = insertCapturedImageSchema.parse({
        callId,
        filename,
        originalUrl: `/uploads/${req.file.filename}`,
        thumbnailUrl: `/uploads/${req.file.filename}`, // In production, generate actual thumbnail
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
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

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  return httpServer;
}
