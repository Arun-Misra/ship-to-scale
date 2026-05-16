"""
P1/P3 — Connection registration, schema crawl, quality scan.
Owner: BE
"""
from fastapi import APIRouter, Depends
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


@router.post("/connections")
async def register_connection(body: RegisterConnectionRequest, user=Depends(require_auth)):
    # TODO P3:
    # 1. If kind=postgres, verify DSN is read-only (probe write in rolled-back txn — reject if it succeeds)
    # 2. Open DuckDB session, ATTACH with READ_ONLY
    # 3. Crawl schema (crawl_schema)
    # 4. Save connection + schema to Appwrite (save_connection)
    # 5. Return connection_id
    raise NotImplementedError


@router.get("/connections/{connection_id}/schema")
async def get_schema(connection_id: str, user=Depends(require_auth)):
    # TODO P3: load schema graph from Appwrite, return it
    raise NotImplementedError


@router.get("/connections/{connection_id}/quality")
async def get_quality(connection_id: str, user=Depends(require_auth)):
    # TODO P5:
    # 1. Load connection from Appwrite
    # 2. Open DuckDB session (read-only)
    # 3. run_quality_scan — pulls 5000-row sample into DuckDB memory, runs checks locally
    # 4. Return issues[] — NEVER writes to source, NEVER auto-fixes anything
    raise NotImplementedError
