---
name: expo-project-foundation
description: Initializes and configures Expo (TypeScript strict) project with production setup.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Expo Project Foundation

You are setting up and configuring the Expo frontend for a crossword puzzle mobile game with production-grade tooling.

## Step 1 — TypeScript Strict Mode

Ensure `frontend/tsconfig.json` has strict mode enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Verify there are no conflicting settings. Fix any resulting type errors if the project was not previously strict.

## Step 2 — Expo Router Structure

Ensure the `frontend/app/` directory follows expo-router conventions:

```
app/
├── _layout.tsx          # Root layout (providers, navigation container)
├── index.tsx            # Home / level select screen
├── game/
│   ├── _layout.tsx      # Game stack layout
│   ├── level/
│   │   └── [id].tsx     # Play a specific level
│   └── daily.tsx        # Daily challenge screen
├── profile/
│   └── index.tsx        # User profile / stats
├── settings/
│   └── index.tsx        # App settings
└── +not-found.tsx       # 404 fallback
```

Only create missing files. Do not overwrite existing screens that already have content.

## Step 3 — EAS Build Profiles

Ensure `frontend/eas.json` exists with these profiles:

### `development`
- Internal distribution.
- `developmentClient: true`.
- iOS simulator + Android emulator builds.

### `preview`
- Internal distribution for TestFlight / internal testing.
- No dev client.

### `production`
- Store distribution.
- Auto-increment build numbers.

Example structure:
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_ENV": "preview" }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "" },
      "android": { "track": "internal" }
    }
  }
}
```

## Step 4 — Expo Updates

Configure `expo-updates` in `frontend/app.json` (or `app.config.ts`):

- Set `updates.url` to the EAS update URL.
- Set `updates.fallbackToCacheTimeout` to `0` for instant launch.
- Set `runtimeVersion` policy to `"appVersion"` or a custom policy.

Ensure the `expo-updates` package is listed in dependencies.

## Step 5 — Sentry Setup

Ensure `@sentry/react-native` is configured:

- Wrap the root layout with `Sentry.wrap()`.
- Initialize with DSN from environment variables (never hardcode).
- Configure source maps upload in EAS build hooks if not already done.
- Add `sentry.properties` to `.gitignore` if it contains secrets.

## Step 6 — Environment Variable Strategy

Set up a clean env variable approach:

- Use `frontend/src/lib/env.ts` to export typed env accessors.
- Read from `process.env` or `expo-constants` as appropriate.
- Define `.env.example` with all required keys (no values).
- Ensure `.env` and `.env.local` are in `.gitignore`.
- Document which vars are needed for each EAS profile.

Required variables:
| Variable | Used For |
|---|---|
| `SUPABASE_URL` | Supabase API endpoint |
| `SUPABASE_ANON_KEY` | Supabase public key |
| `SENTRY_DSN` | Sentry error tracking |
| `REVENUECAT_API_KEY_IOS` | RevenueCat iOS |
| `REVENUECAT_API_KEY_ANDROID` | RevenueCat Android |
| `APP_ENV` | development / preview / production |

## Step 7 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- TypeScript config status.
- Router structure status.
- EAS profiles status.
- Sentry integration status.
- Env variable setup status.
- Any open TODOs.

## Rules

- **No secrets in the repository.** All sensitive values go in `.env` / EAS secrets.
- **Must support both iOS and Android.** No platform-specific hacks without fallbacks.
- Only create files that don't already exist. Prefer editing existing files.
- Use the Expo MCP tools when helpful (e.g., `mcp__expo-mcp__add_library` for packages).

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/expo-project-foundation eas` for EAS config only).
