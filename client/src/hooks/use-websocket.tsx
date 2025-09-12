import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onAuthError?: () => void;
  onNetworkChange?: () => void;
}

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = useRef(10);
  const baseRetryDelay = useRef(1000);
  const networkChangeTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false);
  const lastNetworkStateRef = useRef(navigator.onLine);

  // Network change detection effect
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online detected');
      setIsNetworkOnline(true);
      setLastConnectionError(null);
      
      // Clear any existing timeout to prevent duplicate connections
      if (networkChangeTimeoutRef.current) {
        clearTimeout(networkChangeTimeoutRef.current);
      }
      
      // If we were offline and now online, attempt immediate reconnection
      if (!lastNetworkStateRef.current && !isConnected) {
        console.log('Network recovered, attempting immediate reconnection');
        options.onNetworkChange?.();
        
        // Give network a moment to stabilize before reconnecting
        networkChangeTimeoutRef.current = setTimeout(() => {
          if (!isConnected && !isReconnectingRef.current) {
            setConnectionAttempts(0); // Reset attempts on network recovery
            connect();
          }
        }, 1500);
      }
      
      lastNetworkStateRef.current = true;
    };
    
    const handleOffline = () => {
      console.log('Network offline detected');
      setIsNetworkOnline(false);
      setLastConnectionError('Network offline');
      lastNetworkStateRef.current = false;
      
      // Don't immediately disconnect WebSocket - let it try to reconnect
      // when network comes back online
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkChangeTimeoutRef.current) {
        clearTimeout(networkChangeTimeoutRef.current);
      }
    };
  }, [isConnected, options]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [callId]);

  const calculateRetryDelay = useCallback((attemptNumber: number) => {
    // Exponential backoff with jitter and max cap
    const exponentialDelay = baseRetryDelay.current * Math.pow(2, Math.min(attemptNumber, 6));
    const jitter = Math.random() * 1000;
    const maxDelay = 30000; // Cap at 30 seconds
    return Math.min(exponentialDelay + jitter, maxDelay);
  }, []);

  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 401) {
        console.warn('Session expired during WebSocket reconnection');
        setLastConnectionError('Authentication required');
        options.onAuthError?.();
        return false;
      }
      
      if (!response.ok) {
        console.warn('Session validation failed:', response.status);
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Session validation error (network issue):', error);
      // Don't treat network errors as auth failures
      return !isNetworkOnline ? false : true; // If offline, don't validate
    }
  }, [isNetworkOnline, options]);

  const connect = useCallback(async () => {
    if (isReconnectingRef.current) {
      console.log('Connection already in progress, skipping duplicate attempt');
      return;
    }
    
    // If we're offline, don't attempt connection
    if (!isNetworkOnline) {
      console.log('Network offline, skipping connection attempt');
      setLastConnectionError('Network offline');
      return;
    }
    
    isReconnectingRef.current = true;
    
    try {
      // Validate session before attempting WebSocket connection
      // Skip validation on first connection attempt
      if (connectionAttempts > 0) {
        console.log('Validating session before WebSocket reconnection...');
        const isSessionValid = await validateSession();
        if (!isSessionValid) {
          isReconnectingRef.current = false;
          return;
        }
      }
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Attempting WebSocket connection (attempt ${connectionAttempts + 1}/${maxReconnectAttempts.current})`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected successfully");
        setIsConnected(true);
        setConnectionAttempts(0); // Reset on successful connection
        setLastConnectionError(null);
        isReconnectingRef.current = false;
        options.onConnect?.();

        // Join the call room
        sendMessage({
          type: "join-call",
          callId,
          userId: userRole,
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          options.onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(`WebSocket disconnected - code: ${event.code}, reason: ${event.reason}`);
        setIsConnected(false);
        isReconnectingRef.current = false;
        options.onDisconnect?.();
        
        // Check if this was due to authentication issues
        if (event.code === 1008 || event.code === 1011) {
          setLastConnectionError('Authentication error');
          options.onAuthError?.();
          return;
        }
        
        // Don't reconnect if we've hit max attempts
        if (connectionAttempts >= maxReconnectAttempts.current) {
          console.error('Max WebSocket reconnection attempts reached');
          setLastConnectionError('Max reconnection attempts reached');
          return;
        }
        
        // Don't reconnect if network is offline
        if (!isNetworkOnline) {
          console.log('Network offline, will reconnect when online');
          setLastConnectionError('Network offline');
          return;
        }
        
        // Schedule reconnection with exponential backoff
        const nextAttempt = connectionAttempts + 1;
        const retryDelay = calculateRetryDelay(nextAttempt);
        
        console.log(`Scheduling WebSocket reconnection in ${retryDelay}ms (attempt ${nextAttempt}/${maxReconnectAttempts.current})`);
        setConnectionAttempts(nextAttempt);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, retryDelay);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setLastConnectionError('Connection error');
        isReconnectingRef.current = false;
      };

    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      setLastConnectionError(error instanceof Error ? error.message : 'Connection failed');
      isReconnectingRef.current = false;
    }
  }, [callId, userRole, connectionAttempts, isNetworkOnline, options, calculateRetryDelay, validateSession]);

  function disconnect() {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }

  function sendMessage(message: any) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message:", message);
    }
  }

  // Force reconnect function for external use
  const forceReconnect = useCallback(() => {
    console.log('Force reconnect requested');
    setConnectionAttempts(0);
    setLastConnectionError(null);
    disconnect();
    setTimeout(() => connect(), 1000);
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
    forceReconnect,
    connectionAttempts,
    lastConnectionError,
    isNetworkOnline,
  };
}
