import { useEffect, useRef } from 'react';

/**
 * Returns an AbortSignal that is aborted when the component unmounts.
 *
 * Use this to pass to `apiRequest` for imperative fetch calls (i.e. calls
 * outside of TanStack Query hooks) so that in-flight requests are cancelled
 * when the user navigates away.
 *
 * TanStack Query hooks (useQuery / useMutation) already receive their own
 * `signal` from the queryFn context — see the hooks in src/api/hooks/.
 *
 * @example
 * const signal = useAbortOnUnmount();
 * const result = await apiRequest('/someEndpoint', { signal });
 */
export function useAbortOnUnmount(): AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  if (controllerRef.current === null) {
    controllerRef.current = new AbortController();
  }

  useEffect(() => {
    const controller = controllerRef.current!;
    return () => {
      controller.abort();
    };
  }, []);

  return controllerRef.current.signal;
}
