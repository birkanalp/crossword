import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RewardedAdResult = { rewarded: boolean };

// ─── Native module guard ──────────────────────────────────────────────────────
// react-native-google-mobile-ads requires a custom native build (development
// build or production binary). It crashes immediately in Expo Go because the
// native TurboModule is not registered. We lazy-require the package so that
// the import itself never runs at module load time, and we always check for
// availability before using it.

function getAdMobModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

// ─── Ad Unit ID resolution ───────────────────────────────────────────────────

function getRewardedAdUnitId(): string {
  const mod = getAdMobModule();
  const fallback = 'ca-app-pub-3940256099942544/5224354917'; // Google test ID
  if (!mod) return fallback;
  const { TestIds } = mod;
  if (__DEV__) return TestIds.REWARDED;
  return Platform.select({
    ios:
      (Constants.expoConfig?.extra?.admobRewardedIos as string | undefined) ||
      TestIds.REWARDED,
    android:
      (Constants.expoConfig?.extra?.admobRewardedAndroid as string | undefined) ||
      TestIds.REWARDED,
    default: TestIds.REWARDED,
  }) as string;
}

// ─── Rewarded Ad ─────────────────────────────────────────────────────────────

/**
 * Show a rewarded ad and await the user's outcome.
 * Resolves with `{ rewarded: true }` only when the SDK fires EARNED_REWARD
 * before CLOSED. Resolves with `{ rewarded: false }` if the user skips,
 * closes early, or if the ad fails to load/show, or if AdMob native module
 * is unavailable (e.g. Expo Go).
 */
export async function showRewardedAd(): Promise<RewardedAdResult> {
  const mod = getAdMobModule();
  if (!mod) {
    console.warn('[AdMob] Native module not available — skipping rewarded ad');
    return { rewarded: false };
  }

  const { RewardedAd, RewardedAdEventType, AdEventType } = mod;

  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(getRewardedAdUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });

    let rewarded = false;

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewarded = true;
      },
    );

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubEarned();
      unsubClosed();
      resolve({ rewarded });
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (_error) => {
      unsubEarned();
      unsubClosed();
      unsubError();
      resolve({ rewarded: false });
    });

    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      ad.show().catch(() => resolve({ rewarded: false }));
    });

    ad.load();
  });
}

// ─── Interstitial Ad ─────────────────────────────────────────────────────────

function getInterstitialAdUnitId(): string {
  const mod = getAdMobModule();
  const fallback = 'ca-app-pub-3940256099942544/4411468910'; // Google test ID
  if (!mod) return fallback;
  const { TestIds } = mod;
  if (__DEV__) return TestIds.INTERSTITIAL;
  return Platform.select({
    ios:
      (Constants.expoConfig?.extra?.admobInterstitialIos as string | undefined) ||
      TestIds.INTERSTITIAL,
    android:
      (Constants.expoConfig?.extra?.admobInterstitialAndroid as string | undefined) ||
      TestIds.INTERSTITIAL,
    default: TestIds.INTERSTITIAL,
  }) as string;
}

/**
 * Show an interstitial ad after level completion.
 * Resolves when the ad is dismissed (CLOSED) or if it fails to load/show.
 * Safe to call without await — errors are swallowed silently.
 */
export async function showInterstitialAd(): Promise<void> {
  const mod = getAdMobModule();
  if (!mod) {
    console.warn('[AdMob] Native module not available — skipping interstitial ad');
    return;
  }

  const { InterstitialAd, AdEventType } = mod;

  return new Promise((resolve) => {
    const ad = InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubClosed();
      resolve();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (_error) => {
      unsubClosed();
      unsubError();
      resolve(); // fail silently — don't block the user
    });

    ad.addAdEventListener(AdEventType.LOADED, () => {
      ad.show().catch(() => resolve());
    });

    ad.load();
  });
}
