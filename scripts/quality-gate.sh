#!/usr/bin/env bash
# =============================================================================
# Bulmaca Release Quality Gate
#
# Runs: frontend typecheck → frontend lint → admin typecheck → admin build
#
# Exit code 0 = all checks passed.
# Exit code 1 = one or more checks failed (details printed above).
#
# Usage:
#   ./scripts/quality-gate.sh          # full gate
#   ./scripts/quality-gate.sh frontend # frontend checks only
#   ./scripts/quality-gate.sh admin    # admin checks only
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ADMIN_DIR="$REPO_ROOT/admin"

# Colour helpers (no-op if terminal doesn't support it)
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

PASS=0
FAIL=0
ERRORS=()

run_check() {
  local label="$1"
  shift
  echo -e "${YELLOW}▶ $label${RESET}"
  if "$@"; then
    echo -e "${GREEN}  ✓ PASS${RESET}"
    ((PASS++))
  else
    echo -e "${RED}  ✗ FAIL${RESET}"
    ((FAIL++))
    ERRORS+=("$label")
  fi
  echo ""
}

TARGET="${1:-all}"

if [[ "$TARGET" == "all" || "$TARGET" == "frontend" ]]; then
  echo "========================================"
  echo " Frontend Checks"
  echo "========================================"
  echo ""

  run_check "Frontend — TypeScript typecheck" \
    bash -c "cd '$FRONTEND_DIR' && npx tsc --noEmit"

  run_check "Frontend — ESLint" \
    bash -c "cd '$FRONTEND_DIR' && npx eslint . --ext .ts,.tsx --max-warnings 0"
fi

if [[ "$TARGET" == "all" || "$TARGET" == "admin" ]]; then
  echo "========================================"
  echo " Admin Panel Checks"
  echo "========================================"
  echo ""

  run_check "Admin — TypeScript typecheck" \
    bash -c "cd '$ADMIN_DIR' && npx tsc --noEmit"

  run_check "Admin — Next.js production build" \
    bash -c "cd '$ADMIN_DIR' && npm run build"
fi

echo "========================================"
echo " Quality Gate Summary"
echo "========================================"
echo -e "  Passed: ${GREEN}$PASS${RESET}"
echo -e "  Failed: ${RED}$FAIL${RESET}"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo -e "${RED}FAILED CHECKS:${RESET}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗${RESET} $err"
  done
  echo ""
  echo -e "${RED}Quality gate FAILED. Fix the above issues before releasing.${RESET}"
  exit 1
else
  echo ""
  echo -e "${GREEN}Quality gate PASSED. Safe to release.${RESET}"
  exit 0
fi
