import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { captureError } from './sentry';

// ─── RevenueCat SDK Scaffold ──────────────────────────────────────────────────
// TODO: Add real product IDs and entitlement identifiers from RevenueCat dashboard.

const API_KEY = Platform.select({
  ios: Constants.expoConfig?.extra?.revenueCatApiKeyIos as string | undefined ?? '',
  android: Constants.expoConfig?.extra?.revenueCatApiKeyAndroid as string | undefined ?? '',
}) ?? '';

export const ENTITLEMENTS = {
  PREMIUM: 'premium',
  NO_ADS: 'no_ads',
} as const;

export const OFFERINGS = {
  DEFAULT: 'default',
} as const;

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initRevenueCat(userId: string): Promise<void> {
  if (!API_KEY) {
    console.warn('[RevenueCat] No API key configured — skipping init.');
    return;
  }

  try {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
  } catch (err) {
    captureError(err, { context: 'revenuecat_init' });
  }
}

// ─── Entitlement Checks ───────────────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    captureError(err, { context: 'revenuecat_getCustomerInfo' });
    return null;
  }
}

export async function isPremium(): Promise<boolean> {
  const info = await getCustomerInfo();
  return info?.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
}

export async function hasNoAds(): Promise<boolean> {
  const info = await getCustomerInfo();
  return info?.entitlements.active[ENTITLEMENTS.NO_ADS] !== undefined;
}

// ─── Purchase Flow ────────────────────────────────────────────────────────────

export async function fetchOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (err) {
    captureError(err, { context: 'revenuecat_fetchOfferings' });
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
  } catch (err) {
    captureError(err, { context: 'revenuecat_purchasePackage' });
    return false;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    captureError(err, { context: 'revenuecat_restorePurchases' });
    return null;
  }
}
