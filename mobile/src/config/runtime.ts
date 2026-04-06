import Constants from 'expo-constants';

export type AppEnv = 'development' | 'preview' | 'production';

type ExtraConfig = {
  appEnv?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  sentryDsn?: string;
  revenueCatApiKeyIos?: string;
  revenueCatApiKeyAndroid?: string;
  admobBannerIos?: string;
  admobBannerAndroid?: string;
  admobInterstitialIos?: string;
  admobInterstitialAndroid?: string;
  admobRewardedIos?: string;
  admobRewardedAndroid?: string;
  posthogApiKey?: string;
  posthogHost?: string;
  authAppleEnabled?: boolean;
  authGoogleEnabled?: boolean;
};

function getExtra(): ExtraConfig {
  return (Constants.expoConfig?.extra as ExtraConfig | undefined) ?? {};
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

const extra = getExtra();
const appEnv = ((extra.appEnv as AppEnv | undefined) ?? 'development') as AppEnv;
const isReleaseLike = appEnv === 'preview' || appEnv === 'production';

export const runtimeConfig = {
  appEnv,
  isReleaseLike,
  supabaseUrl: asOptionalString(extra.supabaseUrl),
  supabaseAnonKey: asOptionalString(extra.supabaseAnonKey),
  sentryDsn: asOptionalString(extra.sentryDsn),
  revenueCatApiKeyIos: asOptionalString(extra.revenueCatApiKeyIos),
  revenueCatApiKeyAndroid: asOptionalString(extra.revenueCatApiKeyAndroid),
  admobBannerIos: asOptionalString(extra.admobBannerIos),
  admobBannerAndroid: asOptionalString(extra.admobBannerAndroid),
  admobInterstitialIos: asOptionalString(extra.admobInterstitialIos),
  admobInterstitialAndroid: asOptionalString(extra.admobInterstitialAndroid),
  admobRewardedIos: asOptionalString(extra.admobRewardedIos),
  admobRewardedAndroid: asOptionalString(extra.admobRewardedAndroid),
  posthogApiKey: asOptionalString(extra.posthogApiKey),
  posthogHost: asOptionalString(extra.posthogHost) ?? 'https://us.i.posthog.com',
  authAppleEnabled: asBoolean(extra.authAppleEnabled),
  authGoogleEnabled: asBoolean(extra.authGoogleEnabled),
};

export function getCriticalConfigIssues(): string[] {
  const issues: string[] = [];

  if (runtimeConfig.isReleaseLike && !runtimeConfig.supabaseUrl) {
    issues.push('SUPABASE_URL eksik. Preview/production build bir backend URL olmadan calisamaz.');
  }

  if (runtimeConfig.isReleaseLike && !runtimeConfig.supabaseAnonKey) {
    issues.push('SUPABASE_ANON_KEY eksik. Preview/production auth session kurulamaz.');
  }

  return issues;
}

export function isFeatureConfigured(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}
