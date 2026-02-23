import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { captureError } from './sentry';

// ─── AdMob Scaffold ───────────────────────────────────────────────────────────
// TODO: Install and configure react-native-google-mobile-ads.
// Using a scaffold interface so callers don't need to handle SDK absence.

const INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: Constants.expoConfig?.extra?.admobInterstitialIos as string | undefined
    ?? 'ca-app-pub-3940256099942544/4411468910', // Test ID
  android: Constants.expoConfig?.extra?.admobInterstitialAndroid as string | undefined
    ?? 'ca-app-pub-3940256099942544/1033173712', // Test ID
}) ?? '';

const REWARDED_AD_UNIT_ID = Platform.select({
  ios: Constants.expoConfig?.extra?.admobRewardedIos as string | undefined
    ?? 'ca-app-pub-3940256099942544/1712485313', // Test ID
  android: Constants.expoConfig?.extra?.admobRewardedAndroid as string | undefined
    ?? 'ca-app-pub-3940256099942544/5224354917', // Test ID
}) ?? '';

// ─── Interstitial ─────────────────────────────────────────────────────────────

/**
 * Show an interstitial ad after level completion.
 * No-ops if ads are disabled (premium user) or an error occurs.
 */
export async function showInterstitialAd(): Promise<void> {
  try {
    // TODO: const { InterstitialAd, AdEventType } = await import('react-native-google-mobile-ads');
    // const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);
    // await ad.load();
    // ad.show();
    console.log('[AdMob] Interstitial would show here:', INTERSTITIAL_AD_UNIT_ID);
  } catch (err) {
    captureError(err, { context: 'admob_interstitial' });
  }
}

// ─── Rewarded ─────────────────────────────────────────────────────────────────

export interface RewardedAdResult {
  rewarded: boolean;
  rewardType?: string;
  rewardAmount?: number;
}

/**
 * Show a rewarded ad (e.g., to earn extra hints).
 * Returns whether the user completed the ad and earned the reward.
 */
export async function showRewardedAd(): Promise<RewardedAdResult> {
  try {
    // TODO: const { RewardedAd, RewardedAdEventType } = await import('react-native-google-mobile-ads');
    // Implement full rewarded ad flow
    console.log('[AdMob] Rewarded ad would show here:', REWARDED_AD_UNIT_ID);
    return { rewarded: false };
  } catch (err) {
    captureError(err, { context: 'admob_rewarded' });
    return { rewarded: false };
  }
}
