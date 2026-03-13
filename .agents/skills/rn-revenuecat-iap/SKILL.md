---
name: rn-revenuecat-iap
description: Integrates RevenueCat in Expo app for premium levels and ad removal.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# RevenueCat IAP Integration

You are integrating RevenueCat for in-app purchases in a crossword puzzle mobile game built with Expo.

## Step 1 — Configure RevenueCat SDK

Ensure `react-native-purchases` is installed and configured:

- Initialize in `frontend/src/lib/revenuecat.ts` (or update existing).
- Call `Purchases.configure()` with the platform-specific API key from environment variables.
- Initialize **once** at app startup (root layout or boot hook).
- Set user ID after authentication: `Purchases.logIn(userId)`.
- Reset on logout: `Purchases.logOut()`.

```ts
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

export const initRevenueCat = () => {
  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
    android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
  });
  if (!apiKey) throw new Error('RevenueCat API key missing');
  Purchases.configure({ apiKey });
};
```

## Step 2 — Create PurchaseService

Create `frontend/src/services/purchaseService.ts`:

### `init()`
- Called at app boot.
- Configures RevenueCat.
- Fetches initial customer info to hydrate entitlement state.

### `fetchOfferings()`
- Returns available packages/products for display in a paywall.
- Cache offerings in memory to avoid repeated network calls.
- Handle the case where offerings are empty (misconfigured in RevenueCat dashboard).

### `purchase(packageToPurchase)`
- Initiates the purchase flow.
- Returns the updated customer info on success.
- Handles user cancellation gracefully (not an error).
- Handles errors (network, billing unavailable, etc.) with user-friendly messages.
- Emits `purchase_success` analytics event on success.

### `restore()`
- Calls `Purchases.restorePurchases()`.
- Updates local entitlement state.
- Shows appropriate feedback: "Purchases restored" or "No purchases found".
- **Must be accessible from settings screen** (App Store requirement).

### `getEntitlements()`
- Returns current active entitlements from RevenueCat.
- Used to check access before allowing premium content.

## Step 3 — Guard Premium Levels

Create a utility or hook for checking entitlements:

```ts
// frontend/src/hooks/useEntitlement.ts
export const useEntitlement = (entitlementId: string): boolean => {
  // Check RevenueCat customer info for active entitlement
};
```

Use this to:
- Show/hide lock icons on premium levels in the level select screen.
- Block navigation to premium levels if not entitled.
- Show a paywall when a locked level is tapped.

Entitlement IDs to support:
- `premium` — unlocks all levels.
- `no_ads` — removes interstitial ads.

## Step 4 — Emit Analytics Events

On successful purchase, emit:
```ts
analytics.track({
  name: 'purchase_success',
  properties: {
    product_id: transaction.productId,
    entitlement_id: 'premium', // or 'no_ads'
    price_usd: product.price,
  }
});
```

Ensure this matches `CONTRACTS/events.contract.md` exactly.

## Step 5 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- RevenueCat SDK configuration status.
- PurchaseService methods implemented.
- Entitlement guard status.
- Analytics integration status.
- Any open TODOs.

## Rules

- **Handle restore correctly.** Apple and Google require a visible "Restore Purchases" option. It must work reliably.
- **Must work on iOS and Android.** Use `Platform.select` for API keys. Test both purchase flows.
- Never hardcode API keys — always read from environment variables.
- Never cache entitlement state locally for access control — always check RevenueCat as source of truth (with brief in-memory cache for UX).
- Handle all error states: network failure, billing unavailable, purchase cancelled, purchase pending.
- Do not import the analytics service directly — accept a callback or use the app's event system so the purchase service stays decoupled.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/rn-revenuecat-iap restore` for restore flow only).
