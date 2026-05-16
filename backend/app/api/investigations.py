"""
P2/P4 — Investigation start + SSE stream.
Owner: BE (loop) + FE (stream consumer)
"""
import asyncio
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.appwrite.auth import require_auth
from app.agent.loop import run_investigation
from app.agent.replay import replay_fixture

router = APIRouter()

# In-memory store of running/completed investigations keyed by investigation_id.
# Replace with Appwrite persistence in P3.
_investigations: dict[str, dict] = {}


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
    return {"investigation_id": investigation_id}


@router.get("/investigations/{investigation_id}/stream")
async def stream_investigation(investigation_id: str, user=Depends(require_auth)):
    inv = _investigations.get(investigation_id)
    if not inv:
        from fastapi import HTTPException
        raise HTTPException(404, "Investigation not found")

    async def event_stream():
        # TODO P2: replace with run_investigation() live agent loop
        # TODO P7: gate behind USE_REPLAY env flag — serve replay_fixture() by default
        async for chunk in run_investigation(
            investigation_id=investigation_id,
            question=inv["question"],
            connection_id=inv["connection_id"],
            workspace_id=inv["workspace_id"],
        ):
            yield chunk
            # Keepalive every 15s is handled inside run_investigation

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx/Render proxy buffering
        },
    )


@router.get("/investigations/{investigation_id}")
async def get_investigation(investigation_id: str, user=Depends(require_auth)):
    # TODO P3: load persisted final result from Appwrite
    raise NotImplementedError
