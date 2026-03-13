// Dynamic Expo config – reads sensitive values from environment variables.
// Local dev: create frontend/.env and set the vars below.
// EAS build: values come from EAS Secrets (eas secret:create).
// This file extends the static app.json base config.

/** @param {{ config: import('@expo/config-types').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // ── Supabase ────────────────────────────────────────────────────────────
    supabaseUrl:
      process.env.SUPABASE_URL || config.extra?.supabaseUrl || '',

    // ── Sentry ──────────────────────────────────────────────────────────────
    sentryDsn:
      process.env.SENTRY_DSN || config.extra?.sentryDsn || '',

    // ── RevenueCat ──────────────────────────────────────────────────────────
    revenueCatApiKeyIos:
      process.env.REVENUECAT_IOS_KEY || config.extra?.revenueCatApiKeyIos || '',
    revenueCatApiKeyAndroid:
      process.env.REVENUECAT_ANDROID_KEY || config.extra?.revenueCatApiKeyAndroid || '',

    // ── AdMob ───────────────────────────────────────────────────────────────
    admobRewardedIos:
      process.env.ADMOB_REWARDED_IOS || config.extra?.admobRewardedIos || '',
    admobRewardedAndroid:
      process.env.ADMOB_REWARDED_ANDROID || config.extra?.admobRewardedAndroid || '',
    admobInterstitialIos:
      process.env.ADMOB_INTERSTITIAL_IOS || config.extra?.admobInterstitialIos || '',
    admobInterstitialAndroid:
      process.env.ADMOB_INTERSTITIAL_ANDROID || config.extra?.admobInterstitialAndroid || '',
  },
});
