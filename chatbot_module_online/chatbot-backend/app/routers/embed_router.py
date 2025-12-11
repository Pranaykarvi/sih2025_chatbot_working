
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.embeddings_and_store import embed_file_and_store
import logging
import asyncio

router = APIRouter(prefix="/embed", tags=["embed"])
logger = logging.getLogger(__name__)

@router.post("/pdf")
async def embed_pdf(patient_id: str = Form(...), file: UploadFile = File(...)):
    """
    Upload and process a PDF file for a patient.
    Extracts text, chunks it, generates embeddings, and stores in Supabase.
    """
    if not file:
        raise HTTPException(status_code=400, detail="file required")
    
    if not patient_id or not patient_id.strip():
        raise HTTPException(status_code=400, detail="patient_id is required")
    
    # Validate file type
    if file.filename and not (file.filename.lower().endswith(".pdf") or file.filename.lower().endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    logger.info("Starting upload for patient_id=%s, filename=%s", patient_id, file.filename)
    
    try:
        content = await file.read()
        
        if not content or len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        logger.info("File read successfully, size=%d bytes. Processing...", len(content))
        
        # Run the synchronous function in a thread pool to avoid blocking
        # This is important for async endpoints
        count = await asyncio.to_thread(
            embed_file_and_store, 
            patient_id, 
            file.filename or "unknown", 
            content
        )
        
        logger.info("Upload completed successfully: %d chunks inserted for patient_id=%s", count, patient_id)
        
        if count == 0:
            logger.warning("No chunks were inserted for file: %s (patient_id=%s)", file.filename, patient_id)
            return {
                "status": "ok", 
                "chunks_inserted": 0,
                "warning": "File processed but no text chunks were extracted. The file might be empty or unreadable."
            }
        
        return {"status": "ok", "chunks_inserted": count}
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        logger.exception("Validation error during upload")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # These are typically Supabase or embedding errors
        error_msg = str(e)
        logger.exception("Runtime error during upload: %s", error_msg)
        
        # Provide more helpful error messages
        if "supabase" in error_msg.lower() or "connection" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Database connection error. Please try again in a moment."
            )
        elif "embedding" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="Failed to generate embeddings. Please check your API keys."
            )
        else:
            raise HTTPException(status_code=500, detail=f"Upload failed: {error_msg}")
    except Exception as e:
        logger.exception("Unexpected error during upload")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

