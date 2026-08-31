#!/usr/bin/env pwsh
# Texas Tax Sales App Launcher (PowerShell)
# This script starts the server and opens the app in your browser

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================="
Write-Host "  Texas Land & Tax Sale Finder"
Write-Host "===================================="
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion"
} catch {
    Write-Host "ERROR: Python 3 is not installed or not in PATH"
    Write-Host ""
    Write-Host "Please install Python from: https://www.python.org/downloads/"
    Write-Host "Make sure to check 'Add Python to PATH' during installation"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting server..."
Write-Host ""

# Navigate to app directory
$appDir = Join-Path $PSScriptRoot "app"
if (-not (Test-Path $appDir)) {
    Write-Host "ERROR: Could not find app directory at $appDir"
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $appDir

Write-Host "Opening browser in 3 seconds..."
Start-Sleep -Seconds 3

# Open the browser
Start-Process "http://localhost:8000"

Write-Host ""
Write-Host "===================================="
Write-Host "Server running on http://localhost:8000"
Write-Host "===================================="
Write-Host ""
Write-Host "Press Ctrl+C in this window to stop the server"
Write-Host ""

# Run the server
python server.py
