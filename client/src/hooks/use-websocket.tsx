import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string, details?: any) => void;
  onFallback?: (reason: string) => void;
}

interface ConnectionState {
  isConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  lastError?: string;
  reconnectAttempts: number;
  isFallbackActive: boolean;
}

// Mobile detection utility
function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent) ||
         (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 2);
}

// Network quality detection
function getConnectionType(): string {
  // @ts-ignore - navigator.connection is experimental
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return connection?.effectiveType || 'unknown';
}

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    connectionQuality: 'disconnected',
    reconnectAttempts: 0,
    isFallbackActive: false
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<any[]>([]);
  const fallbackPollIntervalRef = useRef<NodeJS.Timeout>();
  const isManualDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  
  // Mobile-specific configuration
  const isMobile = isMobileDevice();
  const connectionType = getConnectionType();
  
  // Configuration constants
  const CONNECTION_TIMEOUT = isMobile ? 15000 : 10000; // Longer timeout for mobile
  const PING_INTERVAL = isMobile ? 25000 : 30000; // More frequent pings on mobile
  const HEARTBEAT_TIMEOUT = 35000;
  const MAX_RECONNECT_ATTEMPTS = isMobile ? 8 : 5;
  const BASE_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  useEffect(() => {
    // Add jittered delay to prevent simultaneous connections from multiple tabs/devices
    const jitteredDelay = 200 + Math.random() * 300; // 200-500ms
    const connectTimer = setTimeout(() => {
      connect();
    }, jitteredDelay);
    
    // Add page visibility handling for fast reconnect
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !connectionState.isConnected && !isManualDisconnectRef.current) {
        console.log('🔄 Page became visible, attempting fast reconnect');
        connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityHandlerRef.current = handleVisibilityChange;
    
    return () => {
      clearTimeout(connectTimer);
      cleanup();
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };
  }, [callId]);

  function cleanup(isExplicitDisconnect = false) {
    // Only mark as manual disconnect if explicitly requested (e.g., "end call" button)
    if (isExplicitDisconnect) {
      isManualDisconnectRef.current = true;
    }
    
    isConnectingRef.current = false;
    
    // Clear all timeouts
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    if (fallbackPollIntervalRef.current) clearInterval(fallbackPollIntervalRef.current);
    
    // Close WebSocket
    if (wsRef.current) {
      const closeReason = isExplicitDisconnect ? 'Client disconnect' : 'Component cleanup';
      wsRef.current.close(1000, closeReason);
      wsRef.current = null;
    }
    
    setConnectionState(prev => ({ ...prev, isConnected: false, connectionQuality: 'disconnected' }));
  }

  function getWebSocketUrl(): string {
    // Use secure WebSocket only when page is served over HTTPS
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    // Comprehensive URL construction with debugging
    const currentHost = window.location.host;
    const currentHostname = window.location.hostname;
    const currentPort = window.location.port;
    
    console.log(`🔍 URL Components: protocol=${window.location.protocol}, host='${currentHost}', hostname='${currentHostname}', port='${currentPort}'`);
    
    let host: string;
    
    if (currentHost && !currentHost.includes('undefined')) {
      // Use the full host if it's valid and doesn't contain 'undefined'
      host = currentHost;
    } else {
      // Construct host manually with proper port handling
      const hostname = currentHostname || 'localhost';
      const port = currentPort && currentPort !== '' ? currentPort : '5000';
      host = `${hostname}:${port}`;
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    console.log(`🔌 WebSocket URL: ${wsUrl} (mobile: ${isMobile}, constructed host: '${host}')`);
    
    return wsUrl;
  }

  function calculateReconnectDelay(attempt: number): number {
    // Exponential backoff with jitter for mobile networks
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    const jitter = Math.random() * 1000; // Add randomness to avoid thundering herd
    return delay + jitter;
  }

  function startHeartbeat() {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        
        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('Heartbeat timeout - connection may be stale');
          handleConnectionQualityChange('poor');
          // Don't force disconnect, just mark as poor quality
        }, HEARTBEAT_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  function handleConnectionQualityChange(quality: ConnectionState['connectionQuality']) {
    setConnectionState(prev => ({ ...prev, connectionQuality: quality }));
    
    if (quality === 'poor') {
      console.warn('Poor connection quality detected');
      options.onError?.('Poor connection quality detected', { 
        quality, 
        isMobile, 
        connectionType 
      });
    }
  }

  const connect = useCallback(async () => {
    if (isManualDisconnectRef.current) {
      console.log('🚫 Skipping connection attempt - manual disconnect active');
      return;
    }
    
    // Prevent overlapping connection attempts
    if (isConnectingRef.current) {
      console.log('🚫 Skipping connection attempt - already connecting');
      return;
    }
    
    // Don't create new connection if current one is OPEN or CONNECTING
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log(`🚫 Skipping connection attempt - existing connection state: ${wsRef.current.readyState}`);
      return;
    }
    
    isConnectingRef.current = true;
    
    try {
      // Clear existing connection timeout
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      
      const wsUrl = getWebSocketUrl();
      console.log(`Attempting WebSocket connection (mobile: ${isMobile}, attempt: ${connectionState.reconnectAttempts + 1})`);
      
      console.log(`🚀 Creating WebSocket connection to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      console.log(`📡 WebSocket created, readyState: ${ws.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`);
      
      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('WebSocket connection timeout');
          ws.close();
          handleConnectionFailure('Connection timeout');
        }
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully!');
        console.log(`📡 Connection details: readyState=${ws.readyState}, url=${ws.url}`);
        
        isConnectingRef.current = false;
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          connectionQuality: 'excellent',
          reconnectAttempts: 0,
          lastError: undefined,
          isFallbackActive: false
        }));
        
        lastPongRef.current = Date.now();
        options.onConnect?.();
        
        // Start heartbeat for connection quality monitoring
        startHeartbeat();
        
        // Send join message
        const joinMessage = {
          type: "join-call",
          callId,
          userId: userRole,
        };
        console.log(`🔗 ${userRole}: Sending join-call message for call ${callId}:`, joinMessage);
        sendMessage(joinMessage);
        
        // Send any queued messages
        flushMessageQueue();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle heartbeat responses
          if (message.type === 'pong') {
            lastPongRef.current = Date.now();
            if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
            handleConnectionQualityChange('excellent');
            return;
          }
          
          options.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          options.onError?.('Message parsing error', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`❌ WebSocket disconnected (code: ${event.code}, reason: '${event.reason}', wasClean: ${event.wasClean})`);
        console.log(`📡 Final readyState: ${ws.readyState}, URL: ${ws.url}`);
        
        isConnectingRef.current = false;
        
        // Log detailed close code meanings
        const closeCodeMeanings = {
          1000: 'Normal Closure',
          1001: 'Going Away',
          1002: 'Protocol Error',
          1003: 'Unsupported Data',
          1005: 'No Status Received',
          1006: 'Abnormal Closure',
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
        
        const meaning = closeCodeMeanings[event.code as keyof typeof closeCodeMeanings] || 'Unknown';
        console.log(`🔍 Close code ${event.code} means: ${meaning}`);
        
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          connectionQuality: 'disconnected'
        }));
        
        options.onDisconnect?.();
        
        // Stop heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
        
        // Handle different close codes
        if (event.code === 1000) {
          // Normal closure, don't reconnect
          return;
        }
        
        if (!isManualDisconnectRef.current) {
          handleConnectionFailure(`Connection closed (${event.code})`);
        }
      };

      ws.onerror = (error) => {
        console.error('💥 WebSocket error occurred:', error);
        console.log(`📡 WebSocket state at error: readyState=${ws.readyState}, url=${ws.url}`);
        
        isConnectingRef.current = false;
        options.onError?.('WebSocket error', error);
        
        if (!isManualDisconnectRef.current) {
          handleConnectionFailure('WebSocket error');
        }
      };

    } catch (error) {
      console.error('💥 Failed to create WebSocket:', error);
      console.log(`🔍 Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: 'WebSocket creation failed before URL assignment'
      });
      isConnectingRef.current = false;
      handleConnectionFailure('Failed to create WebSocket');
    }
  }, [callId, userRole, connectionState.reconnectAttempts]);

  function handleConnectionFailure(reason: string) {
    const currentAttempts = connectionState.reconnectAttempts;
    
    setConnectionState(prev => ({
      ...prev,
      lastError: reason,
      reconnectAttempts: prev.reconnectAttempts + 1
    }));
    
    if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached, enabling fallback mode');
      enableFallbackMode();
      return;
    }
    
    const delay = calculateReconnectDelay(currentAttempts);
    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isManualDisconnectRef.current) {
        connect();
      }
    }, delay);
  }

  function enableFallbackMode() {
    console.log('Enabling HTTP long-polling fallback');
    
    setConnectionState(prev => ({
      ...prev,
      isFallbackActive: true,
      connectionQuality: 'poor'
    }));
    
    options.onFallback?.('WebSocket connection failed, using HTTP fallback');
    
    // Implement basic HTTP polling as fallback
    fallbackPollIntervalRef.current = setInterval(async () => {
      try {
        // Simple polling mechanism - could be enhanced with long-polling
        const response = await fetch('/api/calls/' + callId + '/messages', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const messages = await response.json();
          messages.forEach((message: any) => options.onMessage?.(message));
        }
      } catch (error) {
        console.error('Fallback polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  function flushMessageQueue() {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        // If connection lost again, put message back
        messageQueueRef.current.unshift(message);
        break;
      }
    }
  }

  function disconnect() {
    cleanup(true); // Mark as explicit disconnect
  }
  
  function endCall() {
    isManualDisconnectRef.current = true;
    cleanup(true);
  }

  function sendMessage(message: any) {
    console.log(`📤 Attempting to send message:`, message);
    console.log(`📡 WebSocket state: ${wsRef.current?.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        wsRef.current.send(messageStr);
        console.log(`✅ Message sent successfully (${messageStr.length} bytes)`);
      } catch (error) {
        console.error('💥 Failed to send message:', error);
        messageQueueRef.current.push(message);
      }
    } else if (connectionState.isFallbackActive) {
      // Send via HTTP when in fallback mode
      console.log('🔄 Using HTTP fallback to send message');
      sendViaHTTP(message);
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(message);
      console.warn('⚠️ WebSocket not connected, message queued:', message);
      console.log(`📡 Current state: connected=${connectionState.isConnected}, readyState=${wsRef.current?.readyState}`);
    }
  }

  async function sendViaHTTP(message: any) {
    try {
      await fetch('/api/calls/' + callId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('HTTP fallback send failed:', error);
      options.onError?.('Fallback send failed', error);
    }
  }

  return {
    isConnected: connectionState.isConnected,
    connectionQuality: connectionState.connectionQuality,
    reconnectAttempts: connectionState.reconnectAttempts,
    lastError: connectionState.lastError,
    isFallbackActive: connectionState.isFallbackActive,
    isMobile,
    connectionType,
    sendMessage,
    disconnect,
    endCall,
  };
}
