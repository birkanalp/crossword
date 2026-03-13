# Release Agent — Debugging Notes

## exactOptionalPropertyTypes Fix Pattern

TypeScript `strictest` mode with `exactOptionalPropertyTypes: true` rejects passing
`T | undefined` as an optional property value because optional means "key may be absent"
not "key may be undefined". Metro bundler does NOT enforce this, but `tsc --noEmit` does.

### Bad (TS error)
```ts
useLeaderboard({ guestId: guestId }); // guestId is string | undefined
```

### Good (conditional spread)
```ts
useLeaderboard({ ...(guestId !== undefined ? { guestId } : {}) });
```

### Good (conditional spread for JSX props)
```tsx
<Component {...(guestId !== undefined ? { guestId } : {})} />
```

### Good (guard before assignment)
```ts
const opts: { guestId?: string } = {};
if (guestId) opts.guestId = guestId;
```

## Files Fixed in 2026-03-06 Build
- `frontend/src/api/client.ts`: fetch body `undefined` -> conditional spread
- `frontend/src/api/hooks/useLevels.ts`: levelKeys.list opts conditional spreads
- `frontend/src/api/hooks/useProfile.ts`: `response.data` null guard before return
- `frontend/app/leaderboard.tsx`: `level_id` and `guestId` conditional spreads
- `frontend/app/game/levels.tsx`: `guestId` in useListLevels calls
- `frontend/app/game/level/[id].tsx`: logAdEvent, PuzzleLeaderboard, ProfileSetupModal
- `frontend/src/components/game/PuzzleLeaderboard.tsx`: authToken, guestId spreads

## EAS Archive Size Warning
Project archive is ~189 MB — primarily because ios/Pods is not fully excluded.
Consider adding more entries to `.easignore` to speed up upload.
Current .easignore: `ios/Pods`, `ios/build`, `android/build`, `android/.gradle`,
`node_modules`, `.expo`, `.claude`
