---
name: offline-progress-persistence
description: Implements offline-first progress save/restore logic.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Offline Progress Persistence

You are implementing offline-first progress persistence for a crossword puzzle mobile game built with Expo.

## Step 1 — Storage Module

Create `frontend/src/lib/storage.ts` (or update if it exists) with typed async storage helpers for:

### Keys & Data Shapes

| Key | Type | Purpose |
|---|---|---|
| `guest_id` | `string` (uuid) | Unique ID for anonymous users, generated on first launch |
| `level_state:<level_id>` | `LevelState` | Per-level save state |
| `last_open_level` | `string` (level_id) | Resume point on app reopen |

### `LevelState` Shape

```ts
interface LevelState {
  levelId: string;
  userInput: Record<string, string>;  // "row,col" -> letter
  elapsedSeconds: number;
  direction: 'across' | 'down';
  activeCellRow: number | null;
  activeCellCol: number | null;
  updatedAt: string;  // ISO 8601 timestamp
  completed: boolean;
}
```

### Implementation

- Use `@react-native-async-storage/async-storage` or `expo-secure-store` for `guest_id`.
- Provide typed `get`, `set`, `remove` wrappers — never call AsyncStorage directly from components.
- Handle JSON parse errors gracefully (corrupted data = treat as empty, don't crash).

## Step 2 — Debounced Autosave

Create `frontend/src/hooks/useAutosave.ts`:

- Subscribe to the game store (Zustand) for changes to user input, elapsed time, and active cell.
- **Debounce writes to 3–5 seconds** to avoid hammering storage on every keystroke.
- Use a trailing debounce — save the latest state after the user pauses.
- Cancel pending debounce on unmount.

```ts
// Pseudocode
const useAutosave = (levelId: string) => {
  const gameState = useGameStore(selectSaveableState);

  useEffect(() => {
    const timer = setTimeout(() => {
      storage.saveLevelState(levelId, gameState);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameState]);
};
```

## Step 3 — Save on Background & Exit

Use `expo-app-state` or React Native's `AppState` API:

- **On `background` / `inactive`**: Immediately flush any pending save (bypass debounce).
- **On app termination**: Best-effort save. Since JS may be killed, the debounced save from Step 2 acts as the safety net (last save is at most 3–5s stale).

Implementation in `frontend/src/hooks/useAppLifecycle.ts`:

```ts
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') {
      storage.flushPendingSave();
    }
  });
  return () => sub.remove();
}, []);
```

## Step 4 — Restore Session on App Start

On app launch (in root layout or boot hook):

1. Read `last_open_level` from storage.
2. If it exists, read the corresponding `LevelState`.
3. Hydrate the game store with the restored state.
4. Navigate to the level if the user was mid-game.

Handle edge cases:
- Level no longer exists (deleted from backend) — clear saved state, go to home.
- Corrupted state — clear and start fresh.
- No saved state — normal fresh start.

## Step 5 — Merge-Ready Payload

When the user signs in (after playing as guest), prepare a merge payload:

```ts
interface MergePayload {
  guestId: string;
  progress: Array<{
    levelId: string;
    userInput: Record<string, string>;
    elapsedSeconds: number;
    updatedAt: string;  // ISO 8601 — used for conflict resolution
    completed: boolean;
  }>;
}
```

- Collect all `LevelState` entries from storage.
- Include `updatedAt` on every entry so the backend `mergeGuestProgress` function can resolve conflicts (newer wins).
- After successful merge, clear guest-specific local data.

## Step 6 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- Storage module status.
- Autosave implementation status.
- App lifecycle save/restore status.
- Merge payload readiness.
- Any open TODOs.

## Rules

- **No data loss.** The user's progress must survive app kills, crashes, and backgrounding.
- **Must work without network.** All save/restore is local-first. Network sync is a separate concern.
- Do not duplicate state — the game store (Zustand) is the source of truth in memory; storage is the persistence layer.
- Keep storage reads async and non-blocking. Never block the UI thread waiting for storage.
- All timestamps must be ISO 8601 UTC.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/offline-progress-persistence autosave` for debounce logic only).
