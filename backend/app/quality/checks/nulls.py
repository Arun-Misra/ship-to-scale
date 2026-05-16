"""P5 — Check: unexpected high null % in columns expected to be populated."""
import uuid
import duckdb

HIGH_NULL_THRESHOLD = 0.2  # flag if >20% null


def check_unexpected_nulls(
    con: duckdb.DuckDBPyConnection,
    sample_table: str,
    table_name: str,
    columns: list[str],
) -> list[dict]:
    issues = []
    for col in columns:
        try:
            result = con.execute(f"""
                SELECT
                    COUNT(*) FILTER (WHERE "{col}" IS NULL) AS null_count,
                    COUNT(*) AS total
                FROM "{sample_table}"
            """).fetchone()

            if result and result[1] > 0:
                null_pct = result[0] / result[1]
                if null_pct > HIGH_NULL_THRESHOLD:
                    issues.append({
                        "id": str(uuid.uuid4()),
                        "type": "unexpected_nulls",
                        "severity": "high" if null_pct > 0.5 else "medium",
                        "table": table_name,
                        "column": col,
                        "affected_rows": int(result[0]),
                        "examples": [f"{null_pct:.1%} null in sample"],
                        "message": f"{null_pct:.1%} of {table_name}.{col} is null ({result[0]}/{result[1]} rows in sample)",
                    })
        except Exception:
            continue
    return issues
