"""
Dashboard summary: connected sources, recent conversations (same source as sidebar).
"""
from datetime import datetime
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.appwrite.store import get_dashboard_summary, list_conversations as _store_list_convs
from app.state import conversations as _conversations

router = APIRouter()


def _conv_title(conv: dict) -> str:
    user_msgs = [m for m in conv.get("messages", []) if m.get("role") == "user"]
    return user_msgs[0]["content"][:48] if user_msgs else "New conversation"


@router.get("/dashboard")
async def get_dashboard(user=Depends(require_auth)):
    workspace_id = user["workspace_id"]
    summary = await get_dashboard_summary(workspace_id=workspace_id)

    # ── Recent conversations — same merge + sort logic as GET /chat ──────────
    mem: dict[str, dict] = {
        cid: {
            "id": cid,
            "title": _conv_title(c),
            "message_count": len(c["messages"]),
            "connection_id": c["connection_id"],
            "last_used_at": c.get("last_used_at", 0.0),
        }
        for cid, c in _conversations.items()
        if c["workspace_id"] == workspace_id
    }

    for p in await _store_list_convs(workspace_id):
        pid = p["$id"]
        if pid not in mem:
            user_msgs = [m for m in p.get("messages", []) if m.get("role") == "user"]
            try:
                updated = datetime.fromisoformat(
                    p.get("$updatedAt", "").replace("Z", "+00:00")
                ).timestamp()
            except Exception:
                updated = 0.0
            mem[pid] = {
                "id": pid,
                "title": user_msgs[0]["content"][:48] if user_msgs else p.get("title", "Conversation"),
                "message_count": len(p.get("messages", [])),
                "connection_id": p.get("connection_id", ""),
                "last_used_at": updated,
            }

    sorted_convs = sorted(mem.values(), key=lambda c: c["last_used_at"], reverse=True)
    for c in sorted_convs:
        c.pop("last_used_at", None)
    summary["recent_conversations"] = sorted_convs[:10]
    return summary
