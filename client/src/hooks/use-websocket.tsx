import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoJoin?: boolean; // Whether to automatically send join-call on connect
}

interface JoinState {
  callId: string;
  userId: string;
  additionalData?: any;
}

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const { autoJoin = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [pendingJoinMessage, setPendingJoinMessage] = useState<any>(null);
  const [joinedState, setJoinedState] = useState<JoinState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [callId]);

  function connect() {
    try {
      // Properly handle HTTPS → WSS and HTTP → WS conversion for mobile compatibility
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      // Enhanced logging for mobile debugging
      console.log("[WebSocket] Connection details:", {
        protocol: window.location.protocol,
        wsProtocol: protocol,
        host: window.location.host,
        fullUrl: wsUrl,
        userAgent: navigator.userAgent,
        isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent),
        timestamp: new Date().toISOString()
      });
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        setIsConnected(true);
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
        setIsConnected(false);
        options.onDisconnect?.();
        
        // Attempt to reconnect with better timing for mobile networks
        const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
        const reconnectDelay = isMobile ? 5000 : 3000; // Longer delay for mobile to handle network transitions
        console.log(`[WebSocket] Will attempt reconnection in ${reconnectDelay / 1000} seconds (${isMobile ? 'mobile' : 'desktop'} device)...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
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
      };

    } catch (error) {
      console.error("[WebSocket] Failed to establish connection:", {
        error,
        protocol: window.location.protocol,
        host: window.location.host,
        isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent)
      });
      setIsConnected(false);
    }
  }

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
      console.log("[WebSocket] Sending message:", message.type, message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Not connected, cannot send message. State:", wsRef.current?.readyState, "Message:", message);
    }
  }

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

  return {
    isConnected,
    sendMessage,
    disconnect,
    joinCall,
  };
}
