---
name: analytics-contract-enforcer
description: Implements analytics with strict adherence to CONTRACTS/events.contract.md.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Analytics Contract Enforcer

You are implementing a typed analytics service for a crossword puzzle mobile game. All event names and payloads must exactly match the contract.

## Step 1 — Read Events Contract

Read `CONTRACTS/events.contract.md` to understand:
- All defined event names.
- Required and optional properties for each event.
- Data types and allowed values.

If the file is missing, create it with the events listed below and inform the user.

## Step 2 — Create Typed AnalyticsService

Create `frontend/src/lib/analytics.ts`:

### Type Definitions

Define a discriminated union of all events so TypeScript enforces correctness at compile time:

```ts
type AnalyticsEvent =
  | { name: 'level_start'; properties: { level_id: string; is_daily: boolean } }
  | { name: 'level_complete'; properties: { level_id: string; time_seconds: number; hints_used: number; is_daily: boolean } }
  | { name: 'hint_used'; properties: { level_id: string; hint_type: 'letter' | 'word'; remaining_hints: number } }
  | { name: 'ad_watched'; properties: { ad_type: 'interstitial' | 'rewarded'; placement: string } }
  | { name: 'purchase_success'; properties: { product_id: string; entitlement_id: string; price_usd: number } };
```

Adjust to match the actual contract. The types must be a 1:1 mirror of the contract — no extra events, no missing fields.

### Service Interface

```ts
const analytics = {
  track(event: AnalyticsEvent): void;
  identify(userId: string): void;
  reset(): void;  // on logout
};
```

- `track` accepts only valid `AnalyticsEvent` shapes — anything else is a compile error.
- Internally, `track` queues the event and attempts to flush.

## Step 3 — Implement Core Events

### `level_start`
- Fired when the user begins playing a level.
- Properties: `level_id`, `is_daily`.

### `level_complete`
- Fired when the user completes a level.
- Properties: `level_id`, `time_seconds`, `hints_used`, `is_daily`.
- `time_seconds` must be the actual elapsed time, not a client-fabricated value.

### `hint_used`
- Fired when a hint is consumed.
- Properties: `level_id`, `hint_type`, `remaining_hints`.

### `ad_watched`
- Fired when an ad is fully watched (not just loaded).
- Properties: `ad_type`, `placement`.

### `purchase_success`
- Fired after a successful IAP.
- Properties: `product_id`, `entitlement_id`, `price_usd`.

## Step 4 — Offline Queue

Events must not be lost when offline:

1. On `track()`, push the event (with timestamp) to an in-memory queue.
2. Attempt to flush the queue to the analytics backend.
3. If flush fails (no network), persist the queue to AsyncStorage.
4. On app start and on network recovery, retry flushing persisted events.
5. Cap the queue at a reasonable size (e.g., 500 events) to prevent unbounded storage growth.

```ts
interface QueuedEvent {
  event: AnalyticsEvent;
  timestamp: string;  // ISO 8601
  retryCount: number;
}
```

## Step 5 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- AnalyticsService implementation status.
- Which events are implemented.
- Offline queue status.
- Any open TODOs.

## Rules

- **Event names must exactly match the contract.** No `levelStart` when the contract says `level_start`. No extra properties.
- **No PII allowed.** Never include email, name, IP, device ID, or any personally identifiable information in event properties. User ID from `auth.uid()` is acceptable.
- If you need a new event that isn't in the contract, **update `CONTRACTS/events.contract.md` first**, then implement.
- The analytics service must be a thin layer — no business logic inside it.
- All timestamps must be ISO 8601 UTC.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/analytics-contract-enforcer queue` for offline queue only).
