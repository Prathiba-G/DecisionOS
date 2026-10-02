#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  DECISIONOS - Evidence-Backed AI Decision Intelligence"
echo "  Hackathon Track: PS-04"
echo "========================================================"
echo ""

echo "[1/3] Initializing SQLite database and verifying seed data..."
cd backend
python -m app.seed_data
python -m app.database

echo ""
echo "[2/3] Starting DecisionOS Backend (FastAPI on http://127.0.0.1:8000)..."
python run.py &
BACKEND_PID=$!

cd ../frontend
echo ""
echo "[3/3] Starting DecisionOS Frontend (Vite on http://localhost:5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  DecisionOS is now running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://127.0.0.1:8000/docs"
echo "========================================================"
echo "Press Ctrl+C to terminate both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
