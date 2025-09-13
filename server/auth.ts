import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// JWT secret key - in production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-replace-in-production';
const JWT_EXPIRES_IN = '24h';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'client';
  };
}

export interface JWTPayload {
  clientId: string;
  email: string;
  name: string;
  role: 'client';
  iat?: number;
  exp?: number;
}

// Generate JWT token for authenticated client
export function generateToken(client: { id: string; email: string; name: string }): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    clientId: client.id,
    email: client.email,
    name: client.name,
    role: 'client',
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware to verify JWT token and authenticate requests
export function authenticateClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token provided' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Attach user information to request object
    req.user = {
      id: decoded.clientId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Authentication token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    } else {
      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
}

// Optional middleware for routes that can work with or without authentication
export function optionalAuthentication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without authentication
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      id: decoded.clientId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch (error: any) {
    // Ignore authentication errors for optional auth
    console.warn('Optional authentication failed:', error.message);
  }
  
  next();
}

// Middleware to ensure the authenticated client can only access their own resources
export function authorizeClientResource(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // For routes with :clientId parameter, ensure it matches the authenticated user
  const clientIdFromParams = req.params.clientId;
  if (clientIdFromParams && clientIdFromParams !== req.user.id) {
    return res.status(403).json({ message: 'Access denied: Cannot access other clients\' resources' });
  }
  
  next();
}