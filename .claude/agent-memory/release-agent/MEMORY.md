# Release Agent Memory — Bulmaca

## Project Config
- Frontend: `/Users/birkanalp/Desktop/Bulmaca/frontend/`
- EAS project ID: `1828f3ad-8c17-4753-b35e-7174026dcb70`
- EAS account: `birkanalp`
- Bundle ID (iOS): `com.bulmaca.app`
- Package name (Android): `com.bulmaca.app`

## Current Versions (as of 2026-03-06)
- app version: `1.0.0`
- iOS buildNumber: `"1"` (in app.json; ignored when ios/ native dir exists)
- Android versionCode: `1`
- Runtime version: `1.0.0` (static string)
- SDK: Expo ~52, RN 0.76.9

## EAS Build Profiles
- `development`: `developmentClient: true`, `ios.simulator: true`, distribution: internal
- `preview`: distribution: internal (no simulator flag)
- `production`: `autoIncrement: true`, distribution: store

## Build History
- Build `a03ea5b0` (2026-03-05): iOS dev, finished, fingerprint `095388d1...`
- Build `ee3cb2db` (2026-03-06): iOS dev, finished, fingerprint `095388d1...`
  - Commit: `9930935` (leaderboard + AdMob + TS fixes)
  - Archive: https://expo.dev/artifacts/eas/vqgWSaa5MbRwcZgdZg8VH7.tar.gz
  - Install: https://expo.dev/accounts/birkanalp/projects/bulmaca/builds/ee3cb2db-338c-44ab-b216-2855ff8bacec

## Key Quirks
- ios/ native directory EXISTS — `ios.bundleIdentifier` and `ios.buildNumber` in app.json are IGNORED by EAS; native values take precedence
- `appVersionSource: "remote"` in eas.json — local buildNumber/versionCode fields are informational only
- TypeScript `exactOptionalPropertyTypes: true` is enforced in tsconfig — use conditional spreads `...(val !== undefined ? { key: val } : {})` instead of passing `string | undefined` to optional props
- `react-native-google-mobile-ads` requires a patch (`patches/react-native-google-mobile-ads+16.0.3.patch`) for New Architecture compatibility — `patch-package` runs via `postinstall`
- `.easignore` excludes: `ios/Pods`, `ios/build`, `android/build`, `android/.gradle`, `node_modules`, `.expo`, `.claude`
- EAS does NOT run `tsc --noEmit` — Metro bundler ignores TypeScript type errors at build time
- Project archive is ~189 MB; EAS upload takes ~1 min on typical connection

## Pre-Build Checklist Result (2026-03-06)
All checks passed:
1. Git clean (frontend files) — committed before build
2. Branch: master
3. No DEBUG flags
4. Build profile: development (iOS simulator)
5. TypeScript: 0 errors after fixing exactOptionalPropertyTypes issues
6. Assets present (icon 1x1 — acceptable for dev)
7. eas.json valid
8. Contract: not blocking (development build)

## Common TS Errors to Watch
Pattern: `exactOptionalPropertyTypes` violations when passing `T | undefined` to optional props.
Fix: use conditional spread instead of direct property assignment.

See `debugging.md` for detailed fix patterns.
