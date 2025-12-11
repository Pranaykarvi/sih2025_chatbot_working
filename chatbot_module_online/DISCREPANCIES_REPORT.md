# Discrepancies Report: Frontend-Latest vs Backend

## 🔴 Critical Issues

### 1. Backend Router Registration Missing
**Location:** `chatbot-backend/app/main.py`

**Issue:** `sync_router` is defined and exported but NOT registered in the FastAPI app.

**Current Code:**
```python
from app.routers import embed_router, chat_router
# ... missing sync_router
app.include_router(embed_router.router)
app.include_router(chat_router.router)
# Missing: app.include_router(sync_router.router)
```

**Impact:** The `/sync/ingest` endpoint documented in README is not available.

**Fix Required:** Add `sync_router` import and registration.

---

### 2. Hardcoded Backend URLs in Frontend

#### A. Chat API - Production URL Hardcoded
**Location:** `frontend_latest/app/api/ask/route.ts` (line 8)

**Current:**
```typescript
const backendRes = await fetch("https://sih2025-chatbot-working.onrender.com/chat/ask", {
```

**Issue:** Hardcoded production URL breaks local development and doesn't support environment-based configuration.

**Impact:** Cannot test locally without modifying code.

---

#### B. Upload API - Localhost Hardcoded
**Location:** `frontend_latest/components/upload-panel.tsx` (line 55)

**Current:**
```typescript
const res = await fetch("http://127.0.0.1:8000/embed/pdf", {
```

**Issue:** Hardcoded localhost won't work in production environment.

**Impact:** Upload functionality fails in production.

---

### 3. Unused Upload API Route
**Location:** `frontend_latest/app/api/upload/route.ts`

**Issue:** The Next.js API route exists but only returns mock data. The `upload-panel.tsx` component bypasses it and calls the backend directly.

**Impact:** Inconsistent architecture pattern.

---

## ⚠️ Architecture Inconsistencies

### 4. Mixed API Calling Patterns

**Chat Flow:**
```
Frontend Component → Next.js API Route (/api/ask) → Backend FastAPI
```

**Upload Flow:**
```
Frontend Component → Backend FastAPI (direct)
```

**Issue:** Inconsistent patterns. Should standardize on one approach:
- Option A: Use Next.js API routes as proxy for both (recommended)
- Option B: Call backend directly from both components

---

## 📋 Summary

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Missing sync_router registration | High | `chatbot-backend/app/main.py` | `/sync/ingest` endpoint unavailable |
| Hardcoded production URL | High | `frontend_latest/app/api/ask/route.ts` | Local development broken |
| Hardcoded localhost URL | High | `frontend_latest/components/upload-panel.tsx` | Production uploads fail |
| Unused upload route | Medium | `frontend_latest/app/api/upload/route.ts` | Code duplication |
| Inconsistent API patterns | Medium | Multiple files | Maintenance burden |

---

## ✅ FIXES APPLIED

All issues have been resolved:

### 1. ✅ Backend Router Registration - FIXED
**File:** `chatbot-backend/app/main.py`
- Added `sync_router` import
- Registered `sync_router.router` in FastAPI app
- `/sync/ingest` endpoint is now available

### 2. ✅ Environment Variable Support - FIXED
**Files:** 
- `frontend_latest/app/api/ask/route.ts`
- `frontend_latest/app/api/upload/route.ts`

**Changes:**
- Both API routes now use `process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8000"`
- Supports both `NEXT_PUBLIC_API_URL` (client-accessible) and `API_URL` (server-only)
- Falls back to localhost for local development

### 3. ✅ Upload API Route - FIXED
**File:** `frontend_latest/app/api/upload/route.ts`
- Updated to actually proxy requests to backend `/embed/pdf` endpoint
- Uses environment variable for backend URL
- Properly handles FormData and error responses

### 4. ✅ Standardized API Pattern - FIXED
**File:** `frontend_latest/components/upload-panel.tsx`
- Changed from direct backend call to using Next.js API route `/api/upload`
- Both chat and upload now follow the same pattern: Frontend → Next.js API Route → Backend

---

## 📝 Environment Variables Required

### Frontend (frontend_latest)

Create `.env.local` in the `frontend_latest` directory:

```env
# Backend API URL (supports both client and server-side)
NEXT_PUBLIC_API_URL=http://localhost:8000
# OR for production:
# NEXT_PUBLIC_API_URL=https://sih2025-chatbot-working.onrender.com

# Alternative server-only variable (used if NEXT_PUBLIC_API_URL not set)
API_URL=http://localhost:8000
```

**Note:** The code will fall back to `http://localhost:8000` if no environment variable is set, making local development work out of the box.

---

## 🔧 Original Recommended Fixes (Now Applied)

1. ✅ **Added sync_router to main.py:**
   ```python
   from app.routers import embed_router, chat_router, sync_router
   app.include_router(sync_router.router)
   ```

2. ✅ **Created environment variable configuration:**
   - Both API routes use `NEXT_PUBLIC_API_URL` or `API_URL` with localhost fallback

3. ✅ **Updated upload-panel.tsx:**
   - Now uses `/api/upload` Next.js API route instead of direct backend call

4. ✅ **Standardized API calling pattern:**
   - Both chat and upload use Next.js API routes as proxy to backend

