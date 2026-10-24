@echo off
cd /d "%~dp0"
echo ========================================================
echo Starting UK Wind Day-Ahead Analytics & Procurement Desk
echo ========================================================
echo Running backend on http://127.0.0.1:8000 ...
backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
