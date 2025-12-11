# How to Start Backend and Frontend

## ✅ Routes Verified
All routes are correctly registered:
- `/embed/pdf` [POST] ✓
- `/chat/ask` [POST] ✓  
- `/health` [GET] ✓

## Quick Start

### Option 1: Start Everything at Once (Recommended)

From the **root directory** of the project:
```powershell
.\start-all.ps1
```

This will:
- Stop any processes on port 8000
- Start backend in a new terminal window
- Start frontend in another new terminal window

### Option 2: Start Manually

#### Step 1: Start Backend

**Option A - Using PowerShell:**
```powershell
cd chatbot-backend
.\start-server.bat
```

**Option B - Using Command Line:**
```bash
cd chatbot-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Option C - Using Python Module:**
```bash
cd chatbot-backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify Backend is Running:**
- Visit `http://localhost:8000/docs` - Should show FastAPI Swagger UI
- Visit `http://localhost:8000/health` - Should return `{"status":"ok"}`

#### Step 2: Start Frontend

**Option A - Using PowerShell:**
```powershell
cd frontend_latest
npm run dev
```

**Option B - Using npm directly:**
```bash
cd frontend_latest
npm install  # Only if not already installed
npm run dev
```

**Verify Frontend is Running:**
- Frontend will be at `http://localhost:3000` (or next available port)

## Troubleshooting

### Port 8000 Already in Use

```powershell
# Stop processes on port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Verify Routes are Registered

```powershell
cd chatbot-backend
python verify_routes.py
```

### Check if Backend is Responding

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing

# Test docs (should show Swagger UI)
Start-Process http://localhost:8000/docs
```

## Expected Results

✅ **Backend Running:**
- `http://localhost:8000` - API server
- `http://localhost:8000/docs` - FastAPI Swagger UI
- `http://localhost:8000/health` - Returns `{"status":"ok"}`

✅ **Frontend Running:**
- `http://localhost:3000` (or 3001, 3002, etc.)
- Should show the ArogyaLink chatbot interface

✅ **Upload Working:**
- Upload PDFs via the frontend
- Should see `[Upload API] Proxying to backend` logs
- Should see `Upload successful` message

✅ **Chat Working:**
- Enter Patient ID and question
- Should get AI responses with sources

## Environment Variables

### Backend (chatbot-backend/.env)
Required:
- `COHERE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

### Frontend (frontend_latest/.env.local)
Optional (defaults to localhost:8000):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Common Issues

### "Cannot POST /embed/pdf" Error
- **Cause:** Backend not running or not restarted after code changes
- **Fix:** Restart the backend server

### Frontend can't connect to backend
- **Cause:** Backend not running or wrong URL
- **Fix:** Check `NEXT_PUBLIC_API_URL` in `frontend_latest/.env.local`

### Routes not found
- **Cause:** Server not restarted after code changes
- **Fix:** Stop and restart the backend server


