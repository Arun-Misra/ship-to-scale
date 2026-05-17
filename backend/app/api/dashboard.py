"""
Dashboard summary: connected sources, key metrics, recent investigations.
"""
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.appwrite.store import get_dashboard_summary, list_recent_investigations
from app.state import investigations

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(user=Depends(require_auth)):
    workspace_id = user["workspace_id"]
    summary = await get_dashboard_summary(workspace_id=workspace_id)

    # Try Appwrite investigations first (persisted across restarts)
    appwrite_invs = await list_recent_investigations(workspace_id, limit=20)
    if appwrite_invs:
        recent = [
            {
                "id": d["$id"],
                "question": d.get("question", ""),
                "connection_id": d.get("connection_id", ""),
                "status": d.get("status", "pending"),
                "verdict": d.get("verdict") or None,
                "conclusion": d.get("root_cause") or None,
            }
            for d in appwrite_invs
        ]
    else:
        # Fallback: in-memory (current session only)
        recent = [
            {
                "id": inv_id,
                "question": inv["question"],
                "connection_id": inv.get("connection_id", ""),
                "status": inv["status"],
                "verdict": inv.get("verdict"),
                "conclusion": inv.get("root_cause"),
            }
            for inv_id, inv in list(investigations.items())
            if inv.get("workspace_id") == workspace_id
        ]
        recent = recent[-20:]

    summary["recent_investigations"] = recent
    return summary
