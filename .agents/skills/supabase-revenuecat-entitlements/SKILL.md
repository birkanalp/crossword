---
name: supabase-revenuecat-entitlements
description: Handles RevenueCat webhook events and maintains entitlements table in Supabase.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Supabase RevenueCat Entitlements

You are implementing the RevenueCat webhook integration and entitlements management for a crossword puzzle mobile game.

## Step 1 — Ensure Entitlements Table

Verify or create the `entitlements` table with at minimum:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK to `auth.users`, NOT NULL |
| `product_id` | `text` | RevenueCat product identifier |
| `entitlement_id` | `text` | RevenueCat entitlement identifier |
| `is_active` | `boolean` | Current entitlement status |
| `purchase_date` | `timestamptz` | Original purchase date |
| `expiration_date` | `timestamptz` | NULL for lifetime purchases |
| `store` | `text` | `app_store`, `play_store`, etc. |
| `environment` | `text` | `production` or `sandbox` |
| `original_transaction_id` | `text` | For deduplication |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

Add unique constraint on `(user_id, entitlement_id)` for upsert operations.

### RLS Policies

- Enable RLS.
- `SELECT`: Users can only read their own rows (`auth.uid() = user_id`).
- `INSERT` / `UPDATE` / `DELETE`: Service role only (no client writes).

## Step 2 — Webhook Edge Function

Create `backend/supabase/functions/revenuecat-webhook/index.ts`:

### Payload Validation
- Verify the `Authorization` header matches a shared secret stored in environment variables (`REVENUECAT_WEBHOOK_SECRET`).
- Reject requests with missing or invalid authorization immediately (401).
- Validate the payload structure before processing.

### Event Handling

Handle these RevenueCat webhook event types:

| Event | Action |
|---|---|
| `INITIAL_PURCHASE` | Upsert entitlement as active |
| `RENEWAL` | Update `expiration_date`, set `is_active = true` |
| `CANCELLATION` | Set `is_active = false` on expiration |
| `EXPIRATION` | Set `is_active = false` |
| `BILLING_ISSUE` | Log warning, keep `is_active` until expiration |
| `PRODUCT_CHANGE` | Update `product_id` and `entitlement_id` |
| `UNCANCELLATION` | Set `is_active = true`, update dates |

### Idempotency
- Use `original_transaction_id` + event type to detect duplicate webhooks.
- If the same event has already been processed (check `updated_at` and state), skip gracefully and return 200.
- Never process an older event that would overwrite a newer state.

### Response
- Always return 200 for valid payloads (even if skipped) so RevenueCat doesn't retry.
- Return 401 for auth failures.
- Return 400 for malformed payloads.

## Step 3 — Update Contract

If the webhook endpoint is not in `CONTRACTS/api.contract.json`, add it:
- Endpoint: `POST /functions/v1/revenuecat-webhook`
- Auth: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
- Body: RevenueCat webhook payload
- Response: `{ "ok": true }` or error

Update the contract **before** implementing.

## Step 4 — Decision Log

Append to `CONTRACTS/decisions.log.md`:
- Date and what was decided.
- Why certain event types are handled the way they are.
- Any trade-offs made (e.g., idempotency strategy).

## Step 5 — Update Status

Update `CONTRACTS/status.backend.md` with:
- Entitlements table status.
- Webhook function status.
- Which events are handled.
- Any open TODOs.

## Rules

- **Never expose the webhook publicly without authorization validation.** The shared secret check is mandatory.
- **Always handle idempotency.** Duplicate webhooks must not corrupt state.
- Use the Supabase MCP (`mcp__supabase__query`) for read-only DB checks.
- All schema changes must be migration-safe.
- Use service role for all DB writes in the webhook function.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/supabase-revenuecat-entitlements table` for schema only).
