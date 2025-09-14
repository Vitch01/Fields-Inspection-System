# Start Call Implementation Guide

## Overview
This document outlines where and how the video call start functionality is implemented across the field inspection video call system codebase.

## 📍 Implementation Locations

### 1. Initial Call Creation
**File:** `client/src/pages/home.tsx` (lines 57-83)

**Function:** `handleStartCall`
```typescript
const handleStartCall = async () => {    
  setIsLoading(true);
  try {
    const response = await apiRequest("POST", "/api/calls", {
      coordinatorId: user.id,
      inspectorId: inspectorId || "9c870768-492e-4282-bd32-c83377774b63", // John Martinez inspector
      status: "pending",
      inspectionReference,
    });
    const call = await response.json();
    
    toast({
      title: "Call created",
      description: "Starting video call...",
    });
    
    setLocation(`/coordinator/${call.id}`);
  } catch (error) {
    toast({
      title: "Failed to start call",
      description: "Please try again",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};
```

**Purpose:** 
- Creates the call record in the database
- Navigates to coordinator page
- Makes API call to `/api/calls` endpoint

### 2. Backend Call Creation API
**File:** `server/routes.ts` (lines 409-423)

**Endpoint:** `POST /api/calls`
```typescript
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
```

**Purpose:**
- Validates call data using Zod schema
- Stores call record in database via storage layer
- Returns created call object

### 3. WebRTC Call Initiation
**File:** `client/src/hooks/use-webrtc.tsx`

**Key Functions:**

#### Initialize Peer Connection (lines 185+)
```typescript
async function initializePeerConnection() {
  const pc = await createPeerConnection();
  peerConnectionRef.current = pc;

  // Add local stream tracks
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });
  }

  // Handle remote stream
  pc.ontrack = (event) => {
    setRemoteStream(event.streams[0]);
  };

  // Handle connection state changes with better diagnostics
  pc.onconnectionstatechange = () => {
    console.log(`Connection state changed to: ${pc.connectionState}`);
    const connected = pc.connectionState === "connected";
    setIsConnected(connected);
    if (connected) {
      setIsConnectionEstablished(true);
    }
  };
}
```

#### Create Offer (lines 318-337)
```typescript
async function createOffer() {
  if (!peerConnectionRef.current || !wsRef.current) return;

  try {
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    
    sendMessage({
      type: "offer",
      data: offer,
      callId,
      userId
    });
  } catch (error) {
    console.error("Failed to create offer:", error);
  }
}
```

**Purpose:**
- Sets up RTCPeerConnection object
- Handles local and remote media streams
- Creates SDP offer for coordinator to initiate call
- Manages WebSocket signaling

### 4. Coordinator Call Page
**File:** `client/src/pages/coordinator-call.tsx`

**Key Components:**
- Main coordinator interface
- Video display management
- Call controls integration
- Field map integration

**Features:**
- Connection status indicator
- Call duration display
- Inspector information display
- Field map button
- Inspector link generation
- Signal quality indicator

### 5. Inspector Call Join
**File:** `client/src/pages/inspector-call.tsx` (lines 111-155)

**Function:** `handleJoinCall`
```typescript
const handleJoinCall = async () => {
  if (!inspectorName.trim()) return;
  
  try {
    // Get location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setInspectorLocation(location);
        },
        (error) => {
          console.warn('Location access denied:', error);
          // Continue without location
        }
      );
    }
    
    setHasJoined(true);
  } catch (error) {
    console.error('Failed to join call:', error);
  }
};
```

**Purpose:**
- Inspector entry point to join established call
- Captures inspector location
- Handles name input and validation
- Initiates inspector-side connection

## 🔄 Complete Call Flow

### Step 1: Call Creation
1. User fills out form on home page
2. `handleStartCall` executes
3. POST request to `/api/calls`
4. Database record created
5. Redirect to coordinator page

### Step 2: Coordinator Setup
1. Coordinator page loads (`coordinator-call.tsx`)
2. `useWebRTC` hook initializes
3. Local media stream captured
4. Peer connection established
5. SDP offer created and sent

### Step 3: Inspector Join
1. Inspector accesses call link
2. Name and location captured
3. `handleJoinCall` executes
4. Inspector joins WebRTC connection
5. Media streams exchanged

### Step 4: Active Call
1. Bidirectional video/audio established
2. Real-time communication active
3. Image capture functionality available
4. Call controls and monitoring active

## 🛠 Technical Stack

**Frontend:**
- React with TypeScript
- WebRTC for peer-to-peer communication
- WebSocket for signaling
- wouter for routing
- shadcn/ui for components

**Backend:**
- Express.js with TypeScript
- WebSocket server for signaling
- PostgreSQL with Drizzle ORM
- Session management

**Real-time Communication:**
- WebRTC RTCPeerConnection
- STUN/TURN servers via Twilio
- WebSocket signaling server
- Media constraints for optimal quality

## 🔧 Key Files Summary

| File | Purpose | Key Functions |
|------|---------|---------------|
| `home.tsx` | Call initiation UI | `handleStartCall` |
| `server/routes.ts` | API endpoints | `POST /api/calls` |
| `use-webrtc.tsx` | WebRTC management | `initializePeerConnection`, `createOffer` |
| `coordinator-call.tsx` | Coordinator interface | Call orchestration |
| `inspector-call.tsx` | Inspector interface | `handleJoinCall` |

## 📝 Database Schema

**Calls Table Structure:**
- `id`: Unique call identifier
- `coordinatorId`: User ID of coordinator
- `inspectorId`: User ID of inspector
- `status`: Call status (pending, active, completed)
- `inspectionReference`: Reference identifier
- `createdAt`: Timestamp
- `completedAt`: Completion timestamp

This comprehensive guide covers all aspects of the start call implementation across the video calling system.