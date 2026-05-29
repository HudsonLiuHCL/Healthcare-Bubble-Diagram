#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting PostgreSQL + PostGIS (Docker)..."
docker compose up -d

echo "==> Waiting for DB to be ready..."
until docker compose exec db pg_isready -U healtharch 2>/dev/null; do sleep 1; done
echo "    DB ready."

echo "==> Starting backend (FastAPI on :7000)..."
cd "$ROOT/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 7000 &
BACKEND_PID=$!

echo "==> Starting frontend (Vite on :5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  HealthArch is running!"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:7000"
echo "  API docs:  http://localhost:7000/docs"
echo "======================================"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose stop" INT TERM
wait
