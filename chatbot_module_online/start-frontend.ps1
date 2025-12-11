# PowerShell script to start the Next.js frontend
# Run this from the root directory

Write-Host "Starting Next.js Frontend..." -ForegroundColor Green

# Change to frontend_latest directory
$frontendDir = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $frontendDir "frontend_latest"
Set-Location $frontendDir

Write-Host "Frontend directory: $frontendDir" -ForegroundColor Cyan
Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan

# Start Next.js
npm run dev


