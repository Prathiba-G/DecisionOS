@echo off
echo ========================================================
echo   DECISIONOS - Evidence-Backed AI Decision Intelligence
echo   Hackathon Track: PS-04
echo ========================================================
echo.

echo [1/3] Initializing SQLite database and verifying seed data...
cd backend
python -m app.seed_data
python -m app.database
if %ERRORLEVEL% NEQ 0 (
    echo Error initializing database.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting DecisionOS Backend (FastAPI on http://127.0.0.1:8000)...
start "DecisionOS Backend" cmd /k "python run.py"

cd ..\frontend
echo.
echo [3/3] Starting DecisionOS Frontend (Vite on http://localhost:5173)...
start "DecisionOS Frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo   DecisionOS is now running!
echo   Frontend: http://localhost:5173
echo   Backend API: http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
