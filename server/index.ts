import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session management with PostgreSQL store
const PgSession = ConnectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Add user to request type for TypeScript
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: string;
  }
}

// Authentication middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Rate limiting store for TURN credentials
const turnRequestTracker = new Map<string, { count: number; lastReset: number }>();
const TURN_RATE_LIMIT = 10; // Max 10 requests per hour per user
const TURN_RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

export const rateLimitTurnRequests = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const now = Date.now();
  const userTracker = turnRequestTracker.get(userId) || { count: 0, lastReset: now };

  // Reset counter if window has passed
  if (now - userTracker.lastReset > TURN_RATE_WINDOW) {
    userTracker.count = 0;
    userTracker.lastReset = now;
  }

  // Check rate limit
  if (userTracker.count >= TURN_RATE_LIMIT) {
    return res.status(429).json({ 
      message: 'Rate limit exceeded. Too many TURN credential requests.',
      retryAfter: Math.ceil((TURN_RATE_WINDOW - (now - userTracker.lastReset)) / 1000)
    });
  }

  // Increment counter
  userTracker.count++;
  turnRequestTracker.set(userId, userTracker);
  
  next();
};

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Log API requests but skip frequent health check requests to reduce noise
    if (path.startsWith("/api") && !(req.method === "HEAD" && path === "/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app, { requireAuth, requireRole, rateLimitTurnRequests });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Only send response if it hasn't been sent yet
    if (!res.headersSent) {
      res.status(status).json({ message });
    }

    // Log the error for debugging but don't throw it (prevents crashes)
    console.error('Server error:', {
      message: err.message,
      status,
      stack: err.stack
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})().catch(error => {
  console.error('Unhandled error during server startup:', error);
  process.exit(1);
});
