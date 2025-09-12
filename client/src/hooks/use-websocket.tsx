import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (error: ConnectionError, message: string) => void;
  autoJoin?: boolean; // Whether to automatically send join-call on connect
  maxRetries?: number; // Maximum reconnection attempts (default: 10)
  baseRetryDelay?: number; // Base delay in ms for exponential backoff (default: 1000)
}

interface JoinState {
  callId: string;
  userId: string;
  additionalData?: any;
}

export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'failed' 
  | 'maximum-retries-exceeded';

export type ConnectionError = 
  | 'network-error'
  | 'server-unavailable' 
  | 'timeout'
  | 'permission-denied'
  | 'unknown';

interface ConnectionStats {
  attempts: number;
  consecutiveFailures: number;
  lastConnected?: Date;
  lastError?: {
    type: ConnectionError;
    message: string;
    timestamp: Date;
  };
}

const WEBSOCKET_CLOSE_CODES = {
  NORMAL_CLOSURE: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS_RECEIVED: 1005,
  ABNORMAL_CLOSURE: 1006,
  INVALID_FRAME_PAYLOAD_DATA: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MANDATORY_EXTENSION: 1010,
  INTERNAL_SERVER_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  BAD_GATEWAY: 1014,
  TLS_HANDSHAKE: 1015
} as const;

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const { 
    autoJoin = false, 
    maxRetries = 10, 
    baseRetryDelay = 1000
  } = options;
  
  // Connection state management
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    attempts: 0,
    consecutiveFailures: 0
  });
  const [pendingJoinMessage, setPendingJoinMessage] = useState<any>(null);
  const [joinedState, setJoinedState] = useState<JoinState | null>(null);
  
  // Refs for managing connection lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const isManualDisconnectRef = useRef(false);
  const currentUrlIndexRef = useRef(0);
  
  // Derived state for backward compatibility
  const isConnected = connectionState === 'connected';

  // Utility functions for connection management
  const updateConnectionState = useCallback((newState: ConnectionState) => {
    setConnectionState(newState);
    options.onConnectionStateChange?.(newState);
  }, [options]);

  const classifyError = useCallback((error: any, closeCode?: number): ConnectionError => {
    if (closeCode) {
      switch (closeCode) {
        case WEBSOCKET_CLOSE_CODES.POLICY_VIOLATION:
        case WEBSOCKET_CLOSE_CODES.UNSUPPORTED_DATA:
          return 'permission-denied';
        case WEBSOCKET_CLOSE_CODES.INTERNAL_SERVER_ERROR:
        case WEBSOCKET_CLOSE_CODES.SERVICE_RESTART:
        case WEBSOCKET_CLOSE_CODES.BAD_GATEWAY:
          return 'server-unavailable';
        case WEBSOCKET_CLOSE_CODES.ABNORMAL_CLOSURE:
        case WEBSOCKET_CLOSE_CODES.NO_STATUS_RECEIVED:
          return 'network-error';
        default:
          return 'unknown';
      }
    }
    
    // Check error message for more clues
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('network') || errorMessage.includes('connection refused')) {
      return 'network-error';
    }
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return 'permission-denied';
    }
    
    return 'unknown';
  }, []);

  const calculateRetryDelay = useCallback((attempt: number): number => {
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
    const baseDelay = isMobile ? baseRetryDelay * 1.5 : baseRetryDelay; // Longer base delay for mobile
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 30000); // Cap at 30 seconds
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add 30% jitter
    return exponentialDelay + jitter;
  }, [baseRetryDelay]);

  const getWebSocketURLs = useCallback((): string[] => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryUrl = `${protocol}//${window.location.host}/ws`;
    
    // Add fallback URLs (same host, different paths)
    const fallbackUrls = [
      `${protocol}//${window.location.host}/websocket`,
      `${protocol}//${window.location.host}/socket`
    ];
    
    return [primaryUrl, ...fallbackUrls];
  }, []);

  const handleConnectionError = useCallback((errorType: ConnectionError, message: string) => {
    console.error(`[WebSocket] Connection error: ${errorType} - ${message}`);
    
    // Update connection stats
    setConnectionStats(prev => ({
      ...prev,
      consecutiveFailures: prev.consecutiveFailures + 1,
      lastError: {
        type: errorType,
        message,
        timestamp: new Date()
      }
    }));
    
    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    
    // Notify error callback
    options.onError?.(errorType, message);
    
    // Determine if we should retry
    const shouldRetry = !isManualDisconnectRef.current && 
                       connectionStats.consecutiveFailures < maxRetries;
    
    if (shouldRetry) {
      // Try next URL if available
      const urls = getWebSocketURLs();
      const nextUrlIndex = (currentUrlIndexRef.current + 1) % urls.length;
      
      if (nextUrlIndex === 0 && connectionStats.consecutiveFailures > 0) {
        // We've tried all URLs, use exponential backoff
        const retryDelay = calculateRetryDelay(connectionStats.consecutiveFailures);
        console.log(`[WebSocket] Retrying in ${Math.round(retryDelay / 1000)}s (attempt ${connectionStats.consecutiveFailures + 1}/${maxRetries})`);
        
        updateConnectionState('reconnecting');
        reconnectTimeoutRef.current = setTimeout(() => {
          currentUrlIndexRef.current = 0;
          connectWithUrl(urls[0], 0);
        }, retryDelay);
      } else {
        // Try next URL immediately
        console.log(`[WebSocket] Trying fallback URL (${nextUrlIndex + 1}/${urls.length})`);
        currentUrlIndexRef.current = nextUrlIndex;
        connectWithUrl(urls[nextUrlIndex], nextUrlIndex);
      }
    } else {
      console.error(`[WebSocket] Maximum retries exceeded (${maxRetries}). Giving up.`);
      updateConnectionState('maximum-retries-exceeded');
    }
  }, [connectionStats, maxRetries, options, calculateRetryDelay, getWebSocketURLs, updateConnectionState, isManualDisconnectRef]);

  const connectWithUrl = useCallback((wsUrl: string, urlIndex: number = 0) => {
    const attempt = connectionStats.attempts + 1;
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
    
    // Update connection state and stats
    updateConnectionState(attempt === 1 ? 'connecting' : 'reconnecting');
    setConnectionStats(prev => ({
      ...prev,
      attempts: attempt
    }));
    
    // Enhanced logging for debugging
    console.log("[WebSocket] Connection attempt:", {
      attempt,
      urlIndex,
      protocol: window.location.protocol,
      url: wsUrl,
      userAgent: navigator.userAgent,
      isMobile,
      consecutiveFailures: connectionStats.consecutiveFailures,
      timestamp: new Date().toISOString()
    });
    
    // Set connection timeout
    const connectionTimeout = isMobile ? 15000 : 10000; // Longer timeout for mobile
    connectionTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        console.log("[WebSocket] Connection timeout reached");
        wsRef.current.close();
        handleConnectionError('timeout', 'Connection timed out');
      }
    }, connectionTimeout);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected successfully on attempt", attempt);
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = undefined;
        }
        
        // Update connection state and stats
        updateConnectionState('connected');
        setConnectionStats(prev => ({
          ...prev,
          consecutiveFailures: 0,
          lastConnected: new Date()
        }));
        
        options.onConnect?.();

        // Send buffered join message if exists
        if (pendingJoinMessage) {
          console.log("[WebSocket] Sending buffered join message:", pendingJoinMessage);
          ws.send(JSON.stringify(pendingJoinMessage));
          setPendingJoinMessage(null);
        }
        
        // Re-join if we were previously joined (after reconnection)
        else if (joinedState && !autoJoin) {
          console.log("[WebSocket] Re-joining call after reconnection:", joinedState);
          const rejoinMessage = {
            type: "join-call",
            callId: joinedState.callId,
            userId: joinedState.userId,
            ...joinedState.additionalData
          };
          console.log("[WebSocket] Sending rejoin message:", rejoinMessage);
          ws.send(JSON.stringify(rejoinMessage));
        }
        
        // Only auto-join if explicitly requested
        else if (autoJoin) {
          const autoJoinMessage = {
            type: "join-call",
            callId,
            userId: userRole,
            role: userRole  // Add role field for proper signaling
          };
          ws.send(JSON.stringify(autoJoinMessage));
          setJoinedState({ callId, userId: userRole });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[WebSocket] Message received:", message.type, message);
          options.onMessage?.(message);
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error, "Raw data:", event.data);
        }
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected. Code:", event.code, "Reason:", event.reason || "No reason provided");
        updateConnectionState('disconnected');
        options.onDisconnect?.();
        
        // Don't reconnect if it was a manual disconnect
        if (!isManualDisconnectRef.current) {
          const errorType = classifyError(null, event.code);
          const errorMessage = `Connection closed with code ${event.code}: ${event.reason || 'No reason provided'}`;
          handleConnectionError(errorType, errorMessage);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error occurred:", {
          error,
          readyState: ws.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState],
          url: wsUrl,
          protocol: window.location.protocol,
          isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent),
          timestamp: new Date().toISOString()
        });
        
        const errorType = classifyError(error);
        const errorMessage = `WebSocket error occurred: ${error}`;
        handleConnectionError(errorType, errorMessage);
      };

    } catch (error) {
      console.error("[WebSocket] Failed to establish connection:", {
        error,
        protocol: window.location.protocol,
        host: window.location.host,
        isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent)
      });
      
      const errorType = classifyError(error);
      const errorMessage = `Failed to create WebSocket: ${error}`;
      handleConnectionError(errorType, errorMessage);
    }
  }, [connectionStats, updateConnectionState, options, handleConnectionError, pendingJoinMessage, joinedState, autoJoin, callId, userRole, classifyError]);

  const connect = useCallback(() => {
    // Reset manual disconnect flag
    isManualDisconnectRef.current = false;
    
    // Get WebSocket URLs and start with the first one
    const urls = getWebSocketURLs();
    currentUrlIndexRef.current = 0;
    connectWithUrl(urls[0], 0);
  }, [getWebSocketURLs, connectWithUrl]);

  const disconnect = useCallback(() => {
    console.log("[WebSocket] Manual disconnect requested");
    
    // Set manual disconnect flag
    isManualDisconnectRef.current = true;
    
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(WEBSOCKET_CLOSE_CODES.NORMAL_CLOSURE, "Manual disconnect");
      wsRef.current = null;
    }
    
    updateConnectionState('disconnected');
  }, [updateConnectionState]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Sending message:", message.type, message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Not connected, cannot send message. State:", wsRef.current?.readyState, "Message:", message);
    }
  }, []);

  const joinCall = useCallback((additionalData: any = {}) => {
    const message = {
      type: "join-call",
      callId,
      userId: userRole,
      ...additionalData
    };
    
    console.log("[WebSocket] joinCall requested with:", {
      callId,
      userRole,
      additionalData,
      wsConnected: wsRef.current?.readyState === WebSocket.OPEN
    });
    
    // Store join state for re-joining on reconnection
    setJoinedState({
      callId,
      userId: userRole,
      additionalData
    });
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Sending join message immediately:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.log("[WebSocket] Buffering join message until connected. WS state:", wsRef.current?.readyState);
      setPendingJoinMessage(message);
    }
  }, [callId, userRole]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [callId, connect, disconnect]);

  return {
    isConnected,
    connectionState,
    connectionStats,
    sendMessage,
    disconnect,
    joinCall,
  };
}