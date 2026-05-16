"""
P1/P2 — SSE serialization chokepoint.
Owner: BE

INVARIANT: ALL structured events go through sse_struct(). No exceptions.
model_dump_json() either fully succeeds or raises server-side — never a partial JSON on the wire.
"""
from pydantic import BaseModel


def sse_struct(event: str, model: BaseModel) -> bytes:
    """Emit a fully-valid structured SSE event. Raises server-side if serialization fails."""
    payload = model.model_dump_json()
    return f"event: {event}\ndata: {payload}\n\n".encode()


def sse_reasoning(token_text: str) -> bytes:
    """Emit opaque reasoning text. Newlines escaped so FE can un-escape on append."""
    safe = token_text.replace("\n", "\\n")
    return f"event: reasoning\ndata: {safe}\n\n".encode()


def sse_keepalive() -> bytes:
    """SSE comment — proxies won't drop the connection. FE skips frames with no event:/data:."""
    return b": keepalive\n\n"
