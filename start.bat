@echo off
title Moil Primary School — IT Asset Tracker

echo.
echo  ==========================================
echo   Moil Primary School IT Asset Tracker
echo  ==========================================
echo.

:: Check Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Please install Python 3 and try again.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "venv\" (
    echo  Setting up virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo  Installing / checking dependencies...
pip install -r requirements.txt --quiet

echo.
echo  Starting server at http://localhost:5001
echo  Press Ctrl+C to stop.
echo.

start "" http://localhost:5001
python app.py

pause
