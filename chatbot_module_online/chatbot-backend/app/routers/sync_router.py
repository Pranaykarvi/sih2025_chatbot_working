
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from app.db.supabase_client import supabase
import logging

router = APIRouter(prefix="/sync", tags=["sync"])
logger = logging.getLogger(__name__)

class SyncItem(BaseModel):
    patient_id: str
    item_type: str
    payload: Dict[str, Any]

@router.post("/ingest")
async def ingest(item: SyncItem):
    # Save to a server-side queue table (create table sync_queue in your supabase)
    try:
        row = {
            "patient_id": item.patient_id,
            "item_type": item.item_type,
            "payload": item.payload
        }
        res = supabase.table("sync_queue").insert(row).execute()
        if res.status_code >= 400:
            logger.error("Supabase insert failed: %s", res.data)
            raise HTTPException(status_code=500, detail="Failed to persist sync item")
    except Exception as e:
        logger.exception("Sync ingest failed")
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok"}

