@echo off
cd /d "%~dp0"
echo Starting Backend and Frontend together...
start "UK Wind Desk - Backend" cmd /k "backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 2 /nobreak >nul
start "UK Wind Desk - Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Both services launched!
echo - Web App: http://localhost:5173 or http://127.0.0.1:8000
echo - Swagger API Docs: http://127.0.0.1:8000/docs
echo.
pause
