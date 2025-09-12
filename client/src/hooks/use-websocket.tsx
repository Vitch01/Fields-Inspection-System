import { useEffect, useRef, useState } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const reconnectDelayRef = useRef<number>(1000); // Start with 1 second
  const maxReconnectAttempts = 10;
  const maxReconnectDelay = 30000; // 30 seconds max
  const shouldReconnectRef = useRef<boolean>(true);
  const socketGenerationRef = useRef<number>(0); // To track socket generations

  useEffect(() => {
    // Reset reconnection state when callId changes
    shouldReconnectRef.current = true;
    reconnectDelayRef.current = 1000;
    setReconnectAttempts(0);
    
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    connect();
    return () => {
      disconnect();
    };
  }, [callId]);

  function connect() {
    try {
      // Clear any existing timeout before creating new connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      
      // Increment generation to invalidate old socket callbacks
      socketGenerationRef.current += 1;
      const currentGeneration = socketGenerationRef.current;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Check if this socket is still current
        if (currentGeneration !== socketGenerationRef.current) {
          console.log("WebSocket onopen: Socket generation mismatch, ignoring");
          return;
        }
        
        console.log("WebSocket connected");
        setIsConnected(true);
        
        // Reset reconnection state on successful connection
        reconnectDelayRef.current = 1000;
        setReconnectAttempts(0);
        
        options.onConnect?.();

        // Join the call room
        sendMessage({
          type: "join-call",
          callId,
          userId: userRole,
        });
      };

      ws.onmessage = (event) => {
        // Check if this socket is still current
        if (currentGeneration !== socketGenerationRef.current) {
          console.log("WebSocket onmessage: Socket generation mismatch, ignoring");
          return;
        }
        
        try {
          const message = JSON.parse(event.data);
          options.onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        // Check if this socket is still current
        if (currentGeneration !== socketGenerationRef.current) {
          console.log("WebSocket onclose: Socket generation mismatch, ignoring");
          return;
        }
        
        console.log("WebSocket disconnected");
        setIsConnected(false);
        options.onDisconnect?.();
        
        // Only attempt to reconnect if we should and haven't exceeded max attempts
        if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts) {
          const newAttempts = reconnectAttempts + 1;
          setReconnectAttempts(newAttempts);
          const currentDelay = reconnectDelayRef.current;
          
          console.log(
            `WebSocket reconnection attempt ${newAttempts}/${maxReconnectAttempts} in ${currentDelay}ms`
          );
          
          // Clear any existing timeout before setting new one
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, currentDelay) as unknown as number;
          
          // Double the delay for next attempt, capped at maxReconnectDelay
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, maxReconnectDelay);
        } else {
          console.log(
            `WebSocket reconnection stopped after ${reconnectAttempts} attempts or manual disconnect`
          );
        }
      };

      ws.onerror = (error) => {
        // Check if this socket is still current
        if (currentGeneration !== socketGenerationRef.current) {
          console.log("WebSocket onerror: Socket generation mismatch, ignoring");
          return;
        }
        
        console.error("WebSocket error:", error);
      };

    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }

  function disconnect() {
    // Stop reconnection attempts
    shouldReconnectRef.current = false;
    
    // Clear any pending timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Increment generation to invalidate old socket callbacks
    socketGenerationRef.current += 1;
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    
    // Reset reconnection state
    reconnectDelayRef.current = 1000;
    setReconnectAttempts(0);
  }

  function sendMessage(message: any) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message:", message);
    }
  }

  function retryConnection() {
    // Reset reconnection state and attempt to connect again
    shouldReconnectRef.current = true;
    reconnectDelayRef.current = 1000;
    setReconnectAttempts(0);
    
    // Clear any pending timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Increment generation to invalidate old socket callbacks before closing
    socketGenerationRef.current += 1;
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    connect();
  }

  return {
    isConnected,
    sendMessage,
    disconnect,
    retryConnection,
    reconnectAttempts,
    maxReconnectAttempts,
  };
}
