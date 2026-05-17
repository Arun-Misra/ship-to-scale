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
from time import time
import secrets

from fastapi import APIRouter, Request, BackgroundTasks, Depends

logger = logging.getLogger(__name__)
from fastapi.responses import RedirectResponse

from app.appwrite.auth import require_auth
import httpx
from app.appwrite.store import (
    get_slack_installation,
    get_slack_installation_for_workspace,
    create_slack_installation,
    upsert_slack_installation,
)
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
    raw_body = await request.body()
    logger.info("SLACK RAW HEADERS: %s", dict(request.headers))
    logger.info("SLACK RAW BODY: %s", raw_body.decode("utf-8", errors="replace"))

    try:
        payload = json.loads(raw_body)
    except Exception:
        logger.error("SLACK body is not valid JSON")
        return {"status": "ok"}

    logger.info("SLACK PARSED PAYLOAD: %s", json.dumps(payload))

    # Always handle url_verification (Slack sends this when you first configure the endpoint)
    if payload.get("type") == "url_verification":
        logger.info("SLACK url_verification challenge: %s", payload.get("challenge"))
        return {"challenge": payload["challenge"]}

    event = payload.get("event", {})
    logger.info(
        "SLACK EVENT: type=%s subtype=%s bot_id=%s text=%r channel=%s",
        event.get("type"), event.get("subtype"), event.get("bot_id"),
        event.get("text", "")[:120], event.get("channel"),
    )

    # Bot self-loop prevention
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        logger.info("SLACK ignoring bot message")
        return {"status": "ok"}

    if event.get("type") not in ("app_mention", "message"):
        logger.info("SLACK ignoring event type: %s", event.get("type"))
        return {"status": "ok"}

    team_id = payload.get("team_id")
    installation = await get_slack_installation(team_id)
    logger.info("SLACK installation lookup team_id=%s found=%s", team_id, installation is not None)
    if not installation:
        return {"status": "ok"}

    event_id = payload.get("event_id", "")
    if _is_duplicate(event_id):
        logger.info("SLACK duplicate event_id=%s, skipping", event_id)
        return {"status": "ok"}

    channel = event.get("channel")
    thread_ts = event.get("thread_ts") or event.get("ts")
    question = re.sub(r"<@[A-Z0-9]+>", "", event.get("text", "")).strip()

    if not question:
        logger.info("SLACK empty question after stripping mentions")
        return {"status": "ok"}

    logger.info(
        "SLACK dispatching: event_id=%s channel=%s thread_ts=%s question=%r",
        event_id, channel, thread_ts, question,
    )

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
    await create_slack_installation(
        slack_team_id=team_id,
        slack_team_name=team_name,
        slack_bot_token=bot_token,
        appwrite_workspace_id=entry["workspace_id"],
    )
    return RedirectResponse(f"{settings.frontend_url}/dashboard?slack=connected")
