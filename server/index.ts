import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    console.log('Initializing routes and server...');
    const server = await registerRoutes(app);

    // Validate that registerRoutes returned a proper server instance
    if (!server || typeof server.listen !== 'function') {
      throw new Error('registerRoutes failed to return a valid HTTP server instance');
    }

    console.log('Routes registered successfully');

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

  // Determine environment mode safely without mutating NODE_ENV
  // If NODE_ENV is not set, fall back to Express default behavior, otherwise respect the explicit value
  const isDev = process.env.NODE_ENV ? process.env.NODE_ENV === 'development' : app.get('env') === 'development';
  const envMode = isDev ? 'development' : 'production';

  console.log(`Starting server in ${envMode} mode`);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (isDev) {
    console.log('Setting up Vite development server...');
    await setupVite(app, server);
    console.log('Vite development server configured');
  } else {
    console.log('Setting up static file serving for production...');
    try {
      serveStatic(app);
      console.log('Static file serving configured for production');
    } catch (staticError) {
      console.error('Failed to setup static file serving:', staticError);
      throw new Error(`Production static file setup failed: ${staticError}`);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = "0.0.0.0";

    // Validate port number
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${process.env.PORT}. Port must be between 1 and 65535.`);
    }

    console.log(`Attempting to start server on ${host}:${port}`);

    server.listen({
      port,
      host,
    }, () => {
      console.log(`✅ Server successfully started on ${host}:${port}`);
      console.log(`🌍 Application ready for connections`);
      log(`serving on port ${port}`);
    });

    // Add error handling for server listen failures
    server.on('error', (serverError) => {
      console.error('❌ Server failed to start:', serverError);
      if ((serverError as any).code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please use a different port or free up port ${port}.`);
      } else if ((serverError as any).code === 'EACCES') {
        console.error(`Permission denied to bind to port ${port}. Try using a port number above 1024.`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})().catch(error => {
  console.error('Unhandled error during server startup:', error);
  process.exit(1);
});
