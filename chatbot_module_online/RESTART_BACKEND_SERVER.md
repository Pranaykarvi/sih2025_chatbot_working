# Fix: Backend Route 404 Errors

## Problem
Getting "Cannot POST /embed/pdf" 404 errors even though routes are registered.

## Solution: Restart the Backend Server

The routes are correctly defined in the code, but the running server process needs to be restarted to load the changes.

### Step 1: Stop the Current Server
- Find the process running on port 8000
- Press `Ctrl+C` in the terminal where uvicorn is running
- Or kill the process:
  ```powershell
  Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
  ```

### Step 2: Restart the Server
From the `chatbot-backend` directory:

```bash
# Option 1: Using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Option 2: Using docker-compose
docker-compose restart

# Option 3: Using Python module
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Verify Routes
After restart, check:
- Visit `http://localhost:8000/docs` - Should show FastAPI Swagger UI
- Check routes are listed: `/embed/pdf`, `/chat/ask`, `/health`
- Test health: `http://localhost:8000/health` should return `{"status":"ok"}`

## Note About /auth/me Requests
The logs show requests to `/auth/me` which don't exist in our routes. These are likely:
- Browser extensions making background requests
- Development tools checking for authentication
- Can be safely ignored (they return 404, which is expected)

## Verification
Once restarted, the upload should work. The error "Cannot POST /embed/pdf" is coming from a different server/interceptor that hasn't reloaded the routes.


