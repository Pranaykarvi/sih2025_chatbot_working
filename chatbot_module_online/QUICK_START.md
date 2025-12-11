# 🚀 Quick Start Guide

## ✅ Status
- **Backend is RUNNING** on `http://localhost:8000` ✓
- Routes verified and working ✓
- Frontend ready to start ✓

## Start Frontend (New Terminal)

Open a **new terminal/PowerShell window** and run:

```powershell
cd frontend_latest
npm run dev
```

Or use the script:
```powershell
.\start-frontend.ps1
```

## Verify Everything Works

### Backend
- ✓ `http://localhost:8000/health` → `{"status":"ok"}`
- ✓ `http://localhost:8000/docs` → FastAPI Swagger UI
- ✓ `http://localhost:8000/embed/pdf` → Available (returns validation error without file - that's normal)

### Frontend
- Open `http://localhost:3000` in browser
- Upload a PDF file
- Try asking a question

## Current Setup

### Backend (Running)
```bash
# Already started in background
# Location: http://localhost:8000
# Routes:
#   POST /embed/pdf      - Upload PDFs
#   POST /chat/ask       - Chat with AI
#   GET  /health         - Health check
```

### Frontend (Need to Start)
```bash
cd frontend_latest
npm run dev
```

## If Backend Stops

Restart it with:
```powershell
cd chatbot-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or use the batch file:
```powershell
cd chatbot-backend
.\start-server.bat
```

## Troubleshooting

**If upload still gives 404:**
1. Check backend is running: `http://localhost:8000/health`
2. Restart backend if needed
3. Check frontend logs for actual backend URL being used

**If frontend can't connect:**
1. Create `frontend_latest/.env.local` with:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
2. Restart frontend dev server


