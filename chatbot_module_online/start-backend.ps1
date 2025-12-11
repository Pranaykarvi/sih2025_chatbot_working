# PowerShell script to start the FastAPI backend server
# Run this from the chatbot-backend directory

Write-Host "Starting FastAPI Backend Server..." -ForegroundColor Green

# Check if port 8000 is in use
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 8000 is in use. Stopping existing processes..." -ForegroundColor Yellow
    Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { 
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# Change to chatbot-backend directory
$backendDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $backendDir "chatbot-backend"
Set-Location $backendDir

Write-Host "Backend directory: $backendDir" -ForegroundColor Cyan
Write-Host "Starting uvicorn server on http://localhost:8000..." -ForegroundColor Cyan

# Start uvicorn with reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


