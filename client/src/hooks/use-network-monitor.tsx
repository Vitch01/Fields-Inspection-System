import { useState, useEffect, useRef, useCallback } from "react";

interface NetworkInfo {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NetworkMonitorOptions {
  onNetworkChange?: (networkInfo: NetworkInfo) => void;
  onConnectionRestore?: () => void;
  stabilityThreshold?: number; // ms to wait before considering network stable
}

export function useNetworkMonitor(options: NetworkMonitorOptions = {}) {
  const { onNetworkChange, onConnectionRestore, stabilityThreshold = 2000 } = options;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    isOnline: navigator.onLine
  });
  const [isNetworkStable, setIsNetworkStable] = useState(true);
  
  const stabilityTimeoutRef = useRef<NodeJS.Timeout>();
  const lastNetworkChangeRef = useRef<number>(Date.now());
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout>();

  // Get network connection info if available
  const getNetworkInfo = useCallback((): NetworkInfo => {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    const info: NetworkInfo = {
      isOnline: navigator.onLine
    };

    if (connection) {
      info.effectiveType = connection.effectiveType;
      info.downlink = connection.downlink;
      info.rtt = connection.rtt;
      info.saveData = connection.saveData;
    }

    return info;
  }, []);

  // Check if network has actually changed (not just a brief disconnection)
  const hasNetworkChanged = useCallback((oldInfo: NetworkInfo, newInfo: NetworkInfo): boolean => {
    // Online status change is always a network change
    if (oldInfo.isOnline !== newInfo.isOnline) {
      return true;
    }

    // Check for significant changes in connection quality
    if (oldInfo.effectiveType !== newInfo.effectiveType) {
      return true;
    }

    // Check for significant changes in network speed
    if (oldInfo.downlink && newInfo.downlink) {
      const speedChangeRatio = Math.abs(oldInfo.downlink - newInfo.downlink) / oldInfo.downlink;
      if (speedChangeRatio > 0.5) { // 50% change in speed
        return true;
      }
    }

    return false;
  }, []);

  // Handle network changes with stability checking
  const handleNetworkChange = useCallback(() => {
    const newInfo = getNetworkInfo();
    const oldInfo = networkInfo;
    
    console.log("Network change detected:", {
      old: oldInfo,
      new: newInfo,
      hasChanged: hasNetworkChanged(oldInfo, newInfo)
    });

    setNetworkInfo(newInfo);
    setIsOnline(newInfo.isOnline);
    
    // Mark network as unstable temporarily
    setIsNetworkStable(false);
    lastNetworkChangeRef.current = Date.now();

    // Clear existing stability timeout
    if (stabilityTimeoutRef.current) {
      clearTimeout(stabilityTimeoutRef.current);
    }

    // Set network as stable after threshold
    stabilityTimeoutRef.current = setTimeout(() => {
      setIsNetworkStable(true);
      
      // If we're back online and network has actually changed, trigger connection restore
      if (newInfo.isOnline && hasNetworkChanged(oldInfo, newInfo)) {
        console.log("Network restored after change, triggering connection restore");
        onConnectionRestore?.();
      }
    }, stabilityThreshold);

    // Notify about network change immediately if significant
    if (hasNetworkChanged(oldInfo, newInfo)) {
      onNetworkChange?.(newInfo);
    }
  }, [networkInfo, getNetworkInfo, hasNetworkChanged, onNetworkChange, onConnectionRestore, stabilityThreshold]);

  // Periodic connection quality check
  const checkConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      // Simple connectivity test using a small fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const start = Date.now();
      await fetch(window.location.origin + '/api', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      clearTimeout(timeoutId);
      
      const latency = Date.now() - start;
      
      // Update network info with measured latency
      const currentInfo = getNetworkInfo();
      const updatedInfo = { ...currentInfo, measuredRtt: latency };
      
      // Only update if there's a significant change
      if (Math.abs((networkInfo as any).measuredRtt - latency) > 500) {
        setNetworkInfo(updatedInfo);
      }
      
    } catch (error) {
      // Connection test failed, might indicate network issues
      console.warn("Connection quality check failed:", error);
      
      // If we were supposed to be online but connectivity test failed,
      // this might indicate a network transition
      if (navigator.onLine && isNetworkStable) {
        handleNetworkChange();
      }
    }
  }, [networkInfo, getNetworkInfo, isNetworkStable, handleNetworkChange]);

  // Set up event listeners
  useEffect(() => {
    // Online/offline event listeners
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // Network connection change listeners (if supported)
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleNetworkChange);
    }

    // Periodic connection quality checks
    connectionCheckIntervalRef.current = setInterval(checkConnectionQuality, 10000); // Every 10 seconds

    // Initial network info setup
    const initialInfo = getNetworkInfo();
    setNetworkInfo(initialInfo);
    setIsOnline(initialInfo.isOnline);

    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      
      if (connection) {
        connection.removeEventListener('change', handleNetworkChange);
      }
      
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
      
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
    };
  }, [handleNetworkChange, checkConnectionQuality, getNetworkInfo]);

  // Detect page visibility changes (can indicate network switches on mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When page becomes visible, check if network changed while away
        setTimeout(() => {
          const newInfo = getNetworkInfo();
          if (hasNetworkChanged(networkInfo, newInfo)) {
            console.log("Network change detected after page visibility change");
            handleNetworkChange();
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [networkInfo, getNetworkInfo, hasNetworkChanged, handleNetworkChange]);

  return {
    isOnline,
    networkInfo,
    isNetworkStable,
    timeSinceLastChange: Date.now() - lastNetworkChangeRef.current
  };
}