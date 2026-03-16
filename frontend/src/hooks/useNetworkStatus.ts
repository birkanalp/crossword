import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

// Lightweight fetch-based connectivity check — no native module required.
async function checkConnectivity(): Promise<boolean> {
  try {
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

/**
 * Polls internet reachability every 5 s.
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
      const reachable = await checkConnectivity();
      if (!cancelled) {
        setStatus({ isConnected: reachable, isInternetReachable: reachable });
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
