# Master Orchestrator Agent — Memory

## Agent Roster
- backend-core-agent (sonnet, red) — DB, RLS, Edge Functions, anti-cheat
- frontend-core-agent (sonnet) — Expo UI, Zustand, API integration
- contract-guardian (sonnet, green) — Read-only auditor, contract sync validation
- monetization-agent — IAP, RevenueCat, AdMob, paywalls
- performance-agent — React Native render optimization
- release-agent — EAS builds, changelogs, store prep

## Key Ordering Rules
1. Backend updates contract FIRST, then implements
2. Frontend follows backend (never before)
3. Contract Guardian validates after each API-touching phase
4. Monetization after backend entitlements are ready
5. Performance after significant UI work
6. Release only on explicit request
