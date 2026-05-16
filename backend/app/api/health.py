import os
from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "demo_db_present": os.path.exists(settings.demo_db_path),
    }
