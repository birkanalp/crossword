import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

/**
 * Polls network state every 5 s and returns the current connectivity status.
 * Falls back to `true` on the initial render to avoid a flash of the offline
 * banner before the first check completes.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) {
          setStatus({
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable ?? false,
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({ isConnected: false, isInternetReachable: false });
        }
      }
    }

    check();

    const interval = setInterval(check, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return status;
}
