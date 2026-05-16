"""
P2 — validate → EXPLAIN → sandbox execution pipeline.
Owner: BE

Three gates in order before any SQL touches the engine:
1. Pydantic validation (already done in loop.py before calling here)
2. EXPLAIN pre-flight against live schema
3. Read-only sandbox execution with timeout + row cap
"""
import duckdb
from pydantic import ValidationError

from app.agent.schemas import SqlQueryAction, Observation
from app.config import settings

PREVIEW_ROW_LIMIT = 50


def explain_sql(con: duckdb.DuckDBPyConnection, sql: str) -> str | None:
    """Run EXPLAIN against the live schema. Returns error string if it fails, None if clean."""
    try:
        con.execute(f"EXPLAIN {sql}")
        return None
    except Exception as e:
        return str(e)


def execute_sql(
    con: duckdb.DuckDBPyConnection,
    step: int,
    action: SqlQueryAction,
) -> Observation:
    """
    Execute a validated, EXPLAIN-clean SQL statement in the read-only sandbox.
    Returns an Observation with preview ≤ PREVIEW_ROW_LIMIT rows.
    Full result is held server-side; only preview goes on the wire.
    """
    try:
        result = con.execute(action.sql)
        columns = [desc[0] for desc in result.description or []]
        rows = result.fetchmany(settings.sandbox_row_cap + 1)

        truncated = len(rows) > settings.sandbox_row_cap
        rows = rows[: settings.sandbox_row_cap]
        preview = [list(r) for r in rows[:PREVIEW_ROW_LIMIT]]

        return Observation(
            step=step,
            status="row_cap" if truncated else "ok",
            row_count=len(rows),
            columns=columns,
            preview=preview,
            truncated=truncated,
        )
    except Exception as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            return Observation(step=step, status="timeout", error=error_msg)
        return Observation(step=step, status="exec_error", error=error_msg)
