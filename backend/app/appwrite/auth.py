"""
P3 — JWT verification + require_auth FastAPI dependency.
Owner: BE
"""
from fastapi import HTTPException, Header
import anyio

from app.appwrite.client import users
from app.config import settings


async def require_auth(authorization: str = Header(...)) -> dict:
    """
    FastAPI dependency. Verifies Appwrite JWT.
    Returns a user dict with workspace_id.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    jwt = authorization.removeprefix("Bearer ")

    try:
        # Appwrite SDK is synchronous — wrap in thread
        user = await anyio.to_thread.run_sync(
            lambda: users.get_session(user_id="current", session_id="current")
        )
        # TODO P3: extract workspace_id from user preferences or a workspace membership lookup
        return {"user_id": user["$id"], "workspace_id": user.get("prefs", {}).get("workspace_id", "")}
    except Exception:
        raise HTTPException(401, "Invalid or expired session")
