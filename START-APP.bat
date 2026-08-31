@echo off
REM Texas Tax Sales App Launcher
REM This script starts the server and opens the app in your browser

setlocal enabledelayedexpansion

echo.
echo ====================================
echo   Texas Land & Tax Sale Finder
echo ====================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is not installed or not in PATH
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo Starting server...
echo.

REM Navigate to the app directory
cd /d "%~dp0app" || (
    echo ERROR: Could not find app directory
    pause
    exit /b 1
)

REM Start the server in a new window
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak

REM Open the browser
start http://localhost:8000

REM Run the server
echo.
echo ====================================
echo Server running on http://localhost:8000
echo ====================================
echo.
echo Press Ctrl+C to stop the server
echo.

python server.py
