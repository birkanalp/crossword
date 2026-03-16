import { useState, useEffect, useRef } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

// Try multiple lightweight endpoints; return true as soon as one succeeds.
async function checkConnectivity(): Promise<boolean> {
  const endpoints = [
    'https://connectivitycheck.gstatic.com/generate_204',
    'https://captive.apple.com/hotspot-detect.html',
  ];
  const results = await Promise.allSettled(
    endpoints.map((url) =>
      fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      })
    )
  );
  return results.some(
    (r) => r.status === 'fulfilled' && (r.value.status === 204 || r.value.ok)
  );
}

/**
 * Polls internet reachability every 10 s.
 * Only reports offline after 2 consecutive failed checks to avoid false
 * positives during app boot or brief connectivity blips.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });
  const failCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const reachable = await checkConnectivity();
      if (cancelled) return;

      if (reachable) {
        failCount.current = 0;
        setStatus({ isConnected: true, isInternetReachable: true });
      } else {
        failCount.current += 1;
        // Only flip to offline after 2 consecutive failures
        if (failCount.current >= 2) {
          setStatus({ isConnected: false, isInternetReachable: false });
        }
      }
    }

    // Delay first check by 3 s to let the app fully boot
    const boot = setTimeout(check, 3_000);
    const interval = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearTimeout(boot);
      clearInterval(interval);
    };
  }, []);

  return status;
}
