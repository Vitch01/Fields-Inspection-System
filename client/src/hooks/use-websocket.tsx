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
      // More robust WebSocket URL construction
      const wsUrl = `${window.location.origin.replace(/^http/, 'ws')}/ws`;
      console.log("[WebSocket] Attempting connection to:", wsUrl);
      console.log("[WebSocket] Current location:", window.location.href);
      
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
        
        // Attempt to reconnect after 3 seconds
        console.log("[WebSocket] Will attempt reconnection in 3 seconds...");
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error occurred:", error);
        console.error("[WebSocket] Connection state:", ws.readyState);
        console.error("[WebSocket] URL attempted:", wsUrl);
      };

    } catch (error) {
      console.error("[WebSocket] Failed to establish connection:", error);
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
