"""P5 — Check: enum-like columns with unexpected variants (e.g. "Male"/"male"/"M")."""
import uuid
import duckdb

MAX_ENUM_CARDINALITY = 20  # columns with ≤20 distinct values are treated as enums


def check_cardinality_anomalies(
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
                    COUNT(DISTINCT "{col}") AS distinct_count,
                    COUNT(DISTINCT lower(trim("{col}"::VARCHAR))) AS distinct_normalized,
                    COUNT(*) AS total
                FROM "{sample_table}"
                WHERE "{col}" IS NOT NULL
            """).fetchone()

            if result and result[0] <= MAX_ENUM_CARDINALITY and result[0] != result[1]:
                # More distinct raw values than normalized values → case/whitespace variants exist
                top_values = con.execute(f"""
                    SELECT "{col}"::VARCHAR AS val, COUNT(*) AS cnt
                    FROM "{sample_table}"
                    WHERE "{col}" IS NOT NULL
                    GROUP BY val ORDER BY cnt DESC LIMIT 8
                """).fetchall()
                examples = [str(r[0]) for r in top_values]
                issues.append({
                    "id": str(uuid.uuid4()),
                    "type": "cardinality_anomaly",
                    "severity": "medium",
                    "table": table_name,
                    "column": col,
                    "affected_rows": 0,
                    "examples": examples,
                    "message": f"{table_name}.{col} has {result[0]} variants but {result[1]} normalized — possible case/whitespace inconsistency",
                })
        except Exception:
            continue
    return issues
