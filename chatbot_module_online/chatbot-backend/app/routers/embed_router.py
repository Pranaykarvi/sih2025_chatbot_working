
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.embeddings_and_store import embed_file_and_store
import logging

router = APIRouter(prefix="/embed", tags=["embed"])
logger = logging.getLogger(__name__)

@router.post("/pdf")
async def embed_pdf(patient_id: str = Form(...), file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="file required")
    content = await file.read()
    try:
        count = embed_file_and_store(patient_id, file.filename, content)
    except Exception as e:
        logger.exception("Embedding failed")
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "chunks_inserted": count}

