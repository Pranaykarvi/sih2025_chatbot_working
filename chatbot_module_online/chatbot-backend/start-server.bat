@echo off
echo Starting FastAPI Backend Server...
echo.

cd /d "%~dp0"

echo Checking Python...
python --version
echo.

echo Installing/updating dependencies if needed...
pip install -r ../requirements.txt --quiet
echo.

echo Starting uvicorn server on http://localhost:8000...
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause


