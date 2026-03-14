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
# Uses tsx to run TypeScript directly (no tsc build needed).
# ================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$PROJECT_ROOT/mcp-servers/pathfinder-artifacts-mcp"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/.logs"

HTTP_PORT=8080
BRIDGE_PORT=3456

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ================================================================
# HELPERS
# ================================================================

ensure_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
  mkdir -p "$HOME/.pathfinder/data"
  mkdir -p "$HOME/.pathfinder/backups"
  mkdir -p "$HOME/.pathfinder/artifacts"
}

log_info()  { echo -e "${BLUE}[Pathfinder]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[Pathfinder]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[Pathfinder]${NC} $1"; }
log_error() { echo -e "${RED}[Pathfinder]${NC} $1"; }

is_running() {
  local pid_file="$PID_DIR/$1.pid"
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
}

wait_for_port() {
  local port=$1
  local max_attempts=30
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

kill_port() {
  local port=$1
  lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null || true
}

# ================================================================
# START SERVICES
# ================================================================

start_http() {
  if is_running "http"; then
    log_warn "HTTP server already running (PID $(cat $PID_DIR/http.pid))"
    return 0
  fi

  # Kill anything already on the port
  kill_port "$HTTP_PORT"

  log_info "Starting HTTP server on port $HTTP_PORT..."
  cd "$PROJECT_ROOT"
  python3 -m http.server "$HTTP_PORT" > "$LOG_DIR/http.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/http.pid"

  if wait_for_port "$HTTP_PORT"; then
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

  # Kill anything already on the port
  kill_port "$BRIDGE_PORT"

  cd "$MCP_DIR"

  # Install deps if needed
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/tsx" ]; then
    log_info "Installing MCP dependencies..."
    npm install 2>&1 | tail -3
  fi

  # Run TypeScript directly with tsx — no build step needed
  log_info "Starting MCP HTTP bridge on port $BRIDGE_PORT..."
  npx tsx src/bridge-standalone.ts > "$LOG_DIR/bridge.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/bridge.pid"
  cd "$PROJECT_ROOT"

  if wait_for_port "$BRIDGE_PORT"; then
    log_ok "MCP bridge running → http://localhost:$BRIDGE_PORT (PID $pid)"
  else
    log_error "MCP bridge failed to start. Check $LOG_DIR/bridge.log"
    cat "$LOG_DIR/bridge.log" 2>/dev/null | tail -10
    return 1
  fi
}

start_all() {
  ensure_dirs
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Pathfinder — Starting services${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Start HTTP first — app should always be available
  start_http

  # Start bridge — data persistence layer
  start_bridge || log_warn "Bridge failed but app is still available (localStorage-only mode)"

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Ready${NC}"
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
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
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
  # Also kill any orphaned processes on our ports
  kill_port "$HTTP_PORT"
  kill_port "$BRIDGE_PORT"
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
    local health=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BRIDGE_PORT/health" 2>/dev/null)
    if [ "$health" = "200" ]; then
      echo -e "  Bridge health:                ${GREEN}● healthy${NC}"
    else
      echo -e "  Bridge health:                ${YELLOW}● degraded (HTTP $health)${NC}"
    fi
  else
    echo -e "  MCP Bridge  (port $BRIDGE_PORT): ${RED}○ stopped${NC}"
  fi

  local data_count=$(ls "$HOME/.pathfinder/data/" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  Data keys:                    ${BLUE}$data_count files${NC} in ~/.pathfinder/data/"

  echo "─────────────────────────────────────"
  echo ""
}

# ================================================================
# MAIN
# ================================================================

case "${1:-start}" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; start_all ;;
  status)  status_all ;;
  *)       echo "Usage: $0 {start|stop|restart|status}" ; exit 1 ;;
esac
