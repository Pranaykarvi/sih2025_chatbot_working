# Debugging Backend Connection Issue

## Problem
The frontend is getting "Cannot POST /chat/ask" error, which means the backend server on port 8000 is either:
1. Not running the FastAPI app
2. Running a different/older version
3. Being blocked by a proxy or different service

## Solution Steps

### Step 1: Stop Existing Processes on Port 8000

**Option A - Using PowerShell:**
```powershell
# Find processes using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Get-Process -Id $_ }

# Stop the processes (replace PID with actual process IDs from netstat)
Stop-Process -Id <PID> -Force
```

**Option B - Using Command Prompt:**
```cmd
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Step 2: Start the FastAPI Backend

From the `chatbot-backend` directory:

```bash
# Option 1: Using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Option 2: Using docker-compose (if using Docker)
docker-compose up --build

# Option 3: Using Python directly
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Verify Backend is Running Correctly

Test the endpoints:

```powershell
# Health check (should return {"status":"ok"})
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing

# Check if FastAPI docs are accessible
Invoke-WebRequest -Uri http://localhost:8000/docs -UseBasicParsing

# Test chat endpoint
$body = @{patient_id='test'; question='test'} | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:8000/chat/ask -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
```

### Step 4: Check Backend Logs

When you make a request, check the backend terminal for:
- Any error messages
- Request logs
- Exception traces

### Common Issues

1. **Multiple services on port 8000**: Make sure only one backend service is running
2. **Wrong backend running**: Ensure you're running the updated FastAPI backend with `sync_router` registered
3. **Environment variables missing**: Make sure `.env` file is in `chatbot-backend` directory with all required keys
4. **Dependencies not installed**: Run `pip install -r requirements.txt` in `chatbot-backend` directory

## Expected FastAPI Response Format

- `/health` should return: `{"status":"ok"}` (not wrapped)
- `/docs` should return the FastAPI interactive documentation page
- `/chat/ask` should accept POST requests with JSON body


