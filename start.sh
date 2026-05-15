#!/bin/bash
set -e

WA_BRIDGE="${WA_BRIDGE_PATH:-$HOME/tools/whatsapp-mcp/whatsapp-bridge/whatsapp-bridge}"

if [ ! -f "$WA_BRIDGE" ]; then
  echo "WhatsApp bridge not found at $WA_BRIDGE"
  echo "Run: cd ~/tools/whatsapp-mcp/whatsapp-bridge && go build -o whatsapp-bridge ."
  echo "Then scan the QR code: ./whatsapp-bridge"
  exit 1
fi

echo "Starting WhatsApp bridge..."
"$WA_BRIDGE" &
WA_PID=$!
echo "WhatsApp bridge PID: $WA_PID"

cleanup() {
  echo "Stopping WhatsApp bridge ($WA_PID)..."
  kill "$WA_PID" 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

echo "Starting Eva..."
npm run dev
