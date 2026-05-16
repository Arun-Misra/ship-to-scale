"""
P1/P3 — Connection registration, schema crawl, quality scan.
Owner: BE
"""
import dataclasses
import duckdb
import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal

from app.appwrite.auth import require_auth
from app.db.session import DuckDBSession
from app.db.schema_crawler import crawl_schema
from app.quality.scanner import run_quality_scan
from app.appwrite.store import save_connection, get_connection

router = APIRouter()


class RegisterConnectionRequest(BaseModel):
    kind: Literal["postgres", "demo"]
    dsn: str | None = None
    label: str


def _probe_read_only(dsn: str) -> None:
    """
    Verify the Postgres role is truly read-only.
    Attempts DDL via a raw DuckDB probe connection (no READ_ONLY flag).
    Raises HTTPException(400) if the role can write.
    """
    probe = duckdb.connect(":memory:")
    try:
        probe.execute("INSTALL postgres; LOAD postgres;")
        probe.execute(f"ATTACH '{dsn}' AS _probe (TYPE postgres)")
        try:
            probe.execute("CREATE TABLE _probe.public._niriya_rw_check (x int)")
            # Succeeded — role is writable. Clean up and reject.
            try:
                probe.execute("DROP TABLE _probe.public._niriya_rw_check")
            except Exception:
                pass
            raise HTTPException(
                400,
                "Supplied Postgres role can write — Niriya requires a read-only role. Grant SELECT only.",
            )
        except HTTPException:
            raise
        except Exception as e:
            err = str(e).lower()
            # "permission denied" or DuckDB not supporting DDL on postgres → role is read-only or probe inconclusive
            # Either way, READ_ONLY ATTACH is the structural guard. Let through.
            if "permission denied" in err or "read-only" in err:
                pass  # confirmed read-only ✓
            # Other errors (feature unsupported, etc.) — let through, ATTACH READ_ONLY protects us
    finally:
        try:
            probe.close()
        except Exception:
            pass


@router.post("/connections")
async def register_connection(body: RegisterConnectionRequest, user=Depends(require_auth)):
    workspace_id = user["workspace_id"]

    if body.kind == "demo":
        session = DuckDBSession(mode="demo")
        try:
            schema = await anyio.to_thread.run_sync(
                lambda: crawl_schema(session.con, schema_name="main")
            )
            connection_id = await save_connection(
                workspace_id=workspace_id,
                kind="demo",
                label=body.label,
                schema=dataclasses.asdict(schema),
                dsn="",
            )
        finally:
            session.close()
        return {"connection_id": connection_id}

    # postgres path
    if not body.dsn:
        raise HTTPException(400, "DSN required for postgres connections")

    await anyio.to_thread.run_sync(lambda: _probe_read_only(body.dsn))

    session = DuckDBSession(mode="live", dsn=body.dsn)
    try:
        schema = await anyio.to_thread.run_sync(
            lambda: crawl_schema(session.con, schema_name="src")
        )
        connection_id = await save_connection(
            workspace_id=workspace_id,
            kind="postgres",
            label=body.label,
            schema=dataclasses.asdict(schema),
            dsn=body.dsn,
        )
    finally:
        session.close()

    return {"connection_id": connection_id}


@router.get("/connections/{connection_id}/schema")
async def get_schema(connection_id: str, user=Depends(require_auth)):
    conn = await get_connection(connection_id, workspace_id=user["workspace_id"])
    if not conn:
        raise HTTPException(404, "Connection not found")
    return {"connection_id": connection_id, "schema": conn.get("schema", "{}")}


@router.get("/connections/{connection_id}/quality")
async def get_quality(connection_id: str, user=Depends(require_auth)):
    # TODO P5:
    # 1. Load connection from Appwrite
    # 2. Open DuckDB session (read-only)
    # 3. run_quality_scan — pulls 5000-row sample into DuckDB memory, runs checks locally
    # 4. Return issues[] — NEVER writes to source, NEVER auto-fixes anything
    raise NotImplementedError
