# Native Config Strategy — Bulmaca iOS/Android

## Decision: Bare Workflow (native folders tracked in git)

The `ios/` directory IS committed to the repository. This means:

- `expo-doctor` may warn that app.json config changes won't auto-sync to native projects.
- **All app.json `extra` fields (supabaseUrl, sentryDsn, etc.) are read at JS runtime via `expo-constants` — they do NOT require a native rebuild.**
- Native changes (new SDKs, entitlements, Info.plist) MUST be applied via `expo prebuild` or manually.

## When to Run `expo prebuild`

Run `npm run prebuild` (or `npm run prebuild:clean` for a clean slate) when:

1. Adding or removing a native SDK that requires `expo install` + pod install.
2. Changing `app.json` fields that affect native code:
   - `ios.bundleIdentifier`
   - `ios.infoPlist`
   - `android.package`
   - `plugins` array
3. Updating the `expo` SDK major version.

## Adding a New SDK

```bash
cd frontend
npx expo install <package-name>   # installs correct version
npm run prebuild                  # regenerates native config
cd ios && pod install             # iOS — install native pods
```

## EAS Build

For EAS builds, native folders are NOT required — EAS manages native generation internally. The `eas.json` build profile can use `"prebuildCommand": "npm run prebuild:clean"`.

## Environment Variables at Runtime vs Build Time

| Variable | Where set | Requires rebuild? |
|----------|-----------|------------------|
| `supabaseUrl` | app.json extra → expo-constants | No |
| `sentryDsn` | app.json extra → expo-constants | No |
| `posthogApiKey` | app.json extra → expo-constants | No |
| `revenueCatApiKeyIos` | app.json extra → expo-constants | No |
| iOS Bundle ID | `ios.bundleIdentifier` in app.json | **Yes — run prebuild** |
| Push Notifications | `ios.entitlements` in app.json | **Yes — run prebuild** |

## Summary

- `app.json` is source of truth.
- `ios/` and `android/` are generated artifacts that are committed for CI stability.
- When in doubt: `npm run prebuild:clean` re-generates both native folders from app.json.
