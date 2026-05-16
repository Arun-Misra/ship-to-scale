"""
P5 — Check: likely duplicate rows on key identifier columns (email, name, ID).
Runs on in-memory sample ONLY. Never pushes fuzzy matching to Postgres.
"""
import uuid
import duckdb

ID_COLUMN_HINTS = {"email", "name", "customer_name", "user_name", "id", "phone", "mobile"}


def check_likely_duplicates(
    con: duckdb.DuckDBPyConnection,
    sample_table: str,
    table_name: str,
    columns: list[str],
) -> list[dict]:
    issues = []
    candidate_cols = [c for c in columns if any(hint in c.lower() for hint in ID_COLUMN_HINTS)]

    for col in candidate_cols:
        try:
            # Simple exact-duplicate check on the candidate column (in DuckDB memory only)
            result = con.execute(f"""
                SELECT
                    "{col}",
                    COUNT(*) AS cnt
                FROM "{sample_table}"
                WHERE "{col}" IS NOT NULL
                GROUP BY "{col}"
                HAVING COUNT(*) > 1
                ORDER BY cnt DESC
                LIMIT 5
            """).fetchall()

            if result:
                total_dupes = sum(r[1] - 1 for r in result)
                examples = [str(r[0]) for r in result[:3]]
                issues.append({
                    "id": str(uuid.uuid4()),
                    "type": "likely_duplicates",
                    "severity": "high",
                    "table": table_name,
                    "column": col,
                    "affected_rows": total_dupes,
                    "examples": examples,
                    "message": f"Likely duplicates in {table_name}.{col} — {total_dupes} duplicate rows in sample",
                })
        except Exception:
            continue
    return issues
