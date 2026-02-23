# Crossword Puzzle Game – Backend Architecture (Claude Context)

## Tech Stack

- Supabase (PostgreSQL)
- Supabase Auth (Anonymous + Email + OAuth)
- Supabase Edge Functions (TypeScript)
- RevenueCat (IAP validation)
- AdMob / AppLovin (client-side)
- PostHog or Firebase Analytics
- Sentry (error monitoring)

---

## Core Requirements

### 1. Anonymous Guest Support

- On first launch:
  - Client creates `guest_id` (UUID)
  - Stored locally
- Backend must support:
  - guest progress (nullable user_id)
  - migration on login

---

## Database Schema

### users
Handled by Supabase Auth

---

### levels

id: uuid  
version: int  
difficulty: enum (easy, medium, hard)  
is_premium: boolean  
grid_json: jsonb  
clues_json: jsonb  
created_at  
updated_at  

---

### user_progress

id  
user_id (nullable)  
guest_id (nullable)  
level_id  
state_json (jsonb)  
completed_at (nullable)  
time_spent  
mistakes  
hints_used  
updated_at  

Index:
- (user_id, level_id)
- (guest_id, level_id)

---

### daily_challenges

id  
date  
level_id  
leaderboard_enabled  

---

### leaderboard_entries

id  
user_id  
level_id  
score  
completion_time  
created_at  

Index:
- (level_id, score desc)

---

### entitlements

id  
user_id  
is_pro  
source (app_store / play_store)  
updated_at  

---

## Guest → User Migration Logic

When user logs in:

1. Fetch guest progress
2. Fetch user progress
3. Compare updated_at
4. Keep latest
5. Update rows:
   - set user_id
   - null guest_id

---

## Edge Functions

### getLevel(level_id)

Returns:
- grid_json
- clues_json
- premium flag

---

### submitScore(level_id, score, time)

- Validate completion server-side
- Insert leaderboard entry
- Return rank

---

### verifyPurchase(webhook)

- RevenueCat webhook
- Update entitlements

---

## Anti-Cheat

- Do NOT trust client score
- Validate:
  - completion time
  - hints_used
  - answer hash

Store answer hash in DB.

---

## Scoring Formula

base_score = difficulty_multiplier * 1000  
time_penalty = seconds_spent * 2  
hint_penalty = hints_used * 50  
final_score = base_score - time_penalty - hint_penalty  

---

## Daily Puzzle Logic

- One level per date
- Cache aggressively
- Leaderboard resets daily

---

## Retention Mechanics (Backend Supported)

- streak tracking table
- coins system
- coin transactions table

---

## Performance Strategy

- Level data heavily cached
- Minimal joins
- JSONB for grid/clues
- Index leaderboard queries

---

## Future Proofing

- versioned levels
- migration scripts
- soft delete support