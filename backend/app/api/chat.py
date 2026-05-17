"""Multi-turn chat: conversation management + SSE streaming, persisted to Appwrite."""
import asyncio
import json
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.appwrite.auth import require_auth
from app.appwrite.store import (
    save_conversation as _store_save_conv,
    list_conversations as _store_list_convs,
    get_conversation as _store_get_conv,
)
from app.agent.loop import run_investigation
from app.state import investigations as _investigations, conversations as _conversations

router = APIRouter()


def _title(conv: dict) -> str:
    user_msgs = [m for m in conv["messages"] if m["role"] == "user"]
    return user_msgs[0]["content"][:48] if user_msgs else "New conversation"


def _persist_conv(conv_id: str, conv: dict) -> None:
    """Fire-and-forget Appwrite save so it never blocks the request."""
    asyncio.create_task(_store_save_conv(
        conversation_id=conv_id,
        workspace_id=conv["workspace_id"],
        connection_id=conv["connection_id"],
        title=_title(conv),
        messages=conv["messages"],
    ))


class ChatMessageRequest(BaseModel):
    conversation_id: str | None = None
    connection_id: str
    message: str


@router.post("/chat")
async def send_chat_message(body: ChatMessageRequest, user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    # Try in-memory first, then Appwrite (handles page refresh / server restart)
    conv_id = body.conversation_id
    if conv_id and conv_id not in _conversations:
        persisted = await _store_get_conv(conv_id, workspace_id)
        if persisted:
            _conversations[conv_id] = {
                "workspace_id": workspace_id,
                "connection_id": persisted.get("connection_id", body.connection_id),
                "messages": persisted.get("messages", []),
            }

    if conv_id and conv_id in _conversations:
        conv = _conversations[conv_id]
        if conv["workspace_id"] != workspace_id:
            raise HTTPException(404, "Conversation not found")
    else:
        conv_id = str(uuid.uuid4())
        _conversations[conv_id] = {
            "workspace_id": workspace_id,
            "connection_id": body.connection_id,
            "messages": [],
            "last_used_at": time.time(),
        }

    conv = _conversations[conv_id]
    conv["last_used_at"] = time.time()  # update on every message so recency is tracked

    # Append user message
    msg_id = str(uuid.uuid4())
    conv["messages"].append({"id": msg_id, "role": "user", "content": body.message})

    # Create investigation
    investigation_id = str(uuid.uuid4())
    _investigations[investigation_id] = {
        "status": "pending",
        "connection_id": body.connection_id,
        "question": body.message,
        "workspace_id": workspace_id,
        "conversation_id": conv_id,
    }

    # Reserve slot for assistant reply
    ai_msg_id = str(uuid.uuid4())
    conv["messages"].append({
        "id": ai_msg_id,
        "role": "assistant",
        "content": "",
        "investigation_id": investigation_id,
        "status": "streaming",
    })

    # Persist immediately so the conversation appears in sidebar
    _persist_conv(conv_id, conv)

    return {
        "conversation_id": conv_id,
        "message_id": ai_msg_id,
        "investigation_id": investigation_id,
    }


@router.get("/chat/{conversation_id}/stream/{investigation_id}")
async def stream_chat(conversation_id: str, investigation_id: str, user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    conv = _conversations.get(conversation_id)
    if not conv or conv["workspace_id"] != workspace_id:
        raise HTTPException(404, "Conversation not found")

    inv = _investigations.get(investigation_id)
    if not inv or inv["workspace_id"] != workspace_id:
        raise HTTPException(404, "Investigation not found")

    # Build history for the LLM (everything before current AI placeholder)
    history = []
    for msg in conv["messages"]:
        if msg.get("investigation_id") == investigation_id:
            break
        if msg["role"] == "user":
            history.append({"role": "user", "content": msg["content"]})
        elif msg["role"] == "assistant" and msg.get("content"):
            history.append({"role": "assistant", "content": msg["content"]})

    async def event_stream():
        chat_response_text = ""
        async for chunk in run_investigation(
            investigation_id=investigation_id,
            question=inv["question"],
            connection_id=inv["connection_id"],
            workspace_id=workspace_id,
            conversation_history=history,
        ):
            yield chunk
            chunk_str = chunk.decode("utf-8", errors="ignore")
            if "event: chat_response" in chunk_str:
                m = re.search(r"data: (.+)", chunk_str)
                if m:
                    try:
                        chat_response_text = json.loads(m.group(1)).get("text", "")
                    except Exception:
                        pass
            elif "event: clarification" in chunk_str:
                m = re.search(r"data: (.+)", chunk_str)
                if m:
                    try:
                        chat_response_text = json.loads(m.group(1)).get("question", "")
                    except Exception:
                        pass

        # Update assistant message and persist to Appwrite
        for msg in conv["messages"]:
            if msg.get("investigation_id") == investigation_id:
                msg["content"] = chat_response_text
                msg["status"] = "done"
                break
        _persist_conv(conversation_id, conv)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/chat")
async def list_conversations(user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    # In-memory (current session) — keyed by conv_id, includes float last_used_at
    mem: dict[str, dict] = {
        conv_id: {
            "id": conv_id,
            "title": _title(conv),
            "message_count": len(conv["messages"]),
            "connection_id": conv["connection_id"],
            "last_used_at": conv.get("last_used_at", 0.0),
        }
        for conv_id, conv in _conversations.items()
        if conv["workspace_id"] == workspace_id
    }

    # Merge with Appwrite — fills in convs from previous server sessions
    # Appwrite returns sorted by $updatedAt desc so the most-recently-updated appear first
    persisted = await _store_list_convs(workspace_id)
    for p in persisted:
        pid = p["$id"]
        if pid not in mem:
            user_msgs = [m for m in p.get("messages", []) if m.get("role") == "user"]
            # Parse $updatedAt ISO string to float for unified sorting
            try:
                from datetime import datetime, timezone
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

    # Sort by most-recently-used first
    sorted_convs = sorted(mem.values(), key=lambda c: c["last_used_at"], reverse=True)
    # Strip internal sort key before returning
    for c in sorted_convs:
        c.pop("last_used_at", None)
    return {"conversations": sorted_convs}


@router.get("/chat/{conversation_id}")
async def get_conversation(conversation_id: str, user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    # In-memory first
    conv = _conversations.get(conversation_id)
    if conv and conv["workspace_id"] == workspace_id:
        return {
            "conversation_id": conversation_id,
            "connection_id": conv["connection_id"],
            "messages": conv["messages"],
        }

    # Fall back to Appwrite (after server restart)
    persisted = await _store_get_conv(conversation_id, workspace_id)
    if not persisted:
        raise HTTPException(404, "Conversation not found")

    # Warm in-memory cache — preserve $updatedAt so viewing doesn't change sort order
    try:
        from datetime import datetime
        _last_used = datetime.fromisoformat(
            persisted.get("$updatedAt", "").replace("Z", "+00:00")
        ).timestamp()
    except Exception:
        _last_used = 0.0
    _conversations[conversation_id] = {
        "workspace_id": workspace_id,
        "connection_id": persisted["connection_id"],
        "messages": persisted.get("messages", []),
        "last_used_at": _last_used,
    }
    return {
        "conversation_id": conversation_id,
        "connection_id": persisted["connection_id"],
        "messages": persisted.get("messages", []),
    }
