@echo off
cd /d "%~dp0"
echo ========================================================
echo Running Automated Backend Test Suite (Pytest)
echo ========================================================
echo.
backend\venv\Scripts\pytest backend\tests\test_api.py -v -W ignore
echo.
echo ========================================================
pause
