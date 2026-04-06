import * as Sentry from '@sentry/react-native';
import { runtimeConfig } from '@/config/runtime';

// ─── Sentry Initialisation ────────────────────────────────────────────────────
// Call initSentry() once at the very top of app/_layout.tsx before any rendering.

const DSN = runtimeConfig.sentryDsn ?? '';

export function initSentry(): void {
  if (!DSN || !DSN.startsWith('https://')) {
    console.warn('[Sentry] No DSN configured — skipping init.');
    return;
  }

  Sentry.init({
    dsn: DSN,
    // Disable in development to avoid flooding Sentry
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    environment: runtimeConfig.appEnv,
  });
}

// ─── Error Reporting Helpers ──────────────────────────────────────────────────

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (error instanceof Error) {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(error);
    });
  }
}

export function setUserContext(userId: string, isGuest: boolean): void {
  Sentry.setUser({ id: userId, isGuest: String(isGuest) });
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}
