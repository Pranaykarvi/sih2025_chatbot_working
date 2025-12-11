
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import embed_router, chat_router, sync_router
import app.logging_config
from dotenv import load_dotenv
import os

load_dotenv()
app = FastAPI(title="Chatbot Module API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(embed_router.router)
app.include_router(chat_router.router)
app.include_router(sync_router.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

