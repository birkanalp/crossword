# Events Contract
**contractVersion:** 1.0.0
**lastUpdated:** 2026-02-21
**owner:** backend-agent
**consumers:** frontend-agent

---

## Changelog

| Version | Date       | Notes |
|---------|-----------|-------|
| 1.0.0   | 2026-02-21 | Phase 1 — core game events |

---

## Overview

This contract defines:
1. **Client-fired analytics events** — what the frontend must send, with required properties
2. **Server-side events** — what the backend emits (via PostHog server-side SDK or Supabase webhooks), for frontend awareness
3. **RevenueCat webhook events** — purchase lifecycle events the backend receives

Events use PostHog capture format. Firebase Analytics is a drop-in substitute with the same property names.

---

## Naming Convention

- Snake_case event names: `puzzle_started`, `score_submitted`
- All timestamps are ISO 8601 UTC
- `user_id` is the Supabase auth UUID (or `null` for guests; use `guest_id` instead)

---

## 1. Client-Fired Events

These must be fired by the **frontend agent**. Backend does not validate their presence, but relies on them for analytics pipelines.

---

### `app_opened`
Fires once per app session start.

| Property   | Type   | Required | Notes |
|-----------|--------|---------|-------|
| `is_guest` | bool   | yes      | True if no JWT present |
| `guest_id` | string | no       | UUID; only when `is_guest=true` |

---

### `puzzle_started`
Fires when the player opens a puzzle and begins interacting.

| Property       | Type   | Required | Notes |
|---------------|--------|---------|-------|
| `level_id`     | uuid   | yes      | |
| `difficulty`   | string | yes      | `easy` \| `medium` \| `hard` |
| `is_premium`   | bool   | yes      | |
| `is_daily`     | bool   | yes      | True if from daily_challenge |
| `is_guest`     | bool   | yes      | |

---

### `puzzle_completed`
Fires after `submitScore` returns a 200 response.

| Property        | Type    | Required | Notes |
|----------------|---------|---------|-------|
| `level_id`      | uuid    | yes      | |
| `difficulty`    | string  | yes      | |
| `score`         | integer | yes      | Server-returned value only |
| `rank`          | integer | yes      | Server-returned |
| `is_new_best`   | bool    | yes      | Server-returned |
| `time_spent`    | integer | yes      | Seconds |
| `hints_used`    | integer | yes      | |
| `mistakes`      | integer | yes      | |
| `is_daily`      | bool    | yes      | |

---

### `puzzle_abandoned`
Fires when the player leaves a puzzle without completing it.

| Property     | Type    | Required | Notes |
|-------------|---------|---------|-------|
| `level_id`   | uuid    | yes      | |
| `difficulty` | string  | yes      | |
| `time_spent` | integer | yes      | Seconds elapsed so far |
| `progress_pct` | float | yes      | 0.0–1.0; fraction of cells correctly filled |

---

### `hint_used`
Fires each time a hint is consumed.

| Property     | Type   | Required | Notes |
|-------------|--------|---------|-------|
| `level_id`   | uuid   | yes      | |
| `hint_type`  | string | yes      | `reveal_letter` \| `reveal_word` \| `check_letter` |
| `clue_key`   | string | no       | e.g. `"3D"` — which word the hint was on |

---

### `signup_completed`
Fires after a successful `auth.signUp` or OAuth sign-in that creates a new account.

| Property     | Type   | Required | Notes |
|-------------|--------|---------|-------|
| `method`     | string | yes      | `email` \| `apple` \| `google` \| `anonymous` |
| `had_guest_progress` | bool | yes | True if `guest_id` had any progress rows before migration |

---

### `login_completed`
Fires after a returning user logs in.

| Property     | Type   | Required | Notes |
|-------------|--------|---------|-------|
| `method`     | string | yes      | `email` \| `apple` \| `google` |

---

### `guest_progress_merged`
Fires after `mergeGuestProgress` returns 200.

| Property        | Type    | Required | Notes |
|----------------|---------|---------|-------|
| `merged_count`  | integer | yes      | From server response |
| `skipped_count` | integer | yes      | From server response |

---

### `purchase_initiated`
Fires when the user taps "Go Pro" and the native purchase sheet opens.

| Property      | Type   | Required | Notes |
|--------------|--------|---------|-------|
| `product_id`  | string | yes      | RevenueCat product identifier |
| `source`      | string | yes      | `paywall` \| `premium_level_gate` \| `settings` |

---

### `purchase_completed`
Fires after RevenueCat SDK confirms purchase on the client.

| Property      | Type   | Required | Notes |
|--------------|--------|---------|-------|
| `product_id`  | string | yes      | |
| `source`      | string | yes      | Same as `purchase_initiated.source` |

---

### `purchase_failed`
Fires if the purchase sheet is dismissed or the transaction fails.

| Property      | Type   | Required | Notes |
|--------------|--------|---------|-------|
| `product_id`  | string | yes      | |
| `reason`      | string | yes      | `cancelled` \| `payment_declined` \| `unknown` |

---

## 2. Server-Side Events (Backend → Analytics)

These are emitted by Edge Functions using PostHog's server-side SDK. The frontend does not fire these.

---

### `score_validated` (backend)
Emitted by `submitScore` after successful anti-cheat validation.

| Property       | Type    | Notes |
|---------------|---------|-------|
| `level_id`     | uuid    | |
| `user_id`      | uuid    | |
| `score`        | integer | Server-computed |
| `is_new_best`  | bool    | |
| `rank`         | integer | |

---

### `anticheat_rejected` (backend)
Emitted by `submitScore` when validation fails. **Never surfaces to the client.**

| Property   | Type   | Notes |
|-----------|--------|-------|
| `level_id` | uuid   | |
| `user_id`  | uuid   | |
| `reason`   | string | e.g. `answer_hash_mismatch`, `time_too_short` |

---

### `guest_merge_completed` (backend)
Emitted by `mergeGuestProgress` on success.

| Property        | Type    | Notes |
|----------------|---------|-------|
| `user_id`       | uuid    | |
| `guest_id`      | uuid    | |
| `merged_count`  | integer | |
| `skipped_count` | integer | |

---

## 3. RevenueCat Webhook Events (RevenueCat → Backend)

The backend handles these via the `verifyPurchase` Edge Function *(Phase 2)*.
Frontend does not need to handle these directly.

| Event Type                 | Backend Action |
|---------------------------|----------------|
| `INITIAL_PURCHASE`        | Set `entitlements.is_pro = true`, record source |
| `RENEWAL`                 | Extend `entitlements.expires_at` |
| `CANCELLATION`            | Set `entitlements.is_pro = false` after `expires_at` |
| `UNCANCELLATION`          | Re-enable `entitlements.is_pro` |
| `PRODUCT_CHANGE`          | Update source/product_id |
| `BILLING_ISSUE`           | Flag entitlement as `pending_grace` (Phase 2) |

---

## Contract Update Rules

1. Backend agent must bump `contractVersion` (semver) before adding/removing any event property
2. Adding an optional property is non-breaking (patch bump `x.y.Z`)
3. Adding a required property or removing any property is breaking (minor bump `x.Y.0`)
4. Renaming an event is breaking (minor bump)
5. Frontend agent must not send undocumented properties (they will be ignored, but generate a warning in PostHog)
