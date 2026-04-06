import type { ConfigContext, ExpoConfig } from 'expo/config';

const base = require('./app.json').expo as ExpoConfig;

const APP_ENV = process.env.APP_ENV ?? 'development';
const IS_RELEASE_LIKE = APP_ENV === 'preview' || APP_ENV === 'production';

const LOCAL_SUPABASE_URL = 'http://localhost:54321';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE3NzIxMTY0MTgsImV4cCI6MjA4NzQ3NjQxOH0.T7GMZllJJFOCL47MTIfpTpDY0A22xTcBfeJ9q7Gfibw';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = readEnv(name);
  if (value == null) return fallback;
  return value === 'true';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base,
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '1828f3ad-8c17-4753-b35e-7174026dcb70',
    },
    appEnv: APP_ENV,
    supabaseUrl: readEnv('SUPABASE_URL') ?? (!IS_RELEASE_LIKE ? LOCAL_SUPABASE_URL : undefined),
    supabaseAnonKey:
      readEnv('SUPABASE_ANON_KEY') ??
      readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ??
      (!IS_RELEASE_LIKE ? LOCAL_SUPABASE_ANON_KEY : undefined),
    sentryDsn: readEnv('SENTRY_DSN'),
    revenueCatApiKeyIos: readEnv('REVENUECAT_IOS_KEY'),
    revenueCatApiKeyAndroid: readEnv('REVENUECAT_ANDROID_KEY'),
    admobBannerIos: readEnv('ADMOB_BANNER_IOS'),
    admobBannerAndroid: readEnv('ADMOB_BANNER_ANDROID'),
    admobInterstitialIos: readEnv('ADMOB_INTERSTITIAL_IOS'),
    admobInterstitialAndroid: readEnv('ADMOB_INTERSTITIAL_ANDROID'),
    admobRewardedIos: readEnv('ADMOB_REWARDED_IOS'),
    admobRewardedAndroid: readEnv('ADMOB_REWARDED_ANDROID'),
    posthogApiKey: readEnv('POSTHOG_API_KEY'),
    posthogHost: readEnv('POSTHOG_HOST') ?? 'https://us.i.posthog.com',
    authAppleEnabled: readBoolean('AUTH_APPLE_ENABLED', false),
    authGoogleEnabled: readBoolean('AUTH_GOOGLE_ENABLED', false),
  },
});
