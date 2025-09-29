




# Chatbot Backend (Cohere + Supabase)

## Overview
Backend for offline-first health chatbot:
- Cohere for embeddings (embed-english-v3.0, 1024-dim)
- Supabase/Postgres + pgvector for patient-scoped vector storage
- FastAPI endpoints:
  - POST /embed/pdf (patient_id, file)
  - POST /chat/ask (patient_id, question)
  - POST /sync/ingest (sync queue items)
  - GET /health

## Setup
1. Create Supabase tables and RPC function using `app/models/sql/patient_documents.sql`.
2. Create `.env` with keys (see .env example).
3. Build & run:
   ```bash
   docker-compose up --build
   # or locally
   pip install -r requirements.txt
   uvicorn app.main:app --reload

