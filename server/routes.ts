import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCallSchema, insertCapturedImageSchema, insertVideoRecordingSchema, signalingMessageSchema, videoRecordingSchema, allowedVideoMimeTypes, allowedVideoExtensions } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Multer configuration for image uploads (10MB limit)
// Configure multer storage for images
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Generate unique filename with proper extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'image-' + uniqueSuffix + ext);
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
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

// Configure multer storage for videos
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Handle MIME types with codec information
    const baseType = file.mimetype.split(';')[0];
    const ext = baseType === 'video/mp4' ? '.mp4' : '.webm';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

// Multer configuration for video uploads (100MB limit)
const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
  fileFilter: (req, file, cb) => {
    // Check if MIME type starts with allowed video types (handles codec info)
    const baseType = file.mimetype.split(';')[0]; // Remove codec information
    if (allowedVideoMimeTypes.includes(baseType as any)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video format. Only ${allowedVideoMimeTypes.join(', ')} are allowed.`));
    }
  }
});

// Ensure uploads directory exists with error handling
try {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
    console.log('Created uploads directory');
  }
} catch (error) {
  console.error('Failed to create uploads directory:', error);
  // Continue execution as this may not be critical for the application to start
  // The uploads directory can be created later when needed
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

  // WebSocket connection handling with enhanced mobile diagnostics
  wss.on('connection', (ws: WebSocketClient, req) => {
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const origin = req.headers.origin || 'Unknown';
    const forwardedFor = req.headers['x-forwarded-for'] || 'None';
    
    // Enhanced connection logging for mobile debugging
    console.log('🔗 New WebSocket connection established:', {
      clientIP,
      userAgent: userAgent.substring(0, 100), // Truncate long user agents
      origin,
      forwardedFor,
      timestamp: new Date().toISOString()
    });

    // Track connection duration and quality
    const connectionStart = Date.now();
    
    ws.on('message', async (data) => {
      try {
        const message = signalingMessageSchema.parse(JSON.parse(data.toString()));
        
        // Enhanced logging for join-call messages to track mobile users
        if (message.type === 'join-call') {
          console.log('👋 User joining call:', {
            userId: message.userId,
            callId: message.callId,
            userAgent: userAgent.substring(0, 80),
            clientIP,
            connectionDuration: Date.now() - connectionStart,
            timestamp: new Date().toISOString()
          });
        }
        
        switch (message.type) {
          case 'join-call':
            ws.userId = message.userId;
            ws.callId = message.callId;
            clients.set(message.userId, ws);
            
            console.log(`✅ User ${message.userId} successfully joined call ${message.callId}. Active connections: ${clients.size}`);
            
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

          case 'capture-request':
            // Forward capture request from coordinator to inspector
            broadcastToCall(message.callId, {
              type: 'capture-request',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'capture-complete':
            // Forward capture complete notification from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'capture-complete',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'capture-error':
            // Forward capture error from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'capture-error',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'ice-restart-request':
            // Forward ICE restart request from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'ice-restart-request',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', {
          error: error instanceof Error ? error.message : String(error),
          userId: ws.userId,
          callId: ws.callId,
          userAgent: userAgent.substring(0, 80),
          clientIP,
          timestamp: new Date().toISOString()
        });
      }
    });

    ws.on('close', (code, reason) => {
      const connectionDuration = Date.now() - connectionStart;
      
      console.log('🔌 WebSocket connection closed:', {
        userId: ws.userId,
        callId: ws.callId,
        code,
        reason: reason.toString(),
        duration: connectionDuration,
        userAgent: userAgent.substring(0, 80),
        clientIP,
        timestamp: new Date().toISOString()
      });
      
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`🚪 User ${ws.userId} left. Remaining connections: ${clients.size}`);
        
        if (ws.callId) {
          broadcastToCall(ws.callId, {
            type: 'user-left',
            userId: ws.userId,
            callId: ws.callId
          }, ws.userId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('💥 WebSocket connection error:', {
        error: error.message,
        userId: ws.userId,
        callId: ws.callId,
        userAgent: userAgent.substring(0, 80),
        clientIP,
        timestamp: new Date().toISOString()
      });
    });
  });

  // ============================================================
  // HTTP POLLING FALLBACK SYSTEM FOR MOBILE CARRIERS
  // ============================================================
  
  // Message queue for HTTP polling fallback when WebSocket is blocked
  interface QueuedMessage {
    id: string;
    callId: string;
    message: any;
    timestamp: number;
    targetUserId?: string; // If specified, only for this user
  }
  
  interface HttpPollingClient {
    callId: string;
    userId: string;
    lastPollTime: number;
    responseCallback?: express.Response;
    isConnected: boolean;
  }
  
  // Message queues by callId -> userId -> messages[]
  const httpMessageQueues = new Map<string, Map<string, QueuedMessage[]>>();
  
  // Active HTTP polling clients
  const httpPollingClients = new Map<string, HttpPollingClient>();
  
  // Long polling timeout (30 seconds)
  const POLL_TIMEOUT = 30000;
  
  // Message cleanup interval (5 minutes)
  const MESSAGE_CLEANUP_INTERVAL = 300000;
  
  function addMessageToQueue(callId: string, message: any, targetUserId?: string, excludeUserId?: string) {
    const queuedMessage: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      callId,
      message,
      timestamp: Date.now(),
      targetUserId
    };
    
    if (!httpMessageQueues.has(callId)) {
      httpMessageQueues.set(callId, new Map());
    }
    
    const callQueues = httpMessageQueues.get(callId)!;
    
    if (targetUserId) {
      // Message for specific user
      if (!callQueues.has(targetUserId)) {
        callQueues.set(targetUserId, []);
      }
      callQueues.get(targetUserId)!.push(queuedMessage);
      console.log(`📨 [HTTP Queue] Added targeted message for user ${targetUserId} in call ${callId}`);
    } else {
      // Broadcast message to all users in call except sender
      httpPollingClients.forEach((client, clientKey) => {
        if (client.callId === callId && client.userId !== excludeUserId) {
          if (!callQueues.has(client.userId)) {
            callQueues.set(client.userId, []);
          }
          callQueues.get(client.userId)!.push(queuedMessage);
        }
      });
      console.log(`📨 [HTTP Queue] Added broadcast message to call ${callId} (excluding ${excludeUserId})`);
    }
    
    // Notify waiting polling clients
    notifyPollingClients(callId, targetUserId, excludeUserId);
  }
  
  function notifyPollingClients(callId: string, targetUserId?: string, excludeUserId?: string) {
    httpPollingClients.forEach((client, clientKey) => {
      if (client.callId === callId && client.userId !== excludeUserId) {
        if (!targetUserId || client.userId === targetUserId) {
          if (client.responseCallback) {
            const messages = getMessagesForUser(callId, client.userId);
            if (messages.length > 0) {
              client.responseCallback.json({
                messages: messages.map(m => m.message),
                transport: 'http-polling',
                timestamp: new Date().toISOString()
              });
              client.responseCallback = undefined;
              client.lastPollTime = Date.now();
            }
          }
        }
      }
    });
  }
  
  function getMessagesForUser(callId: string, userId: string): QueuedMessage[] {
    const callQueues = httpMessageQueues.get(callId);
    if (!callQueues || !callQueues.has(userId)) {
      return [];
    }
    
    const messages = callQueues.get(userId)!;
    // Clear messages after retrieval
    callQueues.set(userId, []);
    
    return messages;
  }
  
  function cleanupOldMessages() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    httpMessageQueues.forEach((callQueues, callId) => {
      callQueues.forEach((messages, userId) => {
        const filteredMessages = messages.filter(msg => now - msg.timestamp < maxAge);
        if (filteredMessages.length !== messages.length) {
          callQueues.set(userId, filteredMessages);
          console.log(`🧹 [HTTP Queue] Cleaned old messages for user ${userId} in call ${callId}`);
        }
      });
    });
  }
  
  // Start cleanup interval
  setInterval(cleanupOldMessages, MESSAGE_CLEANUP_INTERVAL);

  function broadcastToCall(callId: string, message: any, excludeUserId?: string) {
    // Send via WebSocket to connected clients
    clients.forEach((client, userId) => {
      if (client.callId === callId && userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
    
    // Queue message for HTTP polling clients
    addMessageToQueue(callId, message, undefined, excludeUserId);
  }

  // API Routes

  // Health check endpoint - handles frequent HEAD /api requests
  app.get('/api', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.head('/api', (req, res) => {
    res.status(200).end();
  });

  // ============================================================
  // HTTP POLLING SIGNALING ENDPOINTS (MOBILE FALLBACK)
  // ============================================================
  
  // Send signaling message via HTTP (fallback for blocked WebSocket)
  app.post('/api/signaling/send', express.json(), (req, res) => {
    try {
      const message = signalingMessageSchema.parse(req.body);
      const clientIP = req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      console.log(`📤 [HTTP Signaling] Message received:`, {
        type: message.type,
        callId: message.callId,
        userId: message.userId,
        clientIP,
        userAgent: userAgent.substring(0, 80),
        timestamp: new Date().toISOString()
      });
      
      // Process message same as WebSocket - handle different message types
      switch (message.type) {
        case 'join-call':
          // Register HTTP polling client
          const clientKey = `${message.callId}_${message.userId}`;
          httpPollingClients.set(clientKey, {
            callId: message.callId,
            userId: message.userId,
            lastPollTime: Date.now(),
            isConnected: true
          });
          
          console.log(`✅ [HTTP Polling] User ${message.userId} joined call ${message.callId} via HTTP. Active HTTP clients: ${httpPollingClients.size}`);
          
          // Broadcast to WebSocket and other HTTP polling clients
          broadcastToCall(message.callId, {
            type: 'user-joined',
            userId: message.userId,
            callId: message.callId
          }, message.userId);
          break;

        case 'leave-call':
          const leaveClientKey = `${message.callId}_${message.userId}`;
          httpPollingClients.delete(leaveClientKey);
          
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

        case 'capture-request':
          // Forward capture request from coordinator to inspector
          broadcastToCall(message.callId, {
            type: 'capture-request',
            callId: message.callId,
            userId: message.userId,
            data: message.data
          }, message.userId);
          break;

        case 'capture-complete':
          // Forward capture complete notification from inspector to coordinator
          broadcastToCall(message.callId, {
            type: 'capture-complete',
            callId: message.callId,
            userId: message.userId,
            data: message.data
          }, message.userId);
          break;

        case 'capture-error':
          // Forward capture error from inspector to coordinator
          broadcastToCall(message.callId, {
            type: 'capture-error',
            callId: message.callId,
            userId: message.userId,
            data: message.data
          }, message.userId);
          break;

        case 'ice-restart-request':
          // Forward ICE restart request from inspector to coordinator
          broadcastToCall(message.callId, {
            type: 'ice-restart-request',
            callId: message.callId,
            userId: message.userId,
            data: message.data
          }, message.userId);
          break;
      }
      
      res.json({ 
        success: true, 
        transport: 'http-polling',
        timestamp: new Date().toISOString() 
      });
      
    } catch (error) {
      console.error('❌ [HTTP Signaling] Message parsing error:', {
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
        timestamp: new Date().toISOString()
      });
      
      res.status(400).json({ 
        error: 'Invalid signaling message',
        transport: 'http-polling' 
      });
    }
  });
  
  // Long polling endpoint to receive signaling messages
  app.get('/api/signaling/poll/:callId/:userId', (req, res) => {
    const { callId, userId } = req.params;
    const clientKey = `${callId}_${userId}`;
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    console.log(`📡 [HTTP Polling] Long poll started:`, {
      callId,
      userId,
      clientIP,
      userAgent: userAgent.substring(0, 80),
      timestamp: new Date().toISOString()
    });
    
    // Check if user is registered for this call
    if (!httpPollingClients.has(clientKey)) {
      return res.status(404).json({ 
        error: 'User not found in call. Call join-call first.',
        transport: 'http-polling' 
      });
    }
    
    // Update client's last poll time
    const client = httpPollingClients.get(clientKey)!;
    client.lastPollTime = Date.now();
    
    // Check for existing messages
    const existingMessages = getMessagesForUser(callId, userId);
    if (existingMessages.length > 0) {
      console.log(`📨 [HTTP Polling] Immediate response with ${existingMessages.length} messages for ${userId}`);
      return res.json({ 
        messages: existingMessages.map(m => m.message),
        transport: 'http-polling',
        timestamp: new Date().toISOString()
      });
    }
    
    // Set up long polling - wait for new messages
    client.responseCallback = res;
    
    // Set timeout for long polling
    const pollTimeout = setTimeout(() => {
      if (client.responseCallback) {
        console.log(`⏰ [HTTP Polling] Timeout for ${userId}, sending empty response`);
        client.responseCallback.json({ 
          messages: [],
          transport: 'http-polling', 
          timeout: true,
          timestamp: new Date().toISOString()
        });
        client.responseCallback = undefined;
      }
    }, POLL_TIMEOUT);
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearTimeout(pollTimeout);
      if (client.responseCallback) {
        client.responseCallback = undefined;
        console.log(`🔌 [HTTP Polling] Client ${userId} disconnected during poll`);
      }
    });
    
    httpPollingClients.set(clientKey, client);
  });
  
  // Get HTTP polling status for diagnostics
  app.get('/api/signaling/status/:callId', (req, res) => {
    const { callId } = req.params;
    
    const httpClients = Array.from(httpPollingClients.entries())
      .filter(([key, client]) => client.callId === callId)
      .map(([key, client]) => ({
        userId: client.userId,
        lastPollTime: client.lastPollTime,
        isConnected: client.isConnected,
        timeSinceLastPoll: Date.now() - client.lastPollTime
      }));
    
    const wsClients = Array.from(clients.entries())
      .filter(([userId, client]) => client.callId === callId)
      .map(([userId, client]) => ({
        userId,
        readyState: client.readyState,
        connected: client.readyState === WebSocket.OPEN
      }));
    
    const queuedMessageCount = httpMessageQueues.get(callId)?.size || 0;
    
    res.json({
      callId,
      httpPollingClients: httpClients,
      webSocketClients: wsClients,
      queuedMessageCount,
      transport: 'status',
      timestamp: new Date().toISOString()
    });
  });

  // Mobile connectivity diagnostic endpoints
  app.get('/api/mobile-diagnostics', (req, res) => {
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const origin = req.headers.origin || 'Unknown';
    const forwardedFor = req.headers['x-forwarded-for'] || 'None';
    const acceptLanguage = req.headers['accept-language'] || 'None';
    const connection = req.headers.connection || 'None';
    
    // Analyze User-Agent for mobile detection
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTabletUA = /iPad|Android.*Tablet|Windows.*Touch/i.test(userAgent);
    const browserInfo = {
      isMobile: isMobileUA,
      isTablet: isTabletUA,
      isDesktop: !isMobileUA && !isTabletUA,
      browser: userAgent.includes('Chrome') ? 'Chrome' : 
               userAgent.includes('Firefox') ? 'Firefox' : 
               userAgent.includes('Safari') ? 'Safari' : 'Unknown'
    };

    const diagnostics = {
      timestamp: new Date().toISOString(),
      server: {
        healthy: true,
        port: process.env.PORT || '5000',
        environment: process.env.NODE_ENV || 'development'
      },
      client: {
        ip: clientIP,
        forwardedFor,
        userAgent: userAgent.substring(0, 200),
        origin,
        acceptLanguage,
        connection,
        browserInfo
      },
      websocket: {
        serverRunning: !!wss,
        activeConnections: clients.size,
        path: '/ws',
        url: `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/ws`
      },
      network: {
        // These will be filled by client-side tests
        message: 'Run client-side network tests for complete analysis'
      }
    };

    console.log('📊 Mobile diagnostics requested:', {
      from: clientIP,
      userAgent: userAgent.substring(0, 100),
      browserInfo,
      timestamp: new Date().toISOString()
    });

    res.json(diagnostics);
  });

  app.post('/api/mobile-diagnostics/websocket-test', (req, res) => {
    const { success, error, duration, networkInfo } = req.body;
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    console.log('🧪 WebSocket test result received:', {
      success,
      error,
      duration,
      networkInfo,
      from: clientIP,
      userAgent: userAgent.substring(0, 100),
      timestamp: new Date().toISOString()
    });

    // Store test results for analysis (in production, this would go to a database)
    res.json({ received: true, timestamp: new Date().toISOString() });
  });

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
        return res.status(400).json({ message: 'No file uploaded' });
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
      
      // Convert to camelCase for frontend compatibility
      const formattedImage = {
        id: image.id,
        callId: image.callId,
        filename: image.filename,
        originalUrl: image.originalUrl,
        thumbnailUrl: image.thumbnailUrl,
        capturedAt: image.capturedAt,
        metadata: image.metadata
      };
      
      res.json(formattedImage);
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(400).json({ message: 'Failed to save image' });
    }
  });

  app.get('/api/calls/:callId/images', async (req, res) => {
    try {
      const images = await storage.getCapturedImages(req.params.callId);
      
      // Convert snake_case to camelCase for frontend compatibility
      const formattedImages = images.map(image => ({
        id: image.id,
        callId: image.callId,
        filename: image.filename,
        originalUrl: image.originalUrl,
        thumbnailUrl: image.thumbnailUrl,
        capturedAt: image.capturedAt,
        metadata: image.metadata
      }));
      
      res.json(formattedImages);
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
      const { videoRotation = "0" } = req.body;

      // Double-check MIME type (defense in depth) - handle codec information
      const baseType = req.file.mimetype.split(';')[0]; // Remove codec information
      if (!allowedVideoMimeTypes.includes(baseType as any)) {
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

      // File has already been saved with proper name by multer
      const uniqueFilename = req.file.filename;
      
      console.log(`Recording saved: ${uniqueFilename} for call ${callId}, size: ${req.file.size} bytes`);
      
      // Save recording metadata to database
      try {
        const videoData = insertVideoRecordingSchema.parse({
          callId,
          filename: uniqueFilename,
          originalUrl: `/uploads/${uniqueFilename}`,
          duration: req.body.duration || null,
          size: req.file.size.toString(),
          metadata: {
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            timestamp,
            videoRotation: parseInt(videoRotation, 10)
          }
        });

        const recording = await storage.createVideoRecording(videoData);
        console.log('Recording metadata saved to database:', recording.id);
        
        res.json({ 
          success: true, 
          id: recording.id,
          filename: uniqueFilename,
          callId,
          timestamp,
          url: `/uploads/${uniqueFilename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          recordedAt: recording.recordedAt
        });
      } catch (dbError) {
        console.error('Database save failed for video recording:', dbError);
        // File was saved successfully, but DB save failed - still return success
        res.json({ 
          success: true, 
          filename: uniqueFilename,
          callId,
          timestamp,
          url: `/uploads/${uniqueFilename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          warning: 'Metadata not saved to database'
        });
      }
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
  }, express.static('uploads'), (req, res, next) => {
    // If express.static didn't handle the request (file not found), return 404
    if (!res.headersSent) {
      res.status(404).json({ message: 'File not found' });
    }
  });

  // Get video recordings for a call
  app.get('/api/calls/:callId/recordings', async (req, res) => {
    try {
      const recordings = await storage.getVideoRecordings(req.params.callId);
      
      // Convert to camelCase for frontend compatibility
      const formattedRecordings = recordings.map(recording => ({
        id: recording.id,
        callId: recording.callId,
        filename: recording.filename,
        originalUrl: recording.originalUrl,
        duration: recording.duration,
        size: recording.size,
        recordedAt: recording.recordedAt,
        metadata: recording.metadata
      }));
      
      res.json(formattedRecordings);
    } catch (error) {
      console.error('Failed to get recordings:', error);
      res.status(500).json({ message: 'Failed to get recordings' });
    }
  });

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
    
    if (error.message && (error.message.includes('Invalid file type') || error.message.includes('Invalid video format'))) {
      return res.status(400).json({
        message: 'Invalid file type',
        details: error.message
      });
    }
    
    next(error);
  });

  return httpServer;
}
