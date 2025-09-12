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
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        options.onConnect?.();

        // Send buffered join message if exists
        if (pendingJoinMessage) {
          console.log("Sending buffered join message:", pendingJoinMessage);
          ws.send(JSON.stringify(pendingJoinMessage));
          setPendingJoinMessage(null);
        }
        
        // Re-join if we were previously joined (after reconnection)
        else if (joinedState && !autoJoin) {
          console.log("Re-joining call after reconnection:", joinedState);
          const rejoinMessage = {
            type: "join-call",
            callId: joinedState.callId,
            userId: joinedState.userId,
            ...joinedState.additionalData
          };
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
          options.onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        options.onDisconnect?.();
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
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
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message:", message);
    }
  }

  const joinCall = useCallback((additionalData: any = {}) => {
    const message = {
      type: "join-call",
      callId,
      userId: userRole,
      ...additionalData
    };
    
    // Store join state for re-joining on reconnection
    setJoinedState({
      callId,
      userId: userRole,
      additionalData
    });
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("Sending join message immediately:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.log("Buffering join message until connected:", message);
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
