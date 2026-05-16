"""
P6 [STUB] — Manual trigger for weekly report dispatch.
Owner: BE
Real scheduler is roadmap. This endpoint replaces it for the demo.
"""
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.reports.weekly import dispatch_weekly_report

router = APIRouter()


@router.post("/reports/weekly/dispatch")
async def dispatch_report(user=Depends(require_auth)):
    # TODO P6: generate report from demo dataset + post to Slack channel
    await dispatch_weekly_report(workspace_id=user["workspace_id"])
    return {"status": "dispatched"}
