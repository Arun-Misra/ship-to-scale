"""
P5 — Data quality scan orchestrator.
Owner: BE

CRITICAL — the pushdown trap:
DuckDB pushes regex/fuzzy queries down to Postgres → full table scan on customer DB.
Fix: pull 5000-row LIMIT sample into DuckDB memory FIRST, run ALL checks locally.

NEVER write to source. NEVER fix. NEVER auto-apply. Show problems only.
"""
import uuid
from datetime import datetime, timezone
import duckdb

from app.quality.checks.date_format import check_date_format
from app.quality.checks.text_as_number import check_text_as_number
from app.quality.checks.nulls import check_unexpected_nulls
from app.quality.checks.duplicates import check_likely_duplicates
from app.quality.checks.cardinality import check_cardinality_anomalies

SAMPLE_ROWS = 5000


def run_quality_scan(con: duckdb.DuckDBPyConnection, connection_id: str) -> dict:
    """
    Run all quality checks on a 5000-row in-memory sample.
    Returns the API response shape from api-contract.json /connections/{id}/quality.
    """
    issues = []

    tables = _get_tables(con)
    for table_name in tables:
        cols = _get_columns(con, table_name)
        col_list = ", ".join(f'"{c}"' for c in cols)

        # Pull sample into DuckDB memory — LIMIT 5000 is safe pushdown to Postgres
        sample_table = f"_sample_{table_name}"
        try:
            con.execute(
                f'CREATE OR REPLACE TEMP TABLE "{sample_table}" AS '
                f'SELECT {col_list} FROM src."{table_name}" LIMIT {SAMPLE_ROWS}'
            )
        except Exception:
            continue  # skip table if sample fails

        # Run all checks on the in-memory sample — never on Postgres
        issues += check_date_format(con, sample_table, table_name, cols)
        issues += check_text_as_number(con, sample_table, table_name, cols)
        issues += check_unexpected_nulls(con, sample_table, table_name, cols)
        issues += check_likely_duplicates(con, sample_table, table_name, cols)
        issues += check_cardinality_anomalies(con, sample_table, table_name, cols)

    summary = {
        "high": sum(1 for i in issues if i["severity"] == "high"),
        "medium": sum(1 for i in issues if i["severity"] == "medium"),
        "low": sum(1 for i in issues if i["severity"] == "low"),
    }

    return {
        "connection_id": connection_id,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "issues": issues,
        "summary": summary,
    }


def _get_tables(con: duckdb.DuckDBPyConnection) -> list[str]:
    try:
        rows = con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'src' AND table_type = 'BASE TABLE'"
        ).fetchall()
        return [r[0] for r in rows]
    except Exception:
        return []


def _get_columns(con: duckdb.DuckDBPyConnection, table_name: str) -> list[str]:
    try:
        rows = con.execute(
            f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'src' AND table_name = '{table_name}' ORDER BY ordinal_position"
        ).fetchall()
        return [r[0] for r in rows]
    except Exception:
        return []
