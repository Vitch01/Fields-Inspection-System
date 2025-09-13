import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCallSchema, insertCapturedImageSchema, insertVideoRecordingSchema, signalingMessageSchema, videoRecordingSchema, allowedVideoMimeTypes, allowedVideoExtensions, clientLoginSchema, clientRegistrationSchema, inspectionRequestFormSchema, coordinatorInspectionRequestsQuerySchema, assignDepartmentSchema, assignCoordinatorSchema, updateInspectionRequestSchema, coordinatorParamsSchema, departmentParamsSchema, inspectionRequestParamsSchema, coordinatorLoginSchema, insertEmailLogSchema } from "@shared/schema";
import { generateToken, generateUserToken, authenticateClient, authenticateCoordinator, authenticateUser, authorizeClientResource, authorizeCoordinatorResource, type AuthenticatedRequest } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import twilio from "twilio";
import { emailService } from "./lib/email";

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
    
    // Detect mobile connections from User-Agent
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    console.log(`New WebSocket connection (mobile: ${isMobile}, UA: ${userAgent.substring(0, 50)})`);

    ws.on('message', async (data) => {
      try {
        const message = signalingMessageSchema.parse(JSON.parse(data.toString()));
        
        switch (message.type) {
          case 'join-call':
            if (!message.callId || !message.userId) {
              console.error('Missing callId or userId in join-call message');
              return;
            }
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
            ws.isAlive = true;
            ws.lastPing = Date.now();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: message.timestamp || Date.now()
              }));
            }
            break;

          case 'pong':
            // Client responded to server ping
            ws.isAlive = true;
            ws.lastPing = Date.now();
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket closed (code: ${code}, reason: ${reason}, userId: ${ws.userId})`);
      
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

    // Handle connection errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${ws.userId}:`, error);
    });

    // Send initial ping for mobile connections
    if (isMobile) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 5000);
    }
  });

  function broadcastToCall(callId: string, message: any, excludeUserId?: string) {
    clients.forEach((client, userId) => {
      if (client.callId === callId && userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send message to client ${userId}:`, error);
          // Remove dead client
          clients.delete(userId);
        }
      }
    });
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
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Handle optional password for coordinators vs required password for inspectors
      if (user.role === 'inspector' && (!user.password || user.password !== password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Coordinators with no password use default authentication
      if (user.role === 'coordinator' && user.password && user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token for authenticated coordinator/inspector session
      const token = generateUserToken(user);
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          name: user.name 
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Client authentication routes
  app.post('/api/client/register', async (req, res) => {
    try {
      const clientData = clientRegistrationSchema.parse(req.body);
      
      // Check if client already exists
      const existingClient = await storage.getClientByEmail(clientData.email);
      if (existingClient) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Remove confirmPassword from data before storing
      const { confirmPassword, ...clientToStore } = clientData;
      
      // Create client with hashed password (handled in storage layer)
      const client = await storage.createClient(clientToStore);
      
      // Generate JWT token for immediate login
      const token = generateToken(client);
      
      res.json({ 
        client: { 
          id: client.id, 
          name: client.name, 
          email: client.email,
          role: 'client'
        },
        token
      });
    } catch (error: any) {
      console.error('Client registration failed:', error.message);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid registration data', errors: error.errors });
      }
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  app.post('/api/client/login', async (req, res) => {
    try {
      const { email, password } = clientLoginSchema.parse(req.body);
      
      // Use secure password validation from storage layer
      const client = await storage.validateClientPassword(email, password);
      if (!client) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Generate JWT token for authenticated session
      const token = generateToken(client);
      
      res.json({ 
        client: { 
          id: client.id, 
          name: client.name, 
          email: client.email,
          role: 'client'
        },
        token
      });
    } catch (error: any) {
      console.error('Client login failed:', error.message);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid login data', errors: error.errors });
      }
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Inspection request management routes - secured with authentication
  app.post('/api/inspection-requests', authenticateClient, async (req: AuthenticatedRequest, res) => {
    try {
      const requestData = inspectionRequestFormSchema.parse(req.body);
      
      // Use authenticated client ID instead of accepting from request body
      const inspectionRequest = await storage.createInspectionRequest({
        ...requestData,
        clientId: req.user!.id // Override any client-supplied clientId with authenticated user
      });
      
      res.json(inspectionRequest);
    } catch (error: any) {
      console.error('Inspection request creation failed:', error.message);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create inspection request' });
    }
  });

  // Change from /client/:clientId to /me to use authenticated context
  app.get('/api/inspection-requests/me', authenticateClient, async (req: AuthenticatedRequest, res) => {
    try {
      // Use authenticated client ID instead of URL parameter
      const requests = await storage.getInspectionRequestsByClient(req.user!.id);
      
      res.json(requests);
    } catch (error: any) {
      console.error('Failed to fetch client inspection requests:', error.message);
      res.status(500).json({ message: 'Failed to fetch inspection requests' });
    }
  });
  
  // Secure the existing endpoint with authorization checks (for backward compatibility)
  app.get('/api/inspection-requests/client/:clientId', authenticateClient, authorizeClientResource, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      
      const requests = await storage.getInspectionRequestsByClient(clientId);
      
      res.json(requests);
    } catch (error: any) {
      console.error('Failed to fetch client inspection requests:', error.message);
      res.status(500).json({ message: 'Failed to fetch inspection requests' });
    }
  });

  app.get('/api/inspection-requests/:id', authenticateClient, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      const request = await storage.getInspectionRequest(id);
      if (!request) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }
      
      // Ensure client can only access their own inspection requests
      if (request.clientId !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied: Cannot access other clients\' inspection requests' });
      }
      
      res.json(request);
    } catch (error: any) {
      console.error('Failed to fetch inspection request:', error.message);
      res.status(500).json({ message: 'Failed to fetch inspection request' });
    }
  });

  // File upload endpoint for inspection request asset photos
  app.post('/api/inspection-requests/:id/photos', authenticateClient, imageUpload.array('photos', 10), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }
      
      // Verify client owns this inspection request
      const inspectionRequest = await storage.getInspectionRequest(id);
      if (!inspectionRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }
      
      if (inspectionRequest.clientId !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied: Cannot upload photos to other clients\' requests' });
      }
      
      // Return file information for frontend to display
      const uploadedFiles = files.map(file => ({
        id: file.filename,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: `/uploads/${file.filename}`,
        uploadedAt: new Date().toISOString()
      }));
      
      res.json({ 
        message: 'Photos uploaded successfully',
        files: uploadedFiles 
      });
    } catch (error: any) {
      console.error('Photo upload failed:', error.message);
      res.status(500).json({ message: 'Failed to upload photos' });
    }
  });

  // Only allow coordinators/admin to update status - clients cannot modify their own requests after submission
  app.put('/api/inspection-requests/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }
      
      // TODO: Add coordinator/admin authentication here when implementing admin features
      // For now, this endpoint should be restricted to internal use only
      
      const updatedRequest = await storage.updateInspectionRequestStatus(id, status);
      if (!updatedRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }
      
      res.json(updatedRequest);
    } catch (error: any) {
      console.error('Failed to update inspection request status:', error.message);
      res.status(500).json({ message: 'Failed to update inspection request status' });
    }
  });

  // Coordinator request management endpoints
  app.get('/api/coordinator/inspection-requests', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate query parameters
      const queryValidation = coordinatorInspectionRequestsQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid query parameters', 
          errors: queryValidation.error.issues 
        });
      }

      const filters = queryValidation.data;
      const requests = await storage.getAllInspectionRequests(filters);
      res.json(requests);
    } catch (error: any) {
      console.error('Failed to get inspection requests:', error.message);
      res.status(500).json({ message: 'Failed to get inspection requests' });
    }
  });

  app.patch('/api/coordinator/inspection-requests/:id/assign-department', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate path parameters
      const paramsValidation = inspectionRequestParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request ID', 
          errors: paramsValidation.error.issues 
        });
      }

      // Validate request body
      const bodyValidation = assignDepartmentSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: bodyValidation.error.issues 
        });
      }

      const { id } = paramsValidation.data;
      const { departmentId } = bodyValidation.data;

      const updatedRequest = await storage.assignRequestToDepartment(id, departmentId);
      if (!updatedRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error('Failed to assign request to department:', error.message);
      
      // Handle conflict errors specifically
      if (error.message.includes('Cannot reassign') || error.message.includes('Cannot assign')) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Failed to assign request to department' });
    }
  });

  app.patch('/api/coordinator/inspection-requests/:id/assign-coordinator', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate path parameters
      const paramsValidation = inspectionRequestParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request ID', 
          errors: paramsValidation.error.issues 
        });
      }

      // Validate request body
      const bodyValidation = assignCoordinatorSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: bodyValidation.error.issues 
        });
      }

      const { id } = paramsValidation.data;
      const { coordinatorId } = bodyValidation.data;

      const updatedRequest = await storage.assignRequestToCoordinator(id, coordinatorId);
      if (!updatedRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error('Failed to assign request to coordinator:', error.message);
      
      // Handle conflict errors specifically
      if (error.message.includes('Cannot reassign') || error.message.includes('Cannot assign')) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Failed to assign request to coordinator' });
    }
  });

  app.get('/api/coordinator/:coordinatorId/inspection-requests', authenticateCoordinator, authorizeCoordinatorResource, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate path parameters
      const paramsValidation = coordinatorParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid coordinator ID', 
          errors: paramsValidation.error.issues 
        });
      }

      const { coordinatorId } = paramsValidation.data;
      const requests = await storage.getInspectionRequestsForCoordinator(coordinatorId);
      res.json(requests);
    } catch (error: any) {
      console.error('Failed to get coordinator requests:', error.message);
      res.status(500).json({ message: 'Failed to get coordinator requests' });
    }
  });

  app.get('/api/departments/:departmentId/inspection-requests', authenticateCoordinator, authorizeCoordinatorResource, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate path parameters
      const paramsValidation = departmentParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid department ID', 
          errors: paramsValidation.error.issues 
        });
      }

      const { departmentId } = paramsValidation.data;
      const requests = await storage.getInspectionRequestsForDepartment(departmentId);
      res.json(requests);
    } catch (error: any) {
      console.error('Failed to get department requests:', error.message);
      res.status(500).json({ message: 'Failed to get department requests' });
    }
  });

  app.patch('/api/coordinator/inspection-requests/:id', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate path parameters
      const paramsValidation = inspectionRequestParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request ID', 
          errors: paramsValidation.error.issues 
        });
      }

      // Validate request body
      const bodyValidation = updateInspectionRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request body', 
          errors: bodyValidation.error.issues 
        });
      }

      const { id } = paramsValidation.data;
      const updates = bodyValidation.data;

      const updatedRequest = await storage.updateInspectionRequest(id, updates);
      if (!updatedRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error('Failed to update inspection request:', error.message);
      res.status(500).json({ message: 'Failed to update inspection request' });
    }
  });

  // TURN credentials endpoint for WebRTC with Twilio Network Traversal Service
  app.get('/api/turn-credentials', async (_req, res) => {
    try {
      // Check for required Twilio credentials
      const accountSid = process.env.TWILIO_ACCOUNT_SIDV;
      const authToken = process.env.TWILIO_AUTH_TOKENV;
      
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
  app.post('/api/calls', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Creating call with data:', JSON.stringify(req.body, null, 2));
      const callData = insertCallSchema.parse(req.body);
      console.log('Parsed call data:', JSON.stringify(callData, null, 2));
      
      // Verify the authenticated user has permission to create this call
      if (req.user?.role === 'coordinator' && callData.coordinatorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot create calls for other coordinators' });
      }
      if (req.user?.role === 'inspector' && callData.inspectorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot create calls for other inspectors' });
      }
      
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

  app.get('/api/calls/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      // Verify the authenticated user has permission to access this call
      if (req.user?.role === 'coordinator' && call.coordinatorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot access other coordinators\' calls' });
      }
      if (req.user?.role === 'inspector' && call.inspectorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot access other inspectors\' calls' });
      }
      
      res.json(call);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get call' });
    }
  });

  app.patch('/api/calls/:id/status', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = req.body;
      const endedAt = status === 'ended' ? new Date() : undefined;
      
      // First get the call to verify permissions
      const existingCall = await storage.getCall(req.params.id);
      if (!existingCall) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      // Verify the authenticated user has permission to update this call
      if (req.user?.role === 'coordinator' && existingCall.coordinatorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot update other coordinators\' calls' });
      }
      if (req.user?.role === 'inspector' && existingCall.inspectorId !== req.user.id) {
        return res.status(403).json({ message: 'Cannot update other inspectors\' calls' });
      }
      
      const call = await storage.updateCallStatus(req.params.id, status, endedAt);
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

  // Email API endpoints for inspector notifications
  app.post('/api/emails/inspector-assignment', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      const { 
        inspectorEmail, 
        inspectorName, 
        inspectionRequestId, 
        callId 
      } = req.body;

      // Validate required fields
      if (!inspectorEmail || !inspectorName || !inspectionRequestId || !callId) {
        return res.status(400).json({ 
          message: 'Missing required fields: inspectorEmail, inspectorName, inspectionRequestId, callId' 
        });
      }

      // Get inspection request details
      const inspectionRequest = await storage.getInspectionRequest(inspectionRequestId);
      if (!inspectionRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }

      // Get client details
      const client = await storage.getClient(inspectionRequest.clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Get coordinator details
      const coordinator = req.user!;

      // Generate call join URL (using secure base URL to prevent host header injection)
      const baseUrl = process.env.PUBLIC_BASE_URL || 'https://localhost:5000';
      const callJoinUrl = `${baseUrl}/inspector-call?callId=${callId}`;

      // Create email log entry first
      const emailLogData = {
        callId,
        inspectionRequestId,
        recipientType: 'inspector' as const,
        recipientEmail: inspectorEmail,
        senderEmail: process.env.FROM_EMAIL || 'noreply@inspections.com',
        emailType: 'assignment' as const,
        subject: `New Inspection Assignment - ${client.name} | ${inspectionRequest.title}`,
        status: 'pending' as const,
        emailProvider: 'nodemailer',
        metadata: {
          inspectorName,
          coordinatorId: coordinator.id,
          coordinatorName: coordinator.name
        }
      };

      const emailLog = await storage.createEmailLog(emailLogData);

      // Prepare email data
      const emailData = {
        inspector: {
          name: inspectorName,
          email: inspectorEmail
        },
        client,
        inspectionRequest,
        callId,
        callJoinUrl,
        coordinator
      };

      // Send email
      const emailResult = await emailService.sendInspectorAssignmentEmail(emailData);

      if (emailResult.success) {
        // Update email log with success
        await storage.updateEmailLogStatus(
          emailLog.id, 
          'sent', 
          new Date(), 
          undefined, 
          undefined
        );

        console.log(`✓ Inspector assignment email sent successfully to ${inspectorEmail}`);
        res.json({ 
          success: true, 
          message: 'Email sent successfully',
          emailLogId: emailLog.id,
          messageId: emailResult.messageId
        });
      } else {
        // Update email log with failure
        await storage.updateEmailLogStatus(
          emailLog.id, 
          'failed', 
          undefined, 
          undefined, 
          emailResult.error
        );

        console.error(`✗ Failed to send inspector assignment email: ${emailResult.error}`);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send email',
          error: emailResult.error,
          emailLogId: emailLog.id
        });
      }
    } catch (error: any) {
      console.error('Email assignment endpoint error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: error.message 
      });
    }
  });

  // Get email logs for a call
  app.get('/api/calls/:callId/emails', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { callId } = req.params;
      
      // Verify user has access to this call
      const call = await storage.getCall(callId);
      if (!call) {
        return res.status(404).json({ message: 'Call not found' });
      }

      // Check user permissions
      const user = req.user!;
      if (user.role === 'coordinator' && call.coordinatorId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (user.role === 'inspector' && call.inspectorId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const emailLogs = await storage.getEmailLogsForCall(callId);
      res.json(emailLogs);
    } catch (error: any) {
      console.error('Email logs retrieval error:', error);
      res.status(500).json({ 
        message: 'Failed to retrieve email logs',
        error: error.message 
      });
    }
  });

  // Get email logs for an inspection request
  app.get('/api/inspection-requests/:requestId/emails', authenticateCoordinator, async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId } = req.params;
      
      // Verify inspection request exists
      const inspectionRequest = await storage.getInspectionRequest(requestId);
      if (!inspectionRequest) {
        return res.status(404).json({ message: 'Inspection request not found' });
      }

      const emailLogs = await storage.getEmailLogsForInspectionRequest(requestId);
      res.json(emailLogs);
    } catch (error: any) {
      console.error('Email logs retrieval error:', error);
      res.status(500).json({ 
        message: 'Failed to retrieve email logs',
        error: error.message 
      });
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
