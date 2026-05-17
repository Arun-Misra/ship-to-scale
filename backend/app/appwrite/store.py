"""
P3/P5/P6 — All Appwrite data access.
Owner: BE

CRITICAL: Every SDK call MUST be wrapped in anyio.to_thread.run_sync().
The Appwrite Python SDK is synchronous. Calling it directly in async code blocks the ASGI event loop.

Pattern:
    result = await anyio.to_thread.run_sync(lambda: db.list_documents(...))

SDK v18 note: list_documents/get_document return Pydantic models (Document / DocumentList).
_to_dict() normalises them back to the flat dict format the rest of the code expects.
"""
import json
import warnings
import anyio

# Suppress Appwrite SDK deprecation warnings (API deprecated in favour of Tables in v1.8+)
warnings.filterwarnings("ignore", category=DeprecationWarning, module="appwrite")
from appwrite.query import Query

from app.appwrite.client import db
from app.config import settings

DB = settings.appwrite_db_id
C = settings  # shorthand for collection IDs


def _to_dict(doc) -> dict:
    """Normalise an SDK v18 Document model to a flat dict matching old SDK v6 format."""
    d: dict = {"$id": doc.id, "$createdAt": doc.createdat, "$updatedAt": doc.updatedat}
    if doc.data:
        d.update(doc.data)
    return d


def _sdk_call(fn):
    """Suppress Appwrite SDK deprecation warnings that fire on every call."""
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        return fn()


# ── Connections ──────────────────────────────────────────────────────────────

async def save_connection(workspace_id: str, kind: str, label: str, schema: dict, dsn: str = "") -> str:
    # DSN stored here for hackathon convenience. Move to a KMS / encrypted store for production.
    doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.create_document(
        database_id=DB,
        collection_id=C.appwrite_collection_connections,
        document_id="unique()",
        data={
            "workspace_id": workspace_id,
            "kind": kind,
            "label": label,
            "schema": json.dumps(schema),
            "dsn": dsn,
        },
    )))
    return doc.id


async def get_connection(connection_id: str, workspace_id: str) -> dict | None:
    """Returns the connection only if it belongs to the given workspace."""
    try:
        doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.get_document(
            database_id=DB,
            collection_id=C.appwrite_collection_connections,
            document_id=connection_id,
        )))
        d = _to_dict(doc)
        if d.get("workspace_id") != workspace_id:
            return None
        return d
    except Exception:
        return None


async def delete_connection(connection_id: str, workspace_id: str) -> bool:
    """Delete a connection if it belongs to the given workspace. Returns True on success."""
    try:
        doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.get_document(
            database_id=DB,
            collection_id=C.appwrite_collection_connections,
            document_id=connection_id,
        )))
        if _to_dict(doc).get("workspace_id") != workspace_id:
            return False
        await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.delete_document(
            database_id=DB,
            collection_id=C.appwrite_collection_connections,
            document_id=connection_id,
        )))
        return True
    except Exception:
        return False


async def delete_conversations_for_connection(connection_id: str, workspace_id: str) -> None:
    """Best-effort delete all Appwrite conversations linked to this connection."""
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id="chat_conversations",
            queries=[
                Query.equal("workspace_id", workspace_id),
                Query.equal("connection_id", connection_id),
                Query.limit(100),
            ],
        )))
        for doc in result.documents:
            try:
                doc_id = doc.id
                await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.delete_document(
                    database_id=DB,
                    collection_id="chat_conversations",
                    document_id=doc_id,
                )))
            except Exception:
                pass
    except Exception:
        pass


async def delete_investigations_for_connection(connection_id: str, workspace_id: str) -> None:
    """Best-effort delete all Appwrite investigation records for this connection."""
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_investigations,
            queries=[
                Query.equal("workspace_id", workspace_id),
                Query.equal("connection_id", connection_id),
                Query.limit(100),
            ],
        )))
        for doc in result.documents:
            try:
                doc_id = doc.id
                await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.delete_document(
                    database_id=DB,
                    collection_id=C.appwrite_collection_investigations,
                    document_id=doc_id,
                )))
            except Exception:
                pass
    except Exception:
        pass


# ── Semantic definitions ──────────────────────────────────────────────────────

async def list_semantic_definitions(workspace_id: str) -> list[dict]:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            queries=[Query.equal("workspace_id", workspace_id)],
        )))
        return [_to_dict(d) for d in result.documents]
    except Exception:
        return []


async def get_semantic_definition(term: str, workspace_id: str) -> dict | None:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            queries=[
                Query.equal("workspace_id", workspace_id),
                Query.equal("term", term),
            ],
        )))
        docs = result.documents
        return _to_dict(docs[0]) if docs else None
    except Exception:
        return None


async def save_semantic_definition(
    workspace_id: str,
    term: str,
    natural_language: str,
    definition_sql: str,
    source: str,
    materiality: str,
) -> None:
    await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.create_document(
        database_id=DB,
        collection_id=C.appwrite_collection_semantic,
        document_id="unique()",
        data={
            "workspace_id": workspace_id,
            "term": term,
            "natural_language": natural_language,
            "definition_sql": definition_sql,
            "source": source,
            "materiality": materiality,
        },
    )))


# ── Slack installations ───────────────────────────────────────────────────────

async def delete_semantic_definition(doc_id: str, workspace_id: str) -> bool:
    try:
        doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.get_document(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            document_id=doc_id,
        )))
        if _to_dict(doc).get("workspace_id") != workspace_id:
            return False
        await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.delete_document(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            document_id=doc_id,
        )))
        return True
    except Exception:
        return False


async def get_slack_installation(slack_team_id: str) -> dict | None:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_slack_installations,
            queries=[Query.equal("slack_team_id", slack_team_id)],
        )))
        docs = result.documents
        return _to_dict(docs[0]) if docs else None
    except Exception:
        return None


async def get_slack_installation_for_workspace(workspace_id: str) -> dict | None:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_slack_installations,
            queries=[Query.equal("appwrite_workspace_id", workspace_id)],
        )))
        docs = result.documents
        return _to_dict(docs[0]) if docs else None
    except Exception:
        return None


async def upsert_slack_installation(
    slack_team_id: str,
    slack_team_name: str,
    slack_bot_token: str,
    appwrite_workspace_id: str,
    default_connection_id: str = "",
) -> None:
    existing = await get_slack_installation(slack_team_id)
    if existing:
        doc_id = existing["$id"]
        await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.update_document(
            database_id=DB,
            collection_id=C.appwrite_collection_slack_installations,
            document_id=doc_id,
            data={
                "slack_team_name": slack_team_name,
                "slack_bot_token": slack_bot_token,
                "appwrite_workspace_id": appwrite_workspace_id,
                "default_connection_id": default_connection_id,
            },
        )))
    else:
        await create_slack_installation(
            slack_team_id=slack_team_id,
            slack_team_name=slack_team_name,
            slack_bot_token=slack_bot_token,
            appwrite_workspace_id=appwrite_workspace_id,
            default_connection_id=default_connection_id,
        )


async def create_slack_installation(
    slack_team_id: str,
    slack_team_name: str,
    slack_bot_token: str,
    appwrite_workspace_id: str,
    default_connection_id: str = "",
) -> None:
    await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.create_document(
        database_id=DB,
        collection_id=C.appwrite_collection_slack_installations,
        document_id="unique()",
        data={
            "slack_team_id": slack_team_id,
            "slack_team_name": slack_team_name,
            "slack_bot_token": slack_bot_token,  # encrypted at rest by Appwrite
            "appwrite_workspace_id": appwrite_workspace_id,
            "default_connection_id": default_connection_id,
        },
    )))


# ── Investigations ────────────────────────────────────────────────────────────

async def save_investigation_record(
    investigation_id: str,
    workspace_id: str,
    question: str,
    connection_id: str,
) -> None:
    try:
        await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.create_document(
            database_id=DB,
            collection_id=C.appwrite_collection_investigations,
            document_id=investigation_id,
            data={
                "workspace_id": workspace_id,
                "question": question,
                "connection_id": connection_id,
                "status": "pending",
                "verdict": "",
                "root_cause": "",
                "confidence": "",
                "recommended_action": "",
            },
        )))
    except Exception:
        pass  # fall back to in-memory state


async def update_investigation_result(
    investigation_id: str,
    verdict: str,
    root_cause: str,
    confidence: str,
    recommended_action: str,
) -> None:
    try:
        await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.update_document(
            database_id=DB,
            collection_id=C.appwrite_collection_investigations,
            document_id=investigation_id,
            data={
                "status": "completed",
                "verdict": verdict,
                "root_cause": root_cause,
                "confidence": confidence,
                "recommended_action": recommended_action,
            },
        )))
    except Exception:
        pass


async def get_investigation_record(investigation_id: str, workspace_id: str) -> dict | None:
    try:
        doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.get_document(
            database_id=DB,
            collection_id=C.appwrite_collection_investigations,
            document_id=investigation_id,
        )))
        d = _to_dict(doc)
        if d.get("workspace_id") != workspace_id:
            return None
        return d
    except Exception:
        return None


async def list_recent_investigations(workspace_id: str, limit: int = 20) -> list[dict]:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_investigations,
            queries=[Query.equal("workspace_id", workspace_id), Query.limit(limit), Query.order_desc("$createdAt")],
        )))
        return [_to_dict(d) for d in result.documents]
    except Exception:
        return []


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_connections_for_workspace(workspace_id: str) -> list[dict]:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_connections,
            queries=[Query.equal("workspace_id", workspace_id)],
        )))
        return [_to_dict(d) for d in result.documents]
    except Exception:
        return []


# ── Chat conversations ────────────────────────────────────────────────────────

async def save_conversation(
    conversation_id: str,
    workspace_id: str,
    connection_id: str,
    title: str,
    messages: list[dict],
) -> None:
    try:
        messages_json = json.dumps(messages)
        # Try update first, create if not found
        try:
            await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.update_document(
                database_id=DB,
                collection_id="chat_conversations",
                document_id=conversation_id,
                data={"messages_json": messages_json, "title": title},
            )))
        except Exception:
            await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.create_document(
                database_id=DB,
                collection_id="chat_conversations",
                document_id=conversation_id,
                data={
                    "workspace_id": workspace_id,
                    "connection_id": connection_id,
                    "title": title,
                    "messages_json": messages_json,
                },
            )))
    except Exception:
        pass


async def list_conversations(workspace_id: str) -> list[dict]:
    try:
        result = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.list_documents(
            database_id=DB,
            collection_id="chat_conversations",
            queries=[Query.equal("workspace_id", workspace_id), Query.limit(50), Query.order_desc("$updatedAt")],
        )))
        out = []
        for d in result.documents:
            flat = _to_dict(d)
            try:
                flat["messages"] = json.loads(flat.get("messages_json") or "[]")
            except Exception:
                flat["messages"] = []
            out.append(flat)
        return out
    except Exception:
        return []


async def get_conversation(conversation_id: str, workspace_id: str) -> dict | None:
    try:
        doc = await anyio.to_thread.run_sync(lambda: _sdk_call(lambda: db.get_document(
            database_id=DB,
            collection_id="chat_conversations",
            document_id=conversation_id,
        )))
        d = _to_dict(doc)
        if d.get("workspace_id") != workspace_id:
            return None
        try:
            d["messages"] = json.loads(d.get("messages_json") or "[]")
        except Exception:
            d["messages"] = []
        return d
    except Exception:
        return None


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_dashboard_summary(workspace_id: str) -> dict:
    connections = await get_connections_for_workspace(workspace_id)
    return {
        "connected_sources": len(connections),
        "connections": [
            {"id": c["$id"], "label": c.get("label", ""), "kind": c.get("kind", "")}
            for c in connections
        ],
        "last_query_at": None,
        "key_metrics": [],
        "recent_investigations": [],  # filled in by the dashboard route
    }
