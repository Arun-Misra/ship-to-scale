"""
P5 — Semantic store read endpoint. Shows the workspace's captured definitions (the moat, made visible).
Owner: BE
Read-only — no write endpoint in MVP.
"""
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.appwrite.store import list_semantic_definitions

router = APIRouter()


@router.get("/semantic")
async def get_semantic(user=Depends(require_auth)):
    # TODO P5: load from Appwrite semantic_definitions collection for this workspace
    definitions = await list_semantic_definitions(workspace_id=user["workspace_id"])
    return {"definitions": definitions}
