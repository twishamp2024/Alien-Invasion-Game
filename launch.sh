#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  ALIEN INVASION — Desktop Game Launcher
# ══════════════════════════════════════════════════════════════

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "   ALIEN INVASION — 3D Sci-Fi Desktop Shooter    "
echo "=================================================="

# Check node & npm
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required to run ALIEN INVASION."
  exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build production distribution if missing
if [ ! -d "dist" ]; then
  echo "Building production bundle..."
  npm run build
fi

PORT=4173

# Find free port if 4173 is busy
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "Starting local game server on port $PORT..."
npx vite preview --port $PORT --strictPort >/dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  echo "Shutting down game server (PID $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for server readiness
sleep 1.2

echo "Launching ALIEN INVASION in standalone desktop app window..."
if [ -d "/Applications/Google Chrome.app" ]; then
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --app="http://localhost:$PORT" \
    --window-size=1280,720 \
    --disable-features=Translate \
    --disable-extensions &
  APP_PID=$!
  wait $APP_PID
elif [ -d "/Applications/Brave Browser.app" ]; then
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    --app="http://localhost:$PORT" \
    --window-size=1280,720 &
  APP_PID=$!
  wait $APP_PID
else
  open "http://localhost:$PORT"
  wait $SERVER_PID
fi
