import { useEffect, useRef, useState } from "react";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
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
      
      // Enhanced mobile connection diagnostics
      const connectionInfo = {
        protocol,
        url: wsUrl,
        userAgent: navigator.userAgent,
        network: (navigator as any).connection ? {
          type: (navigator as any).connection.type,
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : 'Unknown',
        timestamp: new Date().toISOString()
      };
      
      console.log("🚀 [WebSocket] Attempting connection with mobile diagnostics:", connectionInfo);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ [WebSocket] Connection established successfully");
        console.log("📱 [Mobile] Network info at connection time:", connectionInfo.network);
        setIsConnected(true);
        options.onConnect?.();

        // Join the call room with enhanced logging
        const joinMessage = {
          type: "join-call",
          callId,
          userId: userRole,
        };
        console.log("📞 [WebSocket] Sending join-call message:", joinMessage);
        sendMessage(joinMessage);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📨 [WebSocket] Received message:", { type: message.type, from: message.userId });
          options.onMessage?.(message);
        } catch (error) {
          console.error("❌ [WebSocket] Failed to parse message:", {
            error: error instanceof Error ? error.message : String(error),
            rawData: event.data,
            timestamp: new Date().toISOString()
          });
        }
      };

      ws.onclose = (event) => {
        const closeInfo = {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          network: (navigator as any).connection ? {
            type: (navigator as any).connection.type,
            effectiveType: (navigator as any).connection.effectiveType
          } : 'Unknown',
          timestamp: new Date().toISOString()
        };
        
        console.log("🔌 [WebSocket] Connection closed:", closeInfo);
        setIsConnected(false);
        options.onDisconnect?.();
        
        // Mobile-specific reconnection strategy
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const reconnectDelay = isMobile ? 5000 : 3000; // Longer delay for mobile
        
        console.log(`🔄 [WebSocket] Scheduling reconnection in ${reconnectDelay}ms (mobile: ${isMobile})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      };

      ws.onerror = (error) => {
        const errorInfo = {
          error: error.toString(),
          readyState: ws.readyState,
          url: wsUrl,
          network: (navigator as any).connection ? {
            type: (navigator as any).connection.type,
            effectiveType: (navigator as any).connection.effectiveType
          } : 'Unknown',
          timestamp: new Date().toISOString()
        };
        
        console.error("💥 [WebSocket] Connection error:", errorInfo);
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
      console.log("📤 [WebSocket] Sending message:", { type: message.type, to: message.callId });
      wsRef.current.send(JSON.stringify(message));
    } else {
      const diagnostics = {
        message,
        readyState: wsRef.current?.readyState,
        states: {
          CONNECTING: WebSocket.CONNECTING,
          OPEN: WebSocket.OPEN,
          CLOSING: WebSocket.CLOSING,
          CLOSED: WebSocket.CLOSED
        },
        network: (navigator as any).connection ? {
          type: (navigator as any).connection.type,
          effectiveType: (navigator as any).connection.effectiveType
        } : 'Unknown',
        timestamp: new Date().toISOString()
      };
      
      console.warn("⚠️ [WebSocket] Cannot send message - connection not ready:", diagnostics);
    }
  }

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
