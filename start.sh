#!/bin/bash
set -e

WA_BRIDGE="${WA_BRIDGE_PATH:-$HOME/tools/whatsapp-mcp/whatsapp-bridge/whatsapp-bridge}"
BLINKIT_DIR="${BLINKIT_MCP_DIR:-$HOME/blinkit-mcp}"
LOG_DIR="${EVA_LOG_DIR:-$HOME/.eva/logs}"
mkdir -p "$LOG_DIR"

PIDS=()

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

start_bg() {
  local name="$1"; shift
  local port="$1"; shift
  local logfile="$LOG_DIR/$name.log"
  if [ -n "$port" ] && port_in_use "$port"; then
    echo "[$name] port $port already in use — skipping"
    return
  fi
  echo "[$name] starting → $logfile"
  ( "$@" ) >"$logfile" 2>&1 &
  local pid=$!
  PIDS+=("$pid")
  echo "[$name] pid $pid"
}

cleanup() {
  echo "Stopping services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup SIGINT SIGTERM EXIT

# 1. WhatsApp bridge (port 8080)
if [ ! -f "$WA_BRIDGE" ]; then
  echo "WhatsApp bridge not found at $WA_BRIDGE"
  echo "Build: cd ~/tools/whatsapp-mcp/whatsapp-bridge && go build -o whatsapp-bridge ."
  exit 1
fi
start_bg "wa-bridge" 8080 "$WA_BRIDGE"

# 2. Blinkit MCP (port 8000, SSE)
if [ ! -d "$BLINKIT_DIR" ]; then
  echo "Blinkit MCP dir not found at $BLINKIT_DIR"
  exit 1
fi
BLINKIT_PY="$BLINKIT_DIR/.venv/bin/python3"
if [ ! -x "$BLINKIT_PY" ]; then
  echo "Blinkit venv missing at $BLINKIT_PY — run: cd $BLINKIT_DIR && uv sync"
  exit 1
fi
start_bg "blinkit-mcp" 8000 env SERVE_HTTPS=true bash -c "cd '$BLINKIT_DIR' && exec '$BLINKIT_PY' main.py"

# 3. Inngest dev server (port 8288) — points at Next /api/inngest endpoint
start_bg "inngest" 8288 npx --yes inngest-cli@latest dev -u http://localhost:3000/api/inngest

# 4. Next dev (port 3000) — foreground so Ctrl+C kills the stack
echo "Starting Eva (Next dev)..."
if port_in_use 3000; then
  echo "[next] port 3000 already in use — aborting"
  exit 1
fi
npm run dev
