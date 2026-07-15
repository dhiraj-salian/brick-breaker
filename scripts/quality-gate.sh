#!/usr/bin/env bash
# Pre-commit / pre-push quality gate for brick-breaker.
#
# Runs all checks that the CI workflow runs. If any fail, the git
# operation is blocked. Designed to be fast (caches nothing, but the
# checks themselves are < 5s each on this project).
#
# Used by .git/hooks/pre-commit and .git/hooks/pre-push.
#
# Levels:
#   --quick    lint + unit tests only (~3s). Used by pre-commit.
#   --full     lint + unit + worker + build (~10s). Used by pre-push.

set -euo pipefail

LEVEL="${1:---full}"

echo ""
echo "========================================"
echo "  Quality gate (${LEVEL#--})"
echo "========================================"

# 1. Lint (eslint + prettier)
echo "→ Lint (eslint + prettier)..."
npm run lint --silent

# 2. Unit tests
echo "→ Unit tests..."
npm run test:unit --silent

# 3. Worker tests (only on full)
if [[ "$LEVEL" == "--full" ]]; then
  echo "→ Worker tests..."
  npm run test:worker --silent

  echo "→ Build (Vite production bundle)..."
  npm run build --silent
fi

echo ""
echo "✓ All checks passed."
echo ""
