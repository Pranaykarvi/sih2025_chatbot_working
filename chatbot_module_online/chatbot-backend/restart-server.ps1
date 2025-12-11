# Restart the backend server with proper reload
Write-Host "Restarting FastAPI Backend Server..." -ForegroundColor Green

# Kill existing processes on port 8000
$processes = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($processes) {
    Write-Host "Stopping existing processes on port 8000..." -ForegroundColor Yellow
    $processes | ForEach-Object { 
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "Starting backend server with reload..." -ForegroundColor Cyan
Set-Location $PSScriptRoot

# Start server with reload flag
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


