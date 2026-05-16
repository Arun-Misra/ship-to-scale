"""
P6 — Slack Events API webhook + OAuth install flow.
Owner: BE

CRITICAL rules:
- Read raw bytes FIRST, verify HMAC signature, THEN json.loads (never the reverse)
- Return 200 within ~1s; agent runs in BackgroundTask
- Check bot_id / subtype=bot_message BEFORE anything else (prevents infinite self-loop)
- Extract channel + thread_ts SYNCHRONOUSLY before returning 200 (request gone in background task)
"""
import json
from time import time
import secrets

from fastapi import APIRouter, Request, BackgroundTasks, Depends
from fastapi.responses import RedirectResponse

from app.appwrite.auth import require_auth
from app.appwrite.store import get_slack_installation, create_slack_installation
from app.slack.signature import verify_slack_signature
from app.slack.handler import handle_slack_event
from app.slack.oauth import pending_installs, exchange_slack_code
from app.config import settings

router = APIRouter()

_seen_event_ids: set[str] = set()


def _is_duplicate(event_id: str) -> bool:
    if event_id in _seen_event_ids:
        return True
    _seen_event_ids.add(event_id)
    return False


@router.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()               # raw bytes FIRST
    verify_slack_signature(raw_body, dict(request.headers))  # verify on raw bytes
    payload = json.loads(raw_body)                # parse ONLY after verification

    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}

    event = payload.get("event", {})

    # Bot self-loop prevention — must be first check
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return {"status": "ok"}

    team_id = payload.get("team_id")
    installation = await get_slack_installation(team_id)
    if not installation:
        return {"status": "ok"}

    event_id = payload.get("event_id", "")
    if _is_duplicate(event_id):
        return {"status": "ok"}

    # Extract synchronously before returning 200 — request object is gone in background task
    channel = event.get("channel")
    thread_ts = event.get("ts")
    question = event.get("text", "")

    background_tasks.add_task(
        handle_slack_event,
        question=question,
        channel=channel,
        thread_ts=thread_ts,
        workspace_id=installation["appwrite_workspace_id"],
        connection_id=installation["default_connection_id"],
        bot_token=installation["slack_bot_token"],
    )
    return {"status": "ok"}


@router.get("/slack/install-url")
async def slack_install_url(workspace_id: str, user=Depends(require_auth)):
    nonce = secrets.token_urlsafe(16)
    pending_installs[nonce] = {"workspace_id": workspace_id, "expires": time() + 600}
    url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.slack_client_id}"
        f"&scope=app_mentions:read,chat:write,channels:history"
        f"&state={nonce}"
        f"&redirect_uri={settings.frontend_url}/slack/oauth/callback"
    )
    return {"url": url}


@router.get("/slack/oauth/callback")
async def slack_oauth_callback(code: str, state: str):
    entry = pending_installs.pop(state, None)
    if not entry or time() > entry["expires"]:
        from fastapi import HTTPException
        raise HTTPException(403, "Invalid or expired state")

    team_id, bot_token, team_name = await exchange_slack_code(code)
    await create_slack_installation(
        slack_team_id=team_id,
        slack_team_name=team_name,
        slack_bot_token=bot_token,
        appwrite_workspace_id=entry["workspace_id"],
    )
    return RedirectResponse(f"{settings.frontend_url}/dashboard?slack=connected")
