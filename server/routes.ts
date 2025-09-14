import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCallSchema, insertCapturedImageSchema, insertVideoRecordingSchema, signalingMessageSchema, videoRecordingSchema, allowedVideoMimeTypes, allowedVideoExtensions } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import twilio from "twilio";

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
  lastPing?: number;
  isAlive?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for signaling
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, WebSocketClient>();

  // WebSocket connection handling with mobile-friendly configuration
  wss.on('connection', (ws: WebSocketClient, req) => {
    // Initialize client properties for mobile tracking
    ws.isAlive = true;
    ws.lastPing = Date.now();
    
    // Comprehensive connection debugging
    const connectionId = Math.random().toString(36).substring(7);
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const remoteAddress = req.socket.remoteAddress;
    const origin = req.headers.origin;
    
    console.log(`🔌 NEW WebSocket connection established:`);
    console.log(`   📊 Connection ID: ${connectionId}`);
    console.log(`   📱 Mobile: ${isMobile}`);
    console.log(`   🌐 Remote Address: ${remoteAddress}`);
    console.log(`   🔗 Origin: ${origin}`);
    console.log(`   🖥️ User-Agent: ${userAgent.substring(0, 100)}`);
    console.log(`   🔢 Total connections: ${clients.size + 1}`);
    console.log(`   ⚡ WebSocket readyState: ${ws.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`);
    
    // Add connection ID for tracking
    (ws as any).connectionId = connectionId;

    ws.on('message', async (data) => {
      try {
        console.log(`📨 Message received on connection ${connectionId}:`);
        console.log(`   📊 Data length: ${Buffer.from(data as Buffer).length} bytes`);
        console.log(`   ⚡ WebSocket readyState: ${ws.readyState}`);
        
        const rawMessage = data.toString();
        console.log(`   📝 Raw message: ${rawMessage.substring(0, 500)}${rawMessage.length > 500 ? '...' : ''}`);
        
        const message = signalingMessageSchema.parse(JSON.parse(rawMessage));
        console.log(`   ✅ Parsed message type: ${message.type}`);
        
        switch (message.type) {
          case 'join-call':
            console.log(`🚀 Processing join-call message on connection ${connectionId}`);
            if (!message.callId || !message.userId) {
              console.error(`❌ Missing callId or userId in join-call message:`, message);
              return;
            }
            
            console.log(`   📋 CallId: ${message.callId}`);
            console.log(`   👤 UserId: ${message.userId}`);
            
            // Check if user already exists
            if (clients.has(message.userId)) {
              console.log(`⚠️ User ${message.userId} already has a connection, replacing...`);
              const oldWs = clients.get(message.userId);
              if (oldWs && oldWs.readyState === ws.OPEN) {
                oldWs.close(1000, 'Replaced by new connection');
              }
            }
            
            ws.userId = message.userId;
            ws.callId = message.callId;
            clients.set(message.userId, ws);
            
            console.log(`✅ User ${message.userId} joined call ${message.callId}`);
            console.log(`   📊 Total active clients: ${clients.size}`);
            
            // Get list of existing peers in the call (excluding the joining user)
            const existingPeers: string[] = [];
            clients.forEach((client, userId) => {
              if (client.callId === message.callId && userId !== message.userId && client.readyState === WebSocket.OPEN) {
                existingPeers.push(userId);
              }
            });
            
            console.log(`👥 Existing peers in call ${message.callId}: [${existingPeers.join(', ')}]`);
            
            // Send peer-ready message to the joining user with list of existing peers
            const peerReadyMessage = {
              type: 'peer-ready',
              callId: message.callId,
              userId: message.userId,
              peers: existingPeers
            };
            
            try {
              ws.send(JSON.stringify(peerReadyMessage));
              console.log(`🤝 Sent peer-ready message to ${message.userId}:`, peerReadyMessage);
            } catch (error) {
              console.error(`❌ Failed to send peer-ready message to ${message.userId}:`, error);
            }
            
            // Broadcast to other participants in the call
            const joinedMessage = {
              type: 'user-joined',
              userId: message.userId,
              callId: message.callId
            };
            console.log(`📢 Broadcasting user-joined message:`, joinedMessage);
            broadcastToCall(message.callId, joinedMessage, message.userId);
            break;

          case 'leave-call':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in leave-call message');
              return;
            }
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
            if (!message.callId || !message.userId) {
              console.error(`Missing callId or userId in ${message.type} message`);
              return;
            }
            // Forward WebRTC signaling to other participants
            broadcastToCall(message.callId, message, message.userId);
            break;

          case 'capture-image':
            if (!message.callId) {
              console.error('Missing callId in capture-image message');
              return;
            }
            // Notify about image capture
            broadcastToCall(message.callId, {
              type: 'image-captured',
              callId: message.callId,
              data: message.data
            });
            break;

          case 'chat-message':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in chat-message');
              return;
            }
            // Forward chat message to other participants
            broadcastToCall(message.callId, {
              type: 'chat-message',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'capture-request':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in capture-request');
              return;
            }
            // Forward capture request from coordinator to inspector
            broadcastToCall(message.callId, {
              type: 'capture-request',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'capture-complete':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in capture-complete');
              return;
            }
            // Forward capture complete notification from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'capture-complete',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'capture-error':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in capture-error');
              return;
            }
            // Forward capture error from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'capture-error',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'ice-restart-request':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in ice-restart-request');
              return;
            }
            // Forward ICE restart request from inspector to coordinator
            broadcastToCall(message.callId, {
              type: 'ice-restart-request',
              callId: message.callId,
              userId: message.userId,
              data: message.data
            }, message.userId);
            break;

          case 'ping':
            // Respond to ping with pong for heartbeat mechanism
            console.log(`💓 Received ping from ${ws.userId || connectionId}`);
            ws.isAlive = true;
            ws.lastPing = Date.now();
            if (ws.readyState === WebSocket.OPEN) {
              const pongMessage = {
                type: 'pong',
                timestamp: message.timestamp || Date.now()
              };
              ws.send(JSON.stringify(pongMessage));
              console.log(`💓 Sent pong response to ${ws.userId || connectionId}`);
            } else {
              console.warn(`⚠️ Cannot send pong - WebSocket not open (readyState: ${ws.readyState})`);
            }
            break;

          case 'pong':
            // Client responded to server ping
            ws.isAlive = true;
            ws.lastPing = Date.now();
            break;
        }
      } catch (error) {
        console.error(`💥 WebSocket message error on connection ${connectionId}:`, error);
        console.log(`   📊 Connection details: userId=${ws.userId}, callId=${ws.callId}, readyState=${ws.readyState}`);
        if (error instanceof Error) {
          console.log(`   📝 Error details: ${error.message}`);
          console.log(`   📚 Stack trace: ${error.stack}`);
        }
      }
    });

    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : '';
      console.log(`🔌❌ WebSocket connection closed:`);
      console.log(`   📊 Connection ID: ${connectionId}`);
      console.log(`   👤 UserId: ${ws.userId || 'undefined'}`);
      console.log(`   📋 CallId: ${ws.callId || 'undefined'}`);
      console.log(`   🔢 Close code: ${code}`);
      console.log(`   📝 Close reason: '${reasonStr}'`);
      console.log(`   ⏱️ Connection duration: ${Date.now() - ws.lastPing!}ms`);
      
      // Log detailed close code meanings
      const closeCodeMeanings = {
        1000: 'Normal Closure',
        1001: 'Going Away',
        1002: 'Protocol Error', 
        1003: 'Unsupported Data',
        1005: 'No Status Received',
        1006: 'Abnormal Closure (network issue)',
        1007: 'Invalid frame payload data',
        1008: 'Policy Violation',
        1009: 'Message too big',
        1010: 'Missing Extension',
        1011: 'Internal Error',
        1012: 'Service Restart',
        1013: 'Try Again Later',
        1014: 'Bad Gateway',
        1015: 'TLS Handshake'
      };
      
      const meaning = closeCodeMeanings[code as keyof typeof closeCodeMeanings] || 'Unknown';
      console.log(`   🔍 Close code meaning: ${meaning}`);
      
      if (ws.userId) {
        console.log(`🗑️ Removing user ${ws.userId} from clients map`);
        clients.delete(ws.userId);
        if (ws.callId) {
          console.log(`📢 Broadcasting user-left message for ${ws.userId}`);
          broadcastToCall(ws.callId, {
            type: 'user-left',
            userId: ws.userId,
            callId: ws.callId
          }, ws.userId);
        }
      }
      
      console.log(`   📊 Remaining active clients: ${clients.size}`);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error(`💥 WebSocket error occurred:`);
      console.log(`   📊 Connection ID: ${connectionId}`);
      console.log(`   👤 UserId: ${ws.userId || 'undefined'}`);
      console.log(`   📋 CallId: ${ws.callId || 'undefined'}`);
      console.log(`   ⚡ ReadyState: ${ws.readyState}`);
      console.error(`   🚨 Error details:`, error);
      
      if (error instanceof Error) {
        console.log(`   📝 Error message: ${error.message}`);
        console.log(`   📚 Stack trace: ${error.stack}`);
      }
    });

    // Send initial ping for mobile connections
    if (isMobile) {
      console.log(`📱 Scheduling initial ping for mobile connection ${connectionId}`);
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log(`💓 Sending initial ping to mobile connection ${connectionId}`);
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } else {
          console.warn(`⚠️ Cannot send initial ping - connection ${connectionId} not open (readyState: ${ws.readyState})`);
        }
      }, 5000);
    }
  });

  function broadcastToCall(callId: string, message: any, excludeUserId?: string) {
    console.log(`📢 Broadcasting to call ${callId} (excluding ${excludeUserId || 'none'}):`, message);
    
    let sentCount = 0;
    let eligibleCount = 0;
    
    clients.forEach((client, userId) => {
      if (client.callId === callId && userId !== excludeUserId) {
        eligibleCount++;
        console.log(`   🎯 Target client: ${userId} (readyState: ${client.readyState})`);
        
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(message));
            sentCount++;
            console.log(`   ✅ Message sent to ${userId}`);
          } catch (error) {
            console.error(`   💥 Failed to send message to client ${userId}:`, error);
            // Remove dead client
            clients.delete(userId);
            console.log(`   🗑️ Removed dead client ${userId}`);
          }
        } else {
          console.log(`   ⚠️ Client ${userId} not ready (readyState: ${client.readyState})`);
        }
      }
    });
    
    console.log(`📊 Broadcast summary: ${sentCount}/${eligibleCount} messages sent successfully`);
  }

  // Periodic cleanup for mobile connections and message queues
  setInterval(() => {
    const now = Date.now();
    const STALE_CONNECTION_TIMEOUT = 60000; // 1 minute
    
    // Clean up stale WebSocket connections
    clients.forEach((client, userId) => {
      if (client.readyState !== WebSocket.OPEN || 
          (client.lastPing && now - client.lastPing > STALE_CONNECTION_TIMEOUT)) {
        console.log(`Removing stale connection for user ${userId}`);
        clients.delete(userId);
        if (client.readyState === WebSocket.OPEN) {
          client.close(1001, 'Connection stale');
        }
      }
    });
    
    // Clean up old message queues
    const cutoff = now - MESSAGE_QUEUE_TTL;
    messageQueues.forEach((queue, callId) => {
      const filtered = queue.filter(msg => msg.timestamp > cutoff);
      if (filtered.length === 0) {
        messageQueues.delete(callId);
      } else {
        messageQueues.set(callId, filtered);
      }
    });
    
    console.log(`Connection cleanup: ${clients.size} active connections, ${messageQueues.size} active message queues`);
  }, 30000); // Run every 30 seconds

  // API Routes

  // Health check endpoint - handles frequent HEAD /api requests
  app.get('/api', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.head('/api', (req, res) => {
    res.status(200).end();
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

  // TURN credentials endpoint for WebRTC with Twilio Network Traversal Service
  app.get('/api/turn-credentials', async (_req, res) => {
    try {
      // Check for required Twilio credentials
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        console.error('Missing Twilio credentials. TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set.');
        return res.status(500).json({ 
          error: 'TURN service unavailable - missing configuration',
          fallbackServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
      }

      // Create Twilio client and generate ephemeral TURN credentials
      const client = twilio(accountSid, authToken);
      const token = await client.tokens.create({ 
        ttl: 3600 // 1 hour TTL for credentials
      });
      
      // Return the ice servers from Twilio token
      res.json({ 
        iceServers: token.iceServers,
        ttl: 3600,
        provider: 'twilio'
      });
      
      console.log('Successfully generated Twilio TURN credentials');
    } catch (error: any) {
      console.error('Failed to generate TURN credentials from Twilio:', error.message);
      
      // Return fallback STUN servers if Twilio fails
      res.status(500).json({ 
        error: 'Failed to generate TURN credentials',
        fallbackServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
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

  // Get all inspectors for field map
  app.get('/api/inspectors', async (req, res) => {
    try {
      const inspectors = await storage.getInspectorUsers();
      
      // Add location data for field map display
      const inspectorsWithLocation = inspectors.map((inspector: any, index: number) => ({
        id: inspector.id,
        name: inspector.name,
        username: inspector.username,
        status: 'available', // Default status, could be enhanced based on active calls
        specialization: 'Field Representative',
        // Distribute inspectors around the field center location
        latitude: 37.097178900157424 + (index * 0.001) - 0.001,
        longitude: -113.58888217976603 + (index * 0.001) - 0.001
      }));
      
      res.json(inspectorsWithLocation);
    } catch (error) {
      console.error('Failed to get inspectors:', error);
      res.status(500).json({ message: 'Failed to get inspectors' });
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

  // HTTP Fallback endpoints for WebSocket alternative
  // Simple message queue for fallback mode (in production, use Redis or similar)
  const messageQueues = new Map<string, any[]>();
  const MESSAGE_QUEUE_TTL = 30000; // 30 seconds

  function addToMessageQueue(callId: string, message: any) {
    if (!messageQueues.has(callId)) {
      messageQueues.set(callId, []);
    }
    
    const queue = messageQueues.get(callId)!;
    queue.push({ ...message, timestamp: Date.now() });
    
    // Clean old messages
    const cutoff = Date.now() - MESSAGE_QUEUE_TTL;
    messageQueues.set(callId, queue.filter(msg => msg.timestamp > cutoff));
  }

  // HTTP fallback: Send message via HTTP POST
  app.post('/api/calls/:callId/messages', async (req, res) => {
    try {
      const { callId } = req.params;
      const message = req.body;
      
      // Validate the message structure
      if (!message.type || !message.userId) {
        return res.status(400).json({ message: 'Invalid message format' });
      }
      
      console.log(`HTTP fallback: Received message for call ${callId}:`, message.type);
      
      // Add to queue for polling clients
      addToMessageQueue(callId, message);
      
      // Also try to broadcast via WebSocket to connected clients
      broadcastToCall(callId, message, message.userId);
      
      res.json({ success: true, timestamp: Date.now() });
    } catch (error) {
      console.error('HTTP fallback send error:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // HTTP fallback: Get messages via HTTP GET (polling)
  app.get('/api/calls/:callId/messages', async (req, res) => {
    try {
      const { callId } = req.params;
      const since = parseInt(req.query.since as string || '0');
      
      const queue = messageQueues.get(callId) || [];
      const newMessages = queue.filter(msg => msg.timestamp > since);
      
      // Clean old messages while we're here
      const cutoff = Date.now() - MESSAGE_QUEUE_TTL;
      messageQueues.set(callId, queue.filter(msg => msg.timestamp > cutoff));
      
      res.json({
        messages: newMessages,
        timestamp: Date.now(),
        count: newMessages.length
      });
    } catch (error) {
      console.error('HTTP fallback poll error:', error);
      res.status(500).json({ message: 'Failed to get messages' });
    }
  });

  // WebSocket connection status endpoint for debugging
  app.get('/api/calls/:callId/connection-status', async (req, res) => {
    try {
      const { callId } = req.params;
      
      const connectedClients = Array.from(clients.entries())
        .filter(([userId, client]) => client.callId === callId)
        .map(([userId, client]) => ({
          userId,
          readyState: client.readyState,
          lastPing: client.lastPing,
          isAlive: client.isAlive
        }));
      
      res.json({
        callId,
        connectedClients,
        totalConnections: connectedClients.length,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get connection status' });
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
