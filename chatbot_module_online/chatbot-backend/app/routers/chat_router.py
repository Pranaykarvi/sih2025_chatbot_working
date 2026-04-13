from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services.embeddings import embed_texts
from app.db.supabase_client import supabase
from app.services.llm_providers import FALLBACK_ANSWER, generate_text
import logging
import time

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    patient_id: str
    question: str
    top_k: Optional[int] = 4
    provider_order: Optional[List[str]] = None  # Defaults to ["gemini", "groq"]
    use_cloud: Optional[bool] = True  # Keep for future flexibility

@router.post("/ask")
async def ask(req: ChatRequest):
    """
    Online-only patient-specific chatbot.
    Uses vector embeddings from patient documents as context,
    then queries Gemini and Groq for answers.
    """

    # 1️⃣ Validate input
    if not req.patient_id or not req.question:
        raise HTTPException(status_code=400, detail="patient_id and question are required")

    top_k = req.top_k or 4

    # 2️⃣ Embed the question
    try:
        q_emb = embed_texts(
            [req.question],
            model="embed-english-v3.0",
            input_type="search_query"
        )[0]
    except Exception:
        logger.exception("Query embedding failed")
        raise HTTPException(status_code=500, detail="Failed to embed query")

    # 3️⃣ Fetch patient-specific document chunks with retry logic
    max_retries = 3
    retry_delay = 1
    rpc = None
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            logger.info("Fetching patient documents (attempt %d/%d) for patient_id=%s", 
                       attempt + 1, max_retries, req.patient_id)
            rpc = supabase.rpc("match_patient_documents", {
                "query_embedding": q_emb,
                "match_count": top_k,
                "patientid": req.patient_id
            }).execute()
            logger.info("Successfully fetched patient documents")
            break  # Success - exit retry loop
        except Exception as e:
            last_exception = e
            error_str = str(e).lower()
            is_retryable = any(keyword in error_str for keyword in [
                "name or service not known",
                "connection",
                "timeout",
                "network",
                "dns",
                "temporary failure"
            ])
            
            if attempt < max_retries - 1 and is_retryable:
                wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                logger.warning("Supabase RPC failed (attempt %d/%d): %s. Retrying in %ds...", 
                             attempt + 1, max_retries, str(e), wait_time)
                time.sleep(wait_time)
            else:
                logger.exception("Supabase RPC failed (non-retryable or max retries reached)")
                if is_retryable:
                    raise HTTPException(
                        status_code=503, 
                        detail="Database connection error. Please try again in a moment."
                    )
                else:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Patient document search failed: {str(e)}"
                    )
    
    if rpc is None:
        raise HTTPException(
            status_code=500, 
            detail="Failed to fetch patient documents after multiple attempts"
        )

    rows = rpc.data or []
    context_text = "\n\n".join([r.get("text", "") for r in rows])

    # 4️⃣ Build prompt for LLM
    prompt = (
        "You are a cautious clinical assistant. Use the patient context below to answer the user's question. "
        "If unsure, recommend a clinician and list uncertainties.\n\n"
        f"Patient Context:\n{context_text}\n\nQuestion: {req.question}\n\nAnswer concisely and provide sources."
    )

    # 5️⃣ Call LLM providers (Gemini -> Groq); graceful fallback string if all fail
    provider_order = req.provider_order or ["gemini", "groq"]
    try:
        answer = await generate_text(
            prompt=prompt,
            provider_order=provider_order,
            allow_fallback_message=True,
        )
    except Exception:
        logger.exception("LLM layer raised unexpectedly; using fallback answer")
        answer = FALLBACK_ANSWER

    if answer == FALLBACK_ANSWER:
        logger.warning(
            "Chat using fallback answer (all providers failed or returned empty) patient_id=%s",
            req.patient_id,
        )

    # 6️⃣ Return answer with sources
    return {
        "answer": answer,
        "sources": [
            {"doc_id": r.get("doc_id"), "chunk_id": r.get("chunk_id"), "score": r.get("score")}
            for r in rows
        ]
    }

