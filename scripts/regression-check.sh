#!/bin/bash
# ====================================================================
# PATHFINDER REGRESSION CHECK
# ====================================================================
# Run before every commit to catch known anti-patterns and drift.
# Exit code 0 = all checks pass. Non-zero = failures found.
#
# Usage:
#   bash scripts/regression-check.sh
#   # or from project root:
#   ./scripts/regression-check.sh
#
# Created v3.30.0 to prevent the recurring regression pattern where
# fixes applied to one module don't reach others.
# ====================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MODULES_DIR="$PROJECT_ROOT/modules"
SHARED_DIR="$MODULES_DIR/shared"
DOCS_DIR="$PROJECT_ROOT/docs"

FAIL=0
WARN=0

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

fail() {
  echo -e "${RED}FAIL${NC}: $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
  WARN=$((WARN + 1))
}

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
}

echo "======================================"
echo "Pathfinder Regression Check"
echo "======================================"
echo ""

# ------------------------------------------------------------------
# CHECK 1: Dead API references (Clearbit, etc.)
# Clearbit was acquired by HubSpot and shut down. This has regressed
# at least 4 times across different modules.
# ------------------------------------------------------------------
echo "--- Check 1: Dead API references ---"

# Flag NEW Clearbit usage (src=, fetch, new URL construction).
# Exclude: comments, migration fixer code (which reads old URLs to replace them),
# and string comparisons like .includes('logo.clearbit.com') used for detection.
CLEARBIT_NEW_USAGE=$(grep -rn "clearbit" "$MODULES_DIR" --include="*.html" --include="*.js" 2>/dev/null \
  | grep -vi "// .*clearbit\|/\* .*clearbit\|\* .*clearbit\|<!-- .*clearbit" \
  | grep -vi "\.includes.*clearbit\|\.replace.*clearbit\|migration\|migrated" \
  | grep -i "src=.*clearbit\|= .*clearbit\.com\|fetch.*clearbit\|new URL.*clearbit" \
  | wc -l | tr -d ' ')
if [ "$CLEARBIT_NEW_USAGE" -gt 0 ]; then
  fail "Found NEW Clearbit API usage — Clearbit is dead, use Google Favicon"
  grep -rn "clearbit" "$MODULES_DIR" --include="*.html" --include="*.js" 2>/dev/null \
    | grep -vi "// \|/\* \|\* \|<!-- \|\.includes\|\.replace\|migration\|migrated" \
    | grep -i "src=.*clearbit\|= .*clearbit\.com\|fetch.*clearbit"
else
  pass "No new Clearbit API usage (migration fixer and comments are OK)"
fi

# ------------------------------------------------------------------
# CHECK 2: Logo system duplication
# DOMAIN_OVERRIDES, getCompanyDomain, handleLogoError should ONLY
# exist in shared/logos.js. Any inline copy is a regression risk.
# ------------------------------------------------------------------
echo ""
echo "--- Check 2: Logo system duplication ---"

# Check that shared/logos.js exists
if [ ! -f "$SHARED_DIR/logos.js" ]; then
  fail "modules/shared/logos.js does not exist — logo system must be shared"
else
  pass "shared/logos.js exists"
fi

# Check for inline DOMAIN_OVERRIDES in module HTML files (should only be in shared/logos.js)
INLINE_OVERRIDES=$(grep -r "DOMAIN_OVERRIDES" "$MODULES_DIR" --include="*.html" -l 2>/dev/null | wc -l | tr -d ' ')
if [ "$INLINE_OVERRIDES" -gt 0 ]; then
  fail "Found inline DOMAIN_OVERRIDES in $INLINE_OVERRIDES module(s) — should only be in shared/logos.js"
  grep -r "DOMAIN_OVERRIDES" "$MODULES_DIR" --include="*.html" -l 2>/dev/null
else
  pass "No inline DOMAIN_OVERRIDES (all in shared/logos.js)"
fi

# Check for inline getCompanyDomain function definitions
INLINE_DOMAIN_FN=$(grep -r "function getCompanyDomain" "$MODULES_DIR" --include="*.html" -l 2>/dev/null | wc -l | tr -d ' ')
if [ "$INLINE_DOMAIN_FN" -gt 0 ]; then
  fail "Found inline getCompanyDomain() in $INLINE_DOMAIN_FN module(s) — should only be in shared/logos.js"
  grep -r "function getCompanyDomain" "$MODULES_DIR" --include="*.html" -l 2>/dev/null
else
  pass "No inline getCompanyDomain() (all in shared/logos.js)"
fi

# Check for inline handleLogoError function definitions
INLINE_LOGO_ERR=$(grep -r "function handleLogoError" "$MODULES_DIR" --include="*.html" -l 2>/dev/null | wc -l | tr -d ' ')
if [ "$INLINE_LOGO_ERR" -gt 0 ]; then
  fail "Found inline handleLogoError() in $INLINE_LOGO_ERR module(s) — should only be in shared/logos.js"
  grep -r "function handleLogoError" "$MODULES_DIR" --include="*.html" -l 2>/dev/null
else
  pass "No inline handleLogoError() (all in shared/logos.js)"
fi

# Check that modules using SHARED logo functions import logos.js
# Only flag functions unique to the shared system (handleLogoError, companyLogoHtml,
# DOMAIN_OVERRIDES, guessDomain). Some modules (Calendar, Dashboard) have their own
# simpler getCompanyLogoUrl with different signatures — those are OK.
for MODULE_HTML in "$MODULES_DIR"/*/index.html; do
  MODULE_NAME=$(basename "$(dirname "$MODULE_HTML")")
  if grep -q "handleLogoError\|companyLogoHtml\|DOMAIN_OVERRIDES\|guessDomain" "$MODULE_HTML" 2>/dev/null; then
    if ! grep -q "logos.js" "$MODULE_HTML" 2>/dev/null; then
      fail "$MODULE_NAME uses shared logo functions but doesn't import shared/logos.js"
    else
      pass "$MODULE_NAME imports shared/logos.js"
    fi
  fi
done

# ------------------------------------------------------------------
# CHECK 3: Shared file imports consistency
# All modules should import pathfinder.css and data-layer.js
# ------------------------------------------------------------------
echo ""
echo "--- Check 3: Shared file imports ---"

for MODULE_HTML in "$MODULES_DIR"/*/index.html; do
  MODULE_NAME=$(basename "$(dirname "$MODULE_HTML")")
  [ "$MODULE_NAME" = "shared" ] && continue

  if ! grep -q "pathfinder.css" "$MODULE_HTML" 2>/dev/null; then
    fail "$MODULE_NAME missing pathfinder.css import"
  fi

  if ! grep -q "data-layer.js" "$MODULE_HTML" 2>/dev/null; then
    # research-brief intentionally omits data-layer — it's stateless
    if [ "$MODULE_NAME" != "research-brief" ]; then
      warn "$MODULE_NAME missing data-layer.js import"
    fi
  fi
done
pass "Shared file imports checked across all modules"

# ------------------------------------------------------------------
# CHECK 4: Bare JSON.parse(localStorage) — must use safeJsonParse
# ------------------------------------------------------------------
echo ""
echo "--- Check 4: Bare JSON.parse(localStorage) ---"

BARE_PARSE=$(grep -rn "JSON\.parse(localStorage" "$MODULES_DIR" --include="*.html" 2>/dev/null | grep -v "safeJsonParse" | grep -v "function safeJsonParse" | grep -v "// Demo pattern" | wc -l | tr -d ' ')
if [ "$BARE_PARSE" -gt 0 ]; then
  warn "Found $BARE_PARSE bare JSON.parse(localStorage) call(s) — should use safeJsonParse()"
  grep -rn "JSON\.parse(localStorage" "$MODULES_DIR" --include="*.html" 2>/dev/null | grep -v "safeJsonParse" | grep -v "function safeJsonParse" | head -10
else
  pass "No bare JSON.parse(localStorage) calls"
fi

# ------------------------------------------------------------------
# CHECK 5: console.log statements (should use warn/error only)
# ------------------------------------------------------------------
echo ""
echo "--- Check 5: console.log usage ---"

LOG_COUNT=$(grep -rn "console\.log(" "$MODULES_DIR" --include="*.html" --include="*.js" 2>/dev/null | grep -v "shared/" | wc -l | tr -d ' ')
if [ "$LOG_COUNT" -gt 0 ]; then
  warn "Found $LOG_COUNT console.log() call(s) — consider console.warn/error for production"
else
  pass "No console.log() calls"
fi

# ------------------------------------------------------------------
# CHECK 6: Version sync — PRD, CHANGELOG, CLAUDE_CONTEXT must match
# ------------------------------------------------------------------
echo ""
echo "--- Check 6: Version sync ---"

PRD_VERSION=$(grep -m1 "Status.*v[0-9]" "$DOCS_DIR/PRD.md" 2>/dev/null | grep -oP 'v[\d.]+' | head -1)
CL_VERSION=$(grep -m1 "## v[0-9]" "$PROJECT_ROOT/CHANGELOG.md" 2>/dev/null | grep -oP 'v[\d.]+' | head -1)
CTX_VERSION=$(grep -m1 "Current Version.*v[0-9]" "$PROJECT_ROOT/CLAUDE_CONTEXT.md" 2>/dev/null | grep -oP 'v[\d.]+' | head -1)

echo "  PRD.md:           ${PRD_VERSION:-NOT FOUND}"
echo "  CHANGELOG.md:     ${CL_VERSION:-NOT FOUND}"
echo "  CLAUDE_CONTEXT.md: ${CTX_VERSION:-NOT FOUND}"

if [ "$PRD_VERSION" = "$CL_VERSION" ] && [ "$CL_VERSION" = "$CTX_VERSION" ]; then
  pass "All three version references match ($PRD_VERSION)"
else
  fail "Version mismatch: PRD=$PRD_VERSION, CHANGELOG=$CL_VERSION, CONTEXT=$CTX_VERSION"
fi

# ------------------------------------------------------------------
# CHECK 7: TODO/FIXME/HACK comments
# ------------------------------------------------------------------
echo ""
echo "--- Check 7: TODO/FIXME/HACK comments ---"

TODO_COUNT=$(grep -rn "TODO\|FIXME\|HACK" "$MODULES_DIR" --include="*.html" --include="*.js" 2>/dev/null | grep -v "shared/" | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  warn "Found $TODO_COUNT TODO/FIXME/HACK comment(s)"
  grep -rn "TODO\|FIXME\|HACK" "$MODULES_DIR" --include="*.html" --include="*.js" 2>/dev/null | grep -v "shared/" | head -5
else
  pass "No TODO/FIXME/HACK comments"
fi

# ------------------------------------------------------------------
# CHECK 8: Script tag balance (open vs close)
# ------------------------------------------------------------------
echo ""
echo "--- Check 8: Script tag balance ---"

# Count actual HTML script tags. Since modules are single-file HTML, script tags
# appear at the top level (not inside JS strings at beginning of line).
# We count <script on lines starting with whitespace/<, and </script> similarly.
# Note: some </script> tags appear on same line as <script src="..."></script>
# so we count them together.
SCRIPT_FAIL=0
for MODULE_HTML in "$MODULES_DIR"/*/index.html; do
  MODULE_NAME=$(basename "$(dirname "$MODULE_HTML")")
  [ "$MODULE_NAME" = "shared" ] && continue
  # Use a Python one-liner for reliable counting: only count actual HTML tags,
  # not regex patterns inside JS strings
  BALANCE=$(python3 -c "
import re, sys
html = open(sys.argv[1]).read()
# Remove JS string literals that contain script tags (regex patterns)
# by only counting tags that are on lines starting with whitespace + <
lines = html.split('\n')
opens = 0; closes = 0
for line in lines:
    stripped = line.strip()
    # Count opens: line starts with <script (actual HTML tag)
    if stripped.startswith('<script'):
        opens += 1
    # Count closes on any line (they can be inline like <script src=...></script>)
    closes += stripped.count('</script>')
print(f'{opens},{closes}')
" "$MODULE_HTML" 2>/dev/null)
  OPEN=$(echo "$BALANCE" | cut -d, -f1)
  CLOSE=$(echo "$BALANCE" | cut -d, -f2)
  if [ "$OPEN" -ne "$CLOSE" ]; then
    fail "$MODULE_NAME: script tags unbalanced (open=$OPEN, close=$CLOSE)"
    SCRIPT_FAIL=1
  fi
done
if [ "$SCRIPT_FAIL" -eq 0 ]; then
  pass "Script tags balanced in all modules"
fi

# ------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------
echo ""
echo "======================================"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}$FAIL FAILURE(S)${NC}, $WARN warning(s)"
  echo "Fix failures before committing."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}$WARN WARNING(S)${NC}, 0 failures"
  echo "Warnings are advisory — commit is safe but consider fixing."
  exit 0
else
  echo -e "${GREEN}ALL CHECKS PASSED${NC}"
  exit 0
fi
