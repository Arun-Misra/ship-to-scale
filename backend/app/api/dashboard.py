"""
P5 — Dashboard summary: connected sources, key metrics, recent investigations.
Owner: BE
"""
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.appwrite.store import get_dashboard_summary

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(user=Depends(require_auth)):
    # TODO P5: aggregate from Appwrite — connections count, last query ts,
    # key metric snapshots (from demo dataset), recent investigations
    summary = await get_dashboard_summary(workspace_id=user["workspace_id"])
    return summary
