
import tempfile
import os
import logging
import time
from PyPDF2 import PdfReader
from docx import Document
from app.utils.text_splitter import chunk_text
from app.services.embeddings import embed_texts
from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        path = tmp.name
    text = ""
    try:
        reader = PdfReader(path)
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
    finally:
        os.remove(path)
    return text

def _extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
        tmp.write(file_bytes)
        path = tmp.name
    text = ""
    try:
        doc = Document(path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    finally:
        os.remove(path)
    return text

def embed_file_and_store(patient_id: str, filename: str, file_bytes: bytes) -> int:
    """
    Extracts text from file, chunks it, embeds each chunk, and stores in Supabase.
    Returns number of chunks inserted.
    """
    # 1. Extract text
    if filename.lower().endswith(".pdf"):
        text = _extract_text_from_pdf(file_bytes)
    elif filename.lower().endswith(".docx"):
        text = _extract_text_from_docx(file_bytes)
    else:
        text = file_bytes.decode("utf-8", errors="ignore")

    if not text.strip():
        logger.warning("No text extracted from file: %s", filename)
        return 0

    # 2. Chunk text
    chunks = chunk_text(text)
    if not chunks:
        logger.warning("Text could not be chunked: %s", filename)
        return 0

    # 3. Embed chunks
    try:
        embeddings = embed_texts(chunks)
    except Exception as e:
        logger.exception("Embedding failed for file %s", filename)
        raise RuntimeError("Embedding failed") from e

    # 4. Prepare rows for Supabase
    rows = [
        {
            "patient_id": patient_id,
            "doc_id": filename,
            "chunk_id": i,
            "text": chunk,
            "metadata": {},
            "embedding": emb
        }
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]

    # 5. Insert in batches with retry logic
    BATCH = 100
    max_retries = 3
    retry_delay = 1  # seconds
    
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        retry_count = 0
        last_exception = None
        
        while retry_count < max_retries:
            try:
                logger.info("Inserting batch %d/%d (attempt %d/%d)", 
                           i // BATCH + 1, (len(rows) + BATCH - 1) // BATCH, 
                           retry_count + 1, max_retries)
                res = supabase.table("patient_documents").insert(batch).execute()
                
                # Handle both old and new response formats
                if hasattr(res, "error") and res.error:
                    error_msg = str(res.error)
                    logger.error("Supabase insert error: %s", error_msg)
                    # Check for common database limit/quota errors
                    error_lower = error_msg.lower()
                    if any(keyword in error_lower for keyword in ["quota", "limit", "exceeded", "storage", "database size"]):
                        raise RuntimeError(f"Database storage limit reached: {error_msg}. Please contact support or upgrade your plan.")
                    raise RuntimeError(f"Failed to insert batch into Supabase: {error_msg}")
                elif not hasattr(res, "error") and not res.data:
                    logger.error("Supabase insert returned no data")
                    raise RuntimeError("Failed to insert batch into Supabase: no data returned")
                
                # Success - break out of retry loop
                logger.info("Successfully inserted batch %d/%d", i // BATCH + 1, (len(rows) + BATCH - 1) // BATCH)
                break
                
            except Exception as e:
                last_exception = e
                retry_count += 1
                
                # Check if it's a connection error that might be retryable
                error_str = str(e).lower()
                is_retryable = any(keyword in error_str for keyword in [
                    "name or service not known",
                    "connection",
                    "timeout",
                    "network",
                    "dns",
                    "temporary failure"
                ])
                
                if retry_count < max_retries and is_retryable:
                    wait_time = retry_delay * (2 ** (retry_count - 1))  # Exponential backoff
                    logger.warning("Supabase insert failed (attempt %d/%d): %s. Retrying in %ds...", 
                                 retry_count, max_retries, str(e), wait_time)
                    time.sleep(wait_time)
                else:
                    logger.exception("Supabase insert exception (non-retryable or max retries reached)")
                    raise RuntimeError(f"Supabase insert failed after {retry_count} attempts: {str(e)}") from e
        
        # If we exhausted retries, raise the last exception
        if retry_count >= max_retries and last_exception:
            raise RuntimeError(f"Supabase insert failed after {max_retries} attempts") from last_exception

    logger.info("Successfully inserted all %d chunks for file: %s", len(rows), filename)
    return len(rows)

