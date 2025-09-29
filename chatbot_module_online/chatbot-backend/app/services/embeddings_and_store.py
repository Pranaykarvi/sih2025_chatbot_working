
import tempfile
import os
import logging
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

    # 5. Insert in batches
    BATCH = 100
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            res = supabase.table("patient_documents").insert(batch).execute()
            # Handle both old and new response formats
            if hasattr(res, "error") and res.error:
                logger.error("Supabase insert error: %s", res.error)
                raise RuntimeError("Failed to insert batch into Supabase")
            elif not hasattr(res, "error") and not res.data:
                logger.error("Supabase insert returned no data")
                raise RuntimeError("Failed to insert batch into Supabase")
        except Exception as e:
            logger.exception("Supabase insert exception")
            raise RuntimeError("Supabase insert failed") from e

    return len(rows)

