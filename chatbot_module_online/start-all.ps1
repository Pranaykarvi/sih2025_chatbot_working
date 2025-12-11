# PowerShell script to start both backend and frontend
# Opens them in separate terminal windows

Write-Host "Starting Chatbot Application..." -ForegroundColor Green
Write-Host "Backend will run in a new terminal window" -ForegroundColor Yellow
Write-Host "Frontend will run in another terminal window" -ForegroundColor Yellow

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start backend in new window
$backendScript = Join-Path $scriptRoot "start-backend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$backendScript'"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend in new window
$frontendScript = Join-Path $scriptRoot "start-frontend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$frontendScript'"

Write-Host "`nBoth services starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nPress any key to exit this window (services will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


