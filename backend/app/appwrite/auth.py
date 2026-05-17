"""
P3 — JWT verification + require_auth FastAPI dependency.
Owner: BE
"""
import httpx
from fastapi import HTTPException, Header

from app.config import settings


_DEV_USER = {"user_id": "local-dev-user", "workspace_id": "local-dev-workspace"}


async def require_auth(authorization: str = Header(...)) -> dict:
    """
    FastAPI dependency. Verifies Appwrite JWT via REST API.
    Returns a user dict with workspace_id.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    jwt = authorization.removeprefix("Bearer ")

    if settings.dev_bypass_auth and jwt == "local-dev-jwt":
        return _DEV_USER

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.appwrite_endpoint}/account",
                headers={
                    "X-Appwrite-Project": settings.appwrite_project_id,
                    "X-Appwrite-JWT": jwt,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid or expired session")
        user = resp.json()
        workspace_id = user.get("prefs", {}).get("workspace_id") or user["$id"]
        return {"user_id": user["$id"], "workspace_id": workspace_id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid or expired session")
