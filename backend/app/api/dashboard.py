"""
P5 — Dashboard summary: connected sources, key metrics, recent investigations.
Owner: BE
"""
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.appwrite.store import get_dashboard_summary
from app.state import investigations

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(user=Depends(require_auth)):
    workspace_id = user["workspace_id"]
    summary = await get_dashboard_summary(workspace_id=workspace_id)

    # Inject recent investigations from in-memory store (workspace-scoped)
    recent = [
        {
            "id": inv_id,
            "question": inv["question"],
            "status": inv["status"],
            "verdict": inv.get("verdict"),
            "conclusion": inv.get("conclusion"),
        }
        for inv_id, inv in list(investigations.items())
        if inv.get("workspace_id") == workspace_id
    ]
    summary["recent_investigations"] = recent[-10:]  # last 10

    return summary
