"""
P5 — Check: mixed date formats in the same column.
Runs on in-memory DuckDB sample table — never on Postgres directly.
"""
import uuid
import duckdb


def check_date_format(
    con: duckdb.DuckDBPyConnection,
    sample_table: str,
    table_name: str,
    columns: list[str],
) -> list[dict]:
    issues = []
    for col in columns:
        try:
            # Look for rows where strptime fails with ISO format but succeeds with US format
            result = con.execute(f"""
                SELECT
                    COUNT(*) FILTER (WHERE "{col}" LIKE '__/__/____' OR "{col}" LIKE '__-__-____') AS us_format,
                    COUNT(*) FILTER (WHERE "{col}" LIKE '____-__-__') AS iso_format,
                    COUNT(*) AS total,
                    ANY_VALUE("{col}") FILTER (WHERE "{col}" LIKE '__/__/____') AS example_us,
                    ANY_VALUE("{col}") FILTER (WHERE "{col}" LIKE '____-__-__') AS example_iso
                FROM "{sample_table}"
                WHERE "{col}" IS NOT NULL
            """).fetchone()

            if result and result[0] > 0 and result[1] > 0:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "type": "date_format_inconsistency",
                    "severity": "high",
                    "table": table_name,
                    "column": col,
                    "affected_rows": int(result[0] + result[1]),
                    "examples": [str(result[3]), str(result[4])],
                    "message": f"Mixed date formats in {table_name}.{col} — {result[0] + result[1]} rows affected",
                })
        except Exception:
            continue
    return issues
