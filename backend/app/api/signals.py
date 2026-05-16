"""
P6 [STUB] — Signals feed: pre-computed anomaly.
Owner: BE
No live scheduler. One pre-computed anomaly + cached investigation served from fixture.
"""
import json
import os
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth

router = APIRouter()

SIGNALS_FIXTURE_PATH = "fixtures/signals.json"


@router.get("/signals")
async def get_signals(user=Depends(require_auth)):
    # TODO P6: load from fixtures/signals.json (pre-computed offline, not live)
    if os.path.exists(SIGNALS_FIXTURE_PATH):
        with open(SIGNALS_FIXTURE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"signals": []}
