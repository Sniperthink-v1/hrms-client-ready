// Network Status Hook
import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    // Get initial network state
    NetInfo.fetch().then(state => {
      if (!cancelled && isMountedRef.current) {
        setIsConnected(state.isConnected);
        setIsInternetReachable(state.isInternetReachable);
      }
    }).catch(error => {
      console.error('Error fetching network status:', error);
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!cancelled && isMountedRef.current) {
        setIsConnected(state.isConnected);
        setIsInternetReachable(state.isInternetReachable);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return {
    isConnected: isConnected === true,
    isInternetReachable: isInternetReachable === true,
    isOffline: isConnected === false || isInternetReachable === false,
  };
}

