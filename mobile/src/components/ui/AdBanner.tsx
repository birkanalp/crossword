import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── AdBanner ────────────────────────────────────────────────────────────────
//
// Renders a Google AdMob BannerAd at the bottom of a screen.
// Lazy-requires react-native-google-mobile-ads so the import never runs in
// environments where the native module is unavailable (Expo Go).
//
// Props:
//   hideAds — when true the banner is not rendered (premium users with no_ads)
//
// Usage:
//   <AdBanner hideAds={noAdsActive} />
//
// AdMob banner ad unit IDs are read from app.json extra:
//   admobBannerIos / admobBannerAndroid

function getAdMobModule() {
  try {
    return require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

function getBannerAdUnitId(TestIds: { BANNER: string }): string {
  if (__DEV__) return TestIds.BANNER;
  return (
    Platform.select({
      ios: Constants.expoConfig?.extra?.admobBannerIos as string | undefined,
      android: Constants.expoConfig?.extra?.admobBannerAndroid as string | undefined,
    }) || TestIds.BANNER
  );
}

interface AdBannerProps {
  hideAds?: boolean;
}

export function AdBanner({ hideAds = false }: AdBannerProps) {
  if (hideAds) return null;

  const mod = getAdMobModule();
  if (!mod) return null;

  const { BannerAd, BannerAdSize, TestIds } = mod;
  const adUnitId = getBannerAdUnitId(TestIds);

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
});
