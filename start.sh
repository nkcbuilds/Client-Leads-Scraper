#!/usr/bin/env bash
set -e

echo "Starting LegalReach..."

if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

mkdir -p backend/data backend/logs backend/output

if [ ! -f ".env" ]; then
  echo "Copying .env.example to .env..."
  cp .env.example .env
fi

echo ""
echo "Starting backend on http://localhost:3001"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 3

echo "Starting frontend on http://localhost:3000"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "LegalReach is running. Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait