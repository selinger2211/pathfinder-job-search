#!/bin/bash
# ====================================================================
# PATHFINDER PRE-COMMIT QA GATE
# ====================================================================
# Run this BEFORE every commit. This is the mandatory QA gate.
#
# Three layers of testing:
#   Step 1: Static regression (workflow-regression.js) — BLOCKING
#   Step 2: Headless interactive QA (interactive-qa.js) — BLOCKING
#   Step 3: Documentation sync check — WARNING
#
# In the Cowork VM, git commits use the FUSE workaround which bypasses
# .git/hooks/pre-commit. This script exists so Claude (or a human)
# can run the same checks manually.
#
# On Ili's Mac, the pre-commit hook handles this automatically.
#
# Usage: bash scripts/pre-commit-qa.sh
#
# Exit codes:
#   0 = All clear, safe to commit
#   1 = Failures found, do NOT commit
# ====================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

GATE_FAILED=0

echo ""
echo "========================================"
echo -e "  ${BOLD}Pathfinder Pre-Commit QA Gate${NC}"
echo "========================================"

# ---- Step 1: Static regression test (BLOCKING) ----
echo ""
echo -e "${BOLD}${CYAN}Step 1/3: Static Regression Test${NC}"
echo "Running workflow-regression.js..."
echo ""

if ! node scripts/workflow-regression.js; then
  echo ""
  echo -e "${RED}${BOLD}BLOCKED: Static regression has failures.${NC}"
  GATE_FAILED=1
fi

# ---- Step 2: Headless interactive QA (BLOCKING) ----
echo ""
echo -e "${BOLD}${CYAN}Step 2/3: Headless Interactive QA${NC}"

if [ -f "scripts/interactive-qa.js" ]; then
  # Check if jsdom is installed
  if [ -d "node_modules/jsdom" ]; then
    echo "Running interactive-qa.js..."
    echo ""
    if ! node scripts/interactive-qa.js; then
      echo ""
      echo -e "${RED}${BOLD}BLOCKED: Interactive QA has failures.${NC}"
      GATE_FAILED=1
    fi
  else
    echo -e "${YELLOW}jsdom not installed — run 'npm install' to enable headless QA${NC}"
    echo "Skipping interactive QA (install jsdom to enable: npm install jsdom --save-dev)"
  fi
else
  echo -e "${YELLOW}interactive-qa.js not found — skipping${NC}"
fi

# ---- Step 3: Doc sync check (WARNING) ----
echo ""
echo -e "${BOLD}${CYAN}Step 3/3: Documentation Sync Check${NC}"
echo ""

MISSING_DOCS=""

# Check if CHANGELOG was updated
if ! git diff --name-only HEAD -- CHANGELOG.md 2>/dev/null | grep -q .; then
  MISSING_DOCS="$MISSING_DOCS CHANGELOG.md"
fi

# Check if PRD was updated
if ! git diff --name-only HEAD -- docs/PRD.md 2>/dev/null | grep -q .; then
  MISSING_DOCS="$MISSING_DOCS docs/PRD.md"
fi

if [ -z "$MISSING_DOCS" ]; then
  echo -e "${GREEN}CHANGELOG.md and docs/PRD.md both have changes. Good.${NC}"
else
  echo -e "${YELLOW}WARNING: These docs may need updating:${NC}"
  for doc in $MISSING_DOCS; do
    echo "  → $doc"
  done
fi

# ---- Summary ----
echo ""
echo "========================================"
if [ $GATE_FAILED -eq 1 ]; then
  echo -e "  ${RED}${BOLD}COMMIT BLOCKED — Fix failures above${NC}"
  echo "========================================"
  echo ""
  exit 1
else
  echo -e "  ${GREEN}${BOLD}Static regression: PASSED${NC}"
  echo -e "  ${GREEN}${BOLD}Headless interactive QA: PASSED${NC}"
  if [ -n "$MISSING_DOCS" ]; then
    echo -e "  ${YELLOW}Doc sync: CHECK${MISSING_DOCS}${NC}"
  else
    echo -e "  ${GREEN}${BOLD}Doc sync: OK${NC}"
  fi
  echo "========================================"
  echo ""
  exit 0
fi
