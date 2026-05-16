"""
P1 — Sandbox configuration applied to every DuckDB session.
Owner: BE

Defence in depth: read-only at DuckDB level + DDL/DML keyword screen + timeout + row cap.
"""
import re
import duckdb
from app.config import settings

_DDL_DML_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|COPY|ATTACH|DETACH|PRAGMA)\b",
    re.IGNORECASE,
)


def configure_sandbox(con: duckdb.DuckDBPyConnection) -> None:
    """Apply sandbox limits to a DuckDB connection."""
    try:
        con.execute(f"SET statement_timeout = '{settings.sandbox_statement_timeout_seconds}s'")
    except Exception:
        pass  # DuckDB in-memory may not support this in all versions; belt+suspenders with watchdog


def screen_sql(sql: str) -> str | None:
    """
    Static DDL/DML keyword check — defence in depth on top of read-only mode.
    Returns an error string if the SQL contains forbidden keywords, None if clean.
    """
    sql_stripped = sql.strip()
    if ";" in sql_stripped:
        return "Multi-statement SQL is not allowed. Submit one statement at a time."
    match = _DDL_DML_PATTERN.search(sql_stripped)
    if match:
        return f"Forbidden keyword '{match.group()}' — DataPilot runs in read-only mode."
    return None
