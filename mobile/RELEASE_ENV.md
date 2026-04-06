# Mobile Release Env Contract

Bu dokuman mobil uygulamanin repo-ici release kontratini tanimlar.

## Source of truth

- Statik Expo metadata: [`app.json`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json)
- Runtime env mapping: [`app.config.ts`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.config.ts)
- Runtime reader: [`src/config/runtime.ts`](/Users/birkanalp/Desktop/Bulmaca/mobile/src/config/runtime.ts)

## Kritik env degiskenleri

- `APP_ENV`: `development` | `preview` | `production`
- `SUPABASE_URL`: Edge Functions ve auth backend base URL
- `SUPABASE_ANON_KEY`: Supabase auth client için zorunlu anon key

## Fail-fast policy

- `development`: local fallback kabul edilir
- `preview` ve `production`: `SUPABASE_URL` ve `SUPABASE_ANON_KEY` yoksa uygulama `ConfigErrorScreen` ile bloklanır

## Optional ama desteklenen env degiskenleri

- `SENTRY_DSN`
- `REVENUECAT_IOS_KEY`
- `REVENUECAT_ANDROID_KEY`
- `ADMOB_BANNER_IOS`
- `ADMOB_BANNER_ANDROID`
- `ADMOB_INTERSTITIAL_IOS`
- `ADMOB_INTERSTITIAL_ANDROID`
- `ADMOB_REWARDED_IOS`
- `ADMOB_REWARDED_ANDROID`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `AUTH_APPLE_ENABLED`
- `AUTH_GOOGLE_ENABLED`

## Bilinçli olarak repo dışında bırakılanlar

- App Store Connect submit credential'ları
- Google Play service account JSON
- Gerçek production RevenueCat ve AdMob anahtarları
- Final store asset seti
