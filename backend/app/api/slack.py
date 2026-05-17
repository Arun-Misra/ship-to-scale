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
import logging
import re
import secrets
from time import time

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import RedirectResponse

from app.appwrite.auth import require_auth
from app.appwrite.store import (
    create_slack_installation,
    get_connections_for_workspace,
    get_slack_installation,
    get_slack_installation_for_workspace,
    upsert_slack_installation,
)
from app.config import settings
from app.slack.handler import handle_slack_event
from app.slack.oauth import exchange_slack_code, pending_installs
from app.slack.signature import verify_slack_signature

router = APIRouter()
logger = logging.getLogger(__name__)

_seen_event_ids: set[str] = set()


def _is_duplicate(event_id: str) -> bool:
    if event_id in _seen_event_ids:
        return True
    _seen_event_ids.add(event_id)
    return False


@router.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    try:
        raw_body = await request.body()  # raw bytes FIRST
        verify_slack_signature(raw_body, dict(request.headers))  # verify on raw bytes
        payload = json.loads(raw_body)  # parse ONLY after verification

        if payload.get("type") == "url_verification":
            return {"challenge": payload["challenge"]}

        event = payload.get("event", {})

        # Bot self-loop prevention — must be first check
        if event.get("bot_id") or event.get("subtype") == "bot_message":
            return {"status": "ok"}

        event_type = event.get("type")
        if event_type not in {"app_mention", "message"}:
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
        thread_ts = event.get("thread_ts") or event.get("ts")
        question = re.sub(r"<@[A-Z0-9]+>", "", event.get("text", "")).strip()

        workspace_id = installation.get("appwrite_workspace_id", "")
        connection_id = installation.get("default_connection_id", "")

        # Ensure Slack replies execute against a real connection for the installed workspace.
        if workspace_id and not connection_id:
            conns = await get_connections_for_workspace(workspace_id=workspace_id)
            if conns:
                connection_id = conns[0].get("$id", "")

        if not channel or not question:
            return {"status": "ok"}

        background_tasks.add_task(
            handle_slack_event,
            question=question,
            channel=channel,
            thread_ts=thread_ts,
            workspace_id=workspace_id,
            connection_id=connection_id,
            bot_token=installation.get("slack_bot_token", ""),
        )
        return {"status": "ok"}
    except Exception as e:
        # Never bubble a 5xx to Slack/webhook gateway; acknowledge and log.
        logger.error("Slack events webhook failed: %s", e, exc_info=True)
        return {"status": "ok"}


@router.get("/slack/status")
async def slack_status(user=Depends(require_auth)):
    """Check whether a Slack bot is activated for the current workspace."""
    configured = bool(settings.slack_bot_token)
    installation = await get_slack_installation_for_workspace(user["workspace_id"])
    return {
        "configured": configured,
        "activated": installation is not None,
        "team": installation.get("slack_team_name", "") if installation else "",
    }


@router.post("/slack/activate")
async def activate_slack(user=Depends(require_auth)):
    """Register the configured bot token for this workspace (no full OAuth needed)."""
    if not settings.slack_bot_token:
        from fastapi import HTTPException

        raise HTTPException(400, "SLACK_BOT_TOKEN is not configured in the environment")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {settings.slack_bot_token}"},
        )
    data = resp.json()
    if not data.get("ok"):
        from fastapi import HTTPException

        raise HTTPException(400, f"Slack token rejected: {data.get('error', 'unknown')}")

    team_id = data["team_id"]
    team_name = data.get("team", "")

    await upsert_slack_installation(
        slack_team_id=team_id,
        slack_team_name=team_name,
        slack_bot_token=settings.slack_bot_token,
        appwrite_workspace_id=user["workspace_id"],
    )
    logger.info("Slack activated: team=%s workspace=%s", team_id, user["workspace_id"])
    return {"status": "activated", "team": team_name, "team_id": team_id}


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
    workspace_id = entry["workspace_id"]
    workspace_connections = await get_connections_for_workspace(workspace_id=workspace_id)
    default_connection_id = workspace_connections[0]["$id"] if workspace_connections else ""

    await create_slack_installation(
        slack_team_id=team_id,
        slack_team_name=team_name,
        slack_bot_token=bot_token,
        appwrite_workspace_id=workspace_id,
        default_connection_id=default_connection_id,
    )
    return RedirectResponse(f"{settings.frontend_url}/dashboard?slack=connected")
