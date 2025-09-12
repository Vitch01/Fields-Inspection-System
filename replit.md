# Overview

This is a real-time video calling application built for remote site inspections. The application enables coordinators to create video calls with inspectors for conducting site surveys and quality assessments. During calls, users can capture and share images for documentation purposes. The system uses React with TypeScript for the frontend, Express.js for the backend, and WebRTC for real-time video communication.

**Recent Updates (Sep 2025):**
- Added inspector thank you page with company branding displayed after call completion
- Enhanced home page with dual interface: coordinator call creation and inspector call joining
- Improved camera permission cleanup to fully revoke access when inspectors end calls
- Removed time display from inspector interface per user preference

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client application is built with React 18 and TypeScript, using Vite as the build tool. The UI framework is shadcn/ui with Tailwind CSS for styling. The application follows a component-based architecture with:

- **Routing**: Uses wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state management and React hooks for local state
- **WebRTC Implementation**: Custom hooks (useWebRTC, useWebSocket) handle real-time communication
- **Component Structure**: Modular UI components organized under `/components/ui` with feature-specific components in `/components/video-call`

## Backend Architecture
The server is built with Express.js and TypeScript, providing both REST API endpoints and WebSocket connections:

- **RESTful API**: Standard HTTP endpoints for user management, call creation, and image handling
- **WebSocket Server**: Real-time signaling for WebRTC peer connections
- **File Upload**: Multer middleware for handling image captures with 10MB file size limits
- **Session Management**: Express sessions with PostgreSQL session store

## Database Design
Uses Drizzle ORM with PostgreSQL for data persistence:

- **Users Table**: Stores user credentials with role-based access (coordinator/inspector)
- **Calls Table**: Tracks video call sessions with status management and metadata
- **Captured Images Table**: Stores inspection images with file references and thumbnails

## Real-Time Communication
WebRTC implementation for peer-to-peer video calling:

- **Signaling Server**: WebSocket-based signaling for connection establishment
- **STUN Servers**: Google STUN servers for NAT traversal
- **Media Constraints**: Configurable video quality (720p default) with audio enhancement features

## Authentication & Authorization
Role-based access control with two user types:

- **Coordinators**: Can create calls and manage inspections
- **Inspectors**: Join calls and capture images during inspections
- **Session Management**: Server-side sessions with PostgreSQL storage

## File Management
Image capture and storage system:

- **Upload Handling**: Local file system storage with organized directory structure
- **Image Processing**: Original and thumbnail generation for captured inspection images
- **File Validation**: Size limits and type checking for uploaded content

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend UI library with hooks-based architecture
- **Express.js**: Node.js web server framework
- **TypeScript**: Type-safe JavaScript for both client and server

## UI and Styling
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components for accessibility

## Database and ORM
- **Neon Database**: Serverless PostgreSQL database
- **Drizzle ORM**: Type-safe database toolkit
- **connect-pg-simple**: PostgreSQL session store for Express

## Real-Time Communication
- **WebSocket (ws)**: Server-side WebSocket implementation
- **WebRTC**: Browser native peer-to-peer communication APIs
- **TanStack Query**: Server state management and caching

## Development Tools
- **Vite**: Fast build tool and development server
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer

## File Handling
- **Multer**: Multipart form data handling for file uploads
- **date-fns**: Date manipulation and formatting utilities

## Additional Libraries
- **wouter**: Lightweight client-side routing
- **class-variance-authority**: Utility for conditional CSS classes
- **clsx**: Conditional className utility
- **nanoid**: URL-safe unique ID generator
- **cmdk**: Command palette component