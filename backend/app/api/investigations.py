"""
Investigation start, SSE stream, and history retrieval.
"""
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.appwrite.auth import require_auth
from app.appwrite.store import (
    save_investigation_record,
    get_investigation_record,
    list_recent_investigations,
)
from app.agent.loop import run_investigation
from app.state import investigations as _investigations

router = APIRouter()


class StartInvestigationRequest(BaseModel):
    connection_id: str
    question: str


@router.post("/investigations")
async def start_investigation(body: StartInvestigationRequest, user=Depends(require_auth)):
    investigation_id = str(uuid.uuid4())
    _investigations[investigation_id] = {
        "status": "pending",
        "connection_id": body.connection_id,
        "question": body.question,
        "workspace_id": user["workspace_id"],
    }
    # Persist to Appwrite (best-effort — silent on failure)
    asyncio.create_task(save_investigation_record(
        investigation_id=investigation_id,
        workspace_id=user["workspace_id"],
        question=body.question,
        connection_id=body.connection_id,
    ))
    return {"investigation_id": investigation_id}


@router.get("/investigations")
async def list_investigations(user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    # Try Appwrite first
    appwrite_docs = await list_recent_investigations(workspace_id, limit=20)
    if appwrite_docs:
        return {
            "investigations": [
                {
                    "id": d["$id"],
                    "question": d.get("question", ""),
                    "connection_id": d.get("connection_id", ""),
                    "status": d.get("status", "pending"),
                    "verdict": d.get("verdict") or None,
                    "root_cause": d.get("root_cause") or None,
                    "confidence": d.get("confidence") or None,
                    "recommended_action": d.get("recommended_action") or None,
                    "created_at": d.get("$createdAt"),
                }
                for d in appwrite_docs
            ]
        }

    # Fallback: in-memory
    mem = [
        {
            "id": inv_id,
            "question": inv["question"],
            "connection_id": inv.get("connection_id", ""),
            "status": inv["status"],
            "verdict": inv.get("verdict"),
            "root_cause": inv.get("root_cause"),
            "confidence": inv.get("confidence"),
            "recommended_action": inv.get("recommended_action"),
            "created_at": None,
        }
        for inv_id, inv in list(_investigations.items())
        if inv.get("workspace_id") == workspace_id
    ]
    return {"investigations": mem[-20:]}


@router.get("/investigations/{investigation_id}/stream")
async def stream_investigation(investigation_id: str, user=Depends(require_auth)):
    inv = _investigations.get(investigation_id)
    if not inv:
        raise HTTPException(404, "Investigation not found")
    if inv["workspace_id"] != user["workspace_id"]:
        raise HTTPException(404, "Investigation not found")

    async def event_stream():
        async for chunk in run_investigation(
            investigation_id=investigation_id,
            question=inv["question"],
            connection_id=inv["connection_id"],
            workspace_id=inv["workspace_id"],
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/investigations/{investigation_id}")
async def get_investigation(investigation_id: str, user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    # Check in-memory first (current session)
    inv = _investigations.get(investigation_id)
    if inv and inv.get("workspace_id") == workspace_id:
        return {
            "id": investigation_id,
            "question": inv["question"],
            "connection_id": inv.get("connection_id", ""),
            "status": inv["status"],
            "verdict": inv.get("verdict"),
            "root_cause": inv.get("root_cause"),
            "confidence": inv.get("confidence"),
            "recommended_action": inv.get("recommended_action"),
            "created_at": None,
        }

    # Fall back to Appwrite (persisted across restarts)
    doc = await get_investigation_record(investigation_id, workspace_id)
    if not doc:
        raise HTTPException(404, "Investigation not found")
    return {
        "id": doc["$id"],
        "question": doc.get("question", ""),
        "connection_id": doc.get("connection_id", ""),
        "status": doc.get("status", "pending"),
        "verdict": doc.get("verdict") or None,
        "root_cause": doc.get("root_cause") or None,
        "confidence": doc.get("confidence") or None,
        "recommended_action": doc.get("recommended_action") or None,
        "created_at": doc.get("$createdAt"),
    }
