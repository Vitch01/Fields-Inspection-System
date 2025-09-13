import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface UseWebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

type TransportMode = 'websocket' | 'http-polling' | 'connecting' | 'failed';

export function useWebSocket(callId: string, userRole: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const isPollingActiveRef = useRef(false);
  const httpPollingJoinedRef = useRef(false);
  const fallbackTriggeredRef = useRef(false);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [callId]);

  // ============================================================
  // HTTP POLLING FUNCTIONS (MOBILE FALLBACK)
  // ============================================================
  
  async function sendHttpMessage(message: any): Promise<boolean> {
    try {
      console.log(`📤 [HTTP Polling] Sending message:`, { type: message.type, callId: message.callId });
      
      const response = await apiRequest('POST', '/api/signaling/send', message);
      
      if (response.ok) {
        console.log(`✅ [HTTP Polling] Message sent successfully: ${message.type}`);
        return true;
      } else {
        console.error(`❌ [HTTP Polling] Failed to send message:`, response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error(`💥 [HTTP Polling] Error sending message:`, error);
      return false;
    }
  }

  async function startHttpPolling() {
    if (isPollingActiveRef.current) {
      console.log('📡 [HTTP Polling] Already active, skipping start');
      return;
    }
    
    console.log(`📡 [HTTP Polling] Starting long polling for ${userRole} in call ${callId}`);
    isPollingActiveRef.current = true;
    
    // First, join the call via HTTP
    if (!httpPollingJoinedRef.current) {
      const joinSuccess = await sendHttpMessage({
        type: "join-call",
        callId,
        userId: userRole,
      });
      
      if (joinSuccess) {
        httpPollingJoinedRef.current = true;
        setIsConnected(true);
        setTransportMode('http-polling');
        options.onConnect?.();
        console.log(`✅ [HTTP Polling] Successfully joined call ${callId} as ${userRole}`);
      } else {
        console.error(`❌ [HTTP Polling] Failed to join call ${callId}`);
        setTransportMode('failed');
        return;
      }
    }
    
    pollForMessages();
  }

  async function pollForMessages() {
    if (!isPollingActiveRef.current) {
      console.log('📡 [HTTP Polling] Polling stopped');
      return;
    }
    
    try {
      console.log(`📡 [HTTP Polling] Polling for messages: ${userRole} in ${callId}`);
      
      // Use fetch with AbortController for proper timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout
      
      const response = await fetch(`/api/signaling/poll/${callId}/${userRole}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('📡 [HTTP Polling] User not found in call, need to rejoin');
          httpPollingJoinedRef.current = false;
          await startHttpPolling();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📨 [HTTP Polling] Received ${data.messages?.length || 0} messages`, data.timeout ? '(timeout)' : '');
      
      // Process received messages
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((message: any) => {
          console.log(`📨 [HTTP Polling] Processing message:`, { type: message.type, from: message.userId });
          options.onMessage?.(message);
        });
      }
      
      // Continue polling
      if (isPollingActiveRef.current) {
        // Small delay to prevent rapid polling
        pollingTimeoutRef.current = setTimeout(pollForMessages, 100);
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('📡 [HTTP Polling] Request aborted (timeout or cancelled)');
      } else {
        console.error('💥 [HTTP Polling] Error during polling:', error);
      }
      
      if (isPollingActiveRef.current) {
        // Retry after error with exponential backoff
        const retryDelay = Math.min(5000, 1000 * Math.pow(2, 1)); // Start with 2s, max 5s
        console.log(`🔄 [HTTP Polling] Retrying in ${retryDelay}ms`);
        pollingTimeoutRef.current = setTimeout(pollForMessages, retryDelay);
      }
    }
  }

  function stopHttpPolling() {
    console.log('🛑 [HTTP Polling] Stopping polling');
    isPollingActiveRef.current = false;
    httpPollingJoinedRef.current = false;
    
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = undefined;
    }
  }

  // ============================================================
  // ENHANCED WEBSOCKET WITH MOBILE CARRIER DETECTION
  // ============================================================

  // Trigger fallback to HTTP polling
  function triggerHttpPollingFallback(reason: string) {
    console.warn(`🚨 [Fallback] Triggering HTTP polling fallback - Reason: ${reason}`);
    fallbackTriggeredRef.current = true;
    setTransportMode('http-polling');
    
    // Clean up WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Start HTTP polling
    startHttpPolling();
  }

  // Detect if we should skip WebSocket and go directly to HTTP polling
  function shouldUseHttpPollingDirectly(): boolean {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // Force HTTP polling on known problematic mobile carriers
    if (connection && isMobile) {
      const cellularTypes = ['cellular', '2g', '3g', '4g', '5g'];
      const isOnCellular = cellularTypes.includes(connection.effectiveType?.toLowerCase()) || 
                          cellularTypes.includes(connection.type?.toLowerCase());
      
      if (isOnCellular) {
        console.log('📱 [Mobile Detection] Cellular connection detected, using HTTP polling directly');
        return true;
      }
    }
    
    // Check if fallback was previously triggered for this session
    if (fallbackTriggeredRef.current) {
      console.log('🔄 [Fallback] HTTP polling previously triggered, using HTTP directly');
      return true;
    }
    
    return false;
  }

  function connect() {
    console.log(`🔗 [Connection] Starting connection for ${userRole} in call ${callId}`);
    setTransportMode('connecting');
    
    // Check if we should skip WebSocket and go directly to HTTP polling
    if (shouldUseHttpPollingDirectly()) {
      console.log('📱 [Mobile] Skipping WebSocket, going directly to HTTP polling');
      setTransportMode('http-polling');
      startHttpPolling();
      return;
    }
    
    try {
      // Use robust URL construction to ensure proper '/ws' endpoint targeting
      const url = new URL('/ws', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = url.toString();
      
      // Enhanced mobile connection diagnostics
      const connectionInfo = {
        constructedUrl: wsUrl,
        originalProtocol: window.location.protocol,
        finalProtocol: url.protocol,
        host: window.location.host,
        path: url.pathname,
        userAgent: navigator.userAgent,
        network: (navigator as any).connection ? {
          type: (navigator as any).connection.type,
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : 'Unknown',
        timestamp: new Date().toISOString()
      };
      
      console.log("🚀 [WebSocket] Attempting connection with robust URL construction:", connectionInfo);
      console.log("🎯 [WebSocket] Final WebSocket URL:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set up WebSocket timeout for mobile carrier detection
      const wsConnectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn("⏰ [WebSocket] Connection timeout - likely blocked by mobile carrier");
          ws.close();
          triggerHttpPollingFallback('connection timeout');
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(wsConnectionTimeout);
        console.log("✅ [WebSocket] Connection established successfully");
        console.log("📱 [Mobile] Network info at connection time:", connectionInfo.network);
        setIsConnected(true);
        setTransportMode('websocket');
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
        clearTimeout(wsConnectionTimeout);
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
        
        // Check for mobile carrier blocking (codes 1005, 1006, 1015)
        const mobileCarrierBlocking = [1005, 1006, 1015].includes(event.code);
        const abnormalClosure = !event.wasClean && event.code !== 1000;
        
        if (mobileCarrierBlocking || abnormalClosure) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            console.warn(`🚨 [Mobile] Detected mobile carrier blocking (code ${event.code}), switching to HTTP polling`);
            triggerHttpPollingFallback(`WebSocket closed with code ${event.code}`);
            return;
          }
        }
        
        options.onDisconnect?.();
        
        // Only retry WebSocket if not switching to HTTP polling
        if (!fallbackTriggeredRef.current) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const reconnectDelay = isMobile ? 5000 : 3000; // Longer delay for mobile
          
          console.log(`🔄 [WebSocket] Scheduling reconnection in ${reconnectDelay}ms (mobile: ${isMobile})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(wsConnectionTimeout);
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
        
        // Check if this is a mobile carrier blocking error
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && ws.readyState === WebSocket.CLOSED) {
          console.warn("🚨 [Mobile] WebSocket error on mobile device, likely carrier blocking");
          triggerHttpPollingFallback('WebSocket error on mobile');
        }
      };

    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }

  function disconnect() {
    console.log(`🔌 [Disconnect] Stopping all connections for ${userRole} in call ${callId}`);
    
    // Clean up reconnection timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Clean up WebSocket
    if (wsRef.current) {
      // Send leave-call message before closing if connected
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const leaveMessage = {
          type: "leave-call",
          callId,
          userId: userRole,
        };
        wsRef.current.send(JSON.stringify(leaveMessage));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Clean up HTTP polling
    stopHttpPolling();
    
    // Send leave message via HTTP if using HTTP polling
    if (transportMode === 'http-polling' && httpPollingJoinedRef.current) {
      sendHttpMessage({
        type: "leave-call",
        callId,
        userId: userRole,
      });
    }
    
    setIsConnected(false);
    setTransportMode('connecting');
    fallbackTriggeredRef.current = false;
  }

  function sendMessage(message: any) {
    // Route message based on current transport mode
    if (transportMode === 'websocket' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 [WebSocket] Sending message:", { type: message.type, to: message.callId });
      wsRef.current.send(JSON.stringify(message));
    } else if (transportMode === 'http-polling' || fallbackTriggeredRef.current) {
      console.log("📤 [HTTP Polling] Routing message to HTTP:", { type: message.type, to: message.callId });
      sendHttpMessage(message);
    } else {
      // Connection not ready - queue for retry or trigger fallback
      const diagnostics = {
        message,
        transportMode,
        readyState: wsRef.current?.readyState,
        fallbackTriggered: fallbackTriggeredRef.current,
        httpPollingJoined: httpPollingJoinedRef.current,
        network: (navigator as any).connection ? {
          type: (navigator as any).connection.type,
          effectiveType: (navigator as any).connection.effectiveType
        } : 'Unknown',
        timestamp: new Date().toISOString()
      };
      
      console.warn("⚠️ [Transport] No transport available for message:", diagnostics);
      
      // For mobile devices, try triggering HTTP fallback
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && transportMode === 'connecting') {
        console.log("📱 [Mobile] Triggering HTTP fallback due to message send failure");
        triggerHttpPollingFallback('message send failed');
        // Retry sending via HTTP after fallback
        setTimeout(() => sendHttpMessage(message), 1000);
      }
    }
  }

  return {
    isConnected,
    sendMessage,
    disconnect,
    transportMode, // Expose current transport for debugging and UI indicators
  };
}
