#!/bin/bash
# ================================================================
# Pathfinder Startup Script
# ================================================================
# Starts all Pathfinder services:
#   1. HTTP static file server (port 8080) — serves browser modules
#   2. MCP HTTP bridge (port 3456) — data persistence + Claude API
#
# Usage:
#   ./start.sh          Start all services
#   ./start.sh stop     Stop all services
#   ./start.sh status   Check if services are running
#   ./start.sh restart  Stop then start
#
# First run: automatically builds MCP server if dist/ doesn't exist
# ================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$PROJECT_ROOT/mcp-servers/pathfinder-artifacts-mcp"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/.logs"

HTTP_PORT=8080
BRIDGE_PORT=3456

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No color

# ================================================================
# HELPERS
# ================================================================

ensure_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

log_info() {
  echo -e "${BLUE}[Pathfinder]${NC} $1"
}

log_ok() {
  echo -e "${GREEN}[Pathfinder]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[Pathfinder]${NC} $1"
}

log_error() {
  echo -e "${RED}[Pathfinder]${NC} $1"
}

is_running() {
  local pid_file="$PID_DIR/$1.pid"
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    # Stale PID file — clean up
    rm -f "$pid_file"
  fi
  return 1
}

wait_for_port() {
  local port=$1
  local name=$2
  local max_attempts=20
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null | grep -qE "200|404|405"; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.5
  done
  return 1
}

# ================================================================
# BUILD MCP SERVER (if needed)
# ================================================================

build_mcp() {
  if [ ! -d "$MCP_DIR/dist" ]; then
    log_info "Building MCP server (first run)..."
    cd "$MCP_DIR"

    # Install deps if needed
    if [ ! -d "node_modules" ] || [ ! -d "node_modules/typescript" ]; then
      log_info "Installing dependencies..."
      npm install 2>&1 | tail -3
    fi

    # Build TypeScript
    log_info "Compiling TypeScript..."
    npx tsc 2>&1
    if [ $? -eq 0 ]; then
      log_ok "MCP server built successfully"
    else
      log_error "MCP build failed. Check $MCP_DIR for errors."
      exit 1
    fi
    cd "$PROJECT_ROOT"
  fi
}

# ================================================================
# START SERVICES
# ================================================================

start_http() {
  if is_running "http"; then
    log_warn "HTTP server already running (PID $(cat $PID_DIR/http.pid))"
    return 0
  fi

  log_info "Starting HTTP server on port $HTTP_PORT..."
  cd "$PROJECT_ROOT"
  python3 -m http.server "$HTTP_PORT" > "$LOG_DIR/http.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/http.pid"

  if wait_for_port "$HTTP_PORT" "HTTP"; then
    log_ok "HTTP server running → http://localhost:$HTTP_PORT/modules/dashboard/index.html (PID $pid)"
  else
    log_error "HTTP server failed to start. Check $LOG_DIR/http.log"
    return 1
  fi
}

start_bridge() {
  if is_running "bridge"; then
    log_warn "MCP bridge already running (PID $(cat $PID_DIR/bridge.pid))"
    return 0
  fi

  # Build if needed
  build_mcp

  log_info "Starting MCP HTTP bridge on port $BRIDGE_PORT..."
  cd "$MCP_DIR"

  # Use tsx for dev (TypeScript directly) if dist doesn't exist, otherwise use compiled JS
  if [ -d "$MCP_DIR/dist" ]; then
    node dist/bridge-standalone.js > "$LOG_DIR/bridge.log" 2>&1 &
  else
    npx tsx src/bridge-standalone.ts > "$LOG_DIR/bridge.log" 2>&1 &
  fi
  local pid=$!
  echo "$pid" > "$PID_DIR/bridge.pid"
  cd "$PROJECT_ROOT"

  if wait_for_port "$BRIDGE_PORT" "Bridge"; then
    log_ok "MCP bridge running → http://localhost:$BRIDGE_PORT (PID $pid)"
  else
    log_error "MCP bridge failed to start. Check $LOG_DIR/bridge.log"
    return 1
  fi
}

start_all() {
  ensure_dirs
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Pathfinder v3.20.6 — Starting services${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Ensure ~/.pathfinder/data exists for MCP persistence
  mkdir -p "$HOME/.pathfinder/data"
  mkdir -p "$HOME/.pathfinder/backups"
  mkdir -p "$HOME/.pathfinder/artifacts"

  start_bridge
  start_http

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  All services running${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  App:    ${BLUE}http://localhost:$HTTP_PORT/modules/dashboard/index.html${NC}"
  echo -e "  Bridge: ${BLUE}http://localhost:$BRIDGE_PORT${NC}"
  echo -e "  Logs:   $LOG_DIR/"
  echo ""
  echo -e "  Stop:   ${YELLOW}./start.sh stop${NC}"
  echo -e "  Status: ${YELLOW}./start.sh status${NC}"
  echo ""
}

# ================================================================
# STOP SERVICES
# ================================================================

stop_service() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 0.5
      # Force kill if still alive
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
      fi
      log_ok "Stopped $name (PID $pid)"
    else
      log_warn "$name was not running (stale PID $pid)"
    fi
    rm -f "$pid_file"
  else
    log_warn "$name is not running"
  fi
}

stop_all() {
  echo ""
  log_info "Stopping all services..."
  stop_service "http"
  stop_service "bridge"
  echo ""
}

# ================================================================
# STATUS CHECK
# ================================================================

status_all() {
  echo ""
  echo -e "${BLUE}Pathfinder Service Status${NC}"
  echo "─────────────────────────────────────"

  if is_running "http"; then
    echo -e "  HTTP Server (port $HTTP_PORT):  ${GREEN}● running${NC} (PID $(cat $PID_DIR/http.pid))"
  else
    echo -e "  HTTP Server (port $HTTP_PORT):  ${RED}○ stopped${NC}"
  fi

  if is_running "bridge"; then
    echo -e "  MCP Bridge  (port $BRIDGE_PORT): ${GREEN}● running${NC} (PID $(cat $PID_DIR/bridge.pid))"
    # Health check
    local health=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BRIDGE_PORT/health" 2>/dev/null)
    if [ "$health" = "200" ]; then
      echo -e "  Bridge health:                ${GREEN}● healthy${NC}"
    else
      echo -e "  Bridge health:                ${YELLOW}● degraded (HTTP $health)${NC}"
    fi
  else
    echo -e "  MCP Bridge  (port $BRIDGE_PORT): ${RED}○ stopped${NC}"
  fi

  # Check MCP build
  if [ -d "$MCP_DIR/dist" ]; then
    echo -e "  MCP Build:                    ${GREEN}● compiled${NC}"
  else
    echo -e "  MCP Build:                    ${YELLOW}○ needs build${NC}"
  fi

  # Check data dir
  local data_count=$(ls "$HOME/.pathfinder/data/" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  Data keys:                    ${BLUE}$data_count files${NC} in ~/.pathfinder/data/"

  echo "─────────────────────────────────────"
  echo ""
}

# ================================================================
# MAIN
# ================================================================

case "${1:-start}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  build)
    build_mcp
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|build}"
    exit 1
    ;;
esac
