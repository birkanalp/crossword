Launch the security-review subagent to scan the current git diff for OWASP Top-10 vulnerabilities.

## Instructions for the agent

1. Run `git diff HEAD` from `/Users/birkanalp/Desktop/Bulmaca` to get the delta
2. If $ARGUMENTS is provided, use that as the diff scope (e.g., a specific file, branch, or PR)
3. Apply OWASP Top-10 checklist to **changed lines only** (not the entire codebase)
4. Use confidence threshold ≥ 0.8 — skip speculative findings
5. Report HIGH and MEDIUM severity only
6. Apply 17+ false-positive exclusion categories
7. Output findings with exploit scenarios and specific fixes
8. End with PASS / FAIL / CONDITIONAL PASS verdict

## Working directory
$CLAUDE_PROJECT_DIR = /Users/birkanalp/Desktop/Bulmaca

## Target
$ARGUMENTS (default: `git diff HEAD`)

Priority areas for Bulmaca:
- Backend Edge Functions (`backend/supabase/functions/`)
- Admin API routes (`admin/app/api/`)
- Auth context and session handling (`admin/contexts/AuthContext.tsx`)
- Supabase client initialization (`admin/lib/supabase.ts`)
