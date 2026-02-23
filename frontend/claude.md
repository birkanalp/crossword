# Crossword Puzzle Game – Frontend Architecture (Claude Context)

## Tech Stack

- Expo (React Native)
- TypeScript
- expo-router
- Zustand (state management)
- TanStack Query
- react-native-svg (grid rendering)
- react-native-gesture-handler
- AsyncStorage
- expo-sqlite (optional)
- RevenueCat SDK
- AdMob SDK
- Sentry
- expo-updates

---

## Core UX Requirements

- Modern, playful UI
- Smooth animations
- Subtle sound effects
- Dark mode support
- Responsive grid scaling

---

## Navigation Structure

/app
  /(auth)
/game
  /level/[id]
  /daily
/profile
/leaderboard
/store

---

## Game State Structure (Zustand)

gameState:
- currentLevel
- selectedCell
- selectedClue
- direction (across/down)
- filledCells
- elapsedTime
- hintsUsed
- mistakes
- isCompleted

---

## Save Strategy

Auto-save when:
- Every 3–5 seconds (debounced)
- App background
- Exit level

Save:
- filledCells
- elapsedTime
- hintsUsed
- mistakes

---

## Guest Flow

On first launch:
- generate guest_id
- store locally

On login:
- trigger backend merge
- refresh progress

---

## Grid Rendering

- Render via react-native-svg
- Each cell clickable
- Highlight full word when selected
- Animate correct word glow
- Animate wrong answer shake

---

## Right Side Panel

- Expandable clues list
- Auto-scroll to selected clue
- Highlight active clue

---

## Competitive Features

### Leaderboard
- Daily leaderboard
- Level leaderboard
- Show rank after completion

---

### Coin System
Earn coins from:
- Level completion
- Daily puzzle
- Streak bonus

Spend coins on:
- Hint letter
- Reveal word
- Fix mistakes

---

### Hint System

Types:
- Reveal letter
- Reveal word
- Clear wrong letters

Track hintsUsed for scoring.

---

### Streak System

- Daily login check
- Show streak counter on home
- Reward milestones

---

### Scoring Display

After completion:
- Base score
- Time penalty
- Hint penalty
- Final score
- Rank animation

---

## Monetization

RevenueCat:
- Premium levels
- Ad removal

Ads:
- Interstitial after level
- Rewarded for extra hints

---

## Performance

- Memoize cell rendering
- Avoid full grid rerenders
- Only update changed cells
- Use SVG layers efficiently

---

## Analytics Events

- level_start
- level_complete
- hint_used
- mistake_made
- ad_watched
- purchase_made
- streak_increment

---

## UX Polish

- Subtle haptic feedback
- Smooth highlight transitions
- Sound toggle in settings
- Minimal UI clutter

---

## Critical Rules

- Never block UI on network
- Always allow offline play
- Always restore last session
- Never trust client score (backend validated)