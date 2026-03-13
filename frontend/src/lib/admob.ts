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

// ─── Interstitial Ad (placeholder) ───────────────────────────────────────────

/**
 * Show an interstitial ad. Not yet implemented — placeholder for future use.
 */
export async function showInterstitialAd(): Promise<void> {
  // TODO: implement when interstitial placement is defined
  console.log('[AdMob] Interstitial not implemented yet');
}
