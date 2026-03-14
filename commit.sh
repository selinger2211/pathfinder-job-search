#!/bin/bash
# ================================================================
# Pathfinder Commit Helper
# ================================================================
# Use this instead of raw git commands from the VM.
# Cleans lock files before and after every operation.
#
# Usage:
#   ./commit.sh "commit message here"
#   ./commit.sh status
#   ./commit.sh push
# ================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

clean_locks() {
  find .git -name "*.lock" -delete 2>/dev/null || true
  find .git/objects -name "tmp_obj_*" -delete 2>/dev/null || true
}

case "${1:-help}" in
  status)
    clean_locks
    git status
    clean_locks
    ;;
  push)
    clean_locks
    git push
    clean_locks
    ;;
  log)
    clean_locks
    git log --oneline -10
    clean_locks
    ;;
  help)
    echo "Usage:"
    echo "  ./commit.sh \"message\"   Commit all staged + modified tracked files"
    echo "  ./commit.sh status      Show git status"
    echo "  ./commit.sh push        Push to remote"
    echo "  ./commit.sh log         Show recent commits"
    ;;
  *)
    # Treat as commit message
    clean_locks
    git add -A
    git commit -m "$1

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
    clean_locks
    echo ""
    echo "Committed. Run './commit.sh push' to push."
    ;;
esac
