"""
P3/P5/P6 — All Appwrite data access.
Owner: BE

CRITICAL: Every SDK call MUST be wrapped in anyio.to_thread.run_sync().
The Appwrite Python SDK is synchronous. Calling it directly in async code blocks the ASGI event loop.

Pattern:
    result = await anyio.to_thread.run_sync(lambda: db.list_documents(...))
"""
import anyio
from appwrite.query import Query

from app.appwrite.client import db
from app.config import settings

DB = settings.appwrite_db_id
C = settings  # shorthand for collection IDs


# ── Connections ──────────────────────────────────────────────────────────────

async def save_connection(workspace_id: str, kind: str, label: str, schema: dict) -> str:
    doc = await anyio.to_thread.run_sync(lambda: db.create_document(
        database_id=DB,
        collection_id=C.appwrite_collection_connections,
        document_id="unique()",
        data={"workspace_id": workspace_id, "kind": kind, "label": label, "schema": str(schema)},
    ))
    return doc["$id"]


async def get_connection(connection_id: str) -> dict | None:
    try:
        return await anyio.to_thread.run_sync(lambda: db.get_document(
            database_id=DB,
            collection_id=C.appwrite_collection_connections,
            document_id=connection_id,
        ))
    except Exception:
        return None


# ── Semantic definitions ──────────────────────────────────────────────────────

async def list_semantic_definitions(workspace_id: str) -> list[dict]:
    try:
        result = await anyio.to_thread.run_sync(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            queries=[Query.equal("workspace_id", workspace_id)],
        ))
        return result["documents"]
    except Exception:
        return []


async def get_semantic_definition(term: str, workspace_id: str) -> dict | None:
    try:
        result = await anyio.to_thread.run_sync(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_semantic,
            queries=[
                Query.equal("workspace_id", workspace_id),
                Query.equal("term", term),
            ],
        ))
        docs = result["documents"]
        return docs[0] if docs else None
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
    await anyio.to_thread.run_sync(lambda: db.create_document(
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
    ))


# ── Slack installations ───────────────────────────────────────────────────────

async def get_slack_installation(slack_team_id: str) -> dict | None:
    try:
        result = await anyio.to_thread.run_sync(lambda: db.list_documents(
            database_id=DB,
            collection_id=C.appwrite_collection_slack_installations,
            queries=[Query.equal("slack_team_id", slack_team_id)],
        ))
        docs = result["documents"]
        return docs[0] if docs else None
    except Exception:
        return None


async def create_slack_installation(
    slack_team_id: str,
    slack_team_name: str,
    slack_bot_token: str,
    appwrite_workspace_id: str,
    default_connection_id: str = "",
) -> None:
    await anyio.to_thread.run_sync(lambda: db.create_document(
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
    ))


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_dashboard_summary(workspace_id: str) -> dict:
    # TODO P5: aggregate connections + recent investigations
    return {
        "connected_sources": 0,
        "last_query_at": None,
        "key_metrics": [],
        "recent_investigations": [],
    }
