"""P5 — Check: numeric values stored as text (e.g. "$99.00", "1,200")."""
import uuid
import duckdb


def check_text_as_number(
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
                    COUNT(*) FILTER (WHERE regexp_matches("{col}"::VARCHAR, '^[\$£€]?[\d,]+(\.\d+)?$') AND "{col}" LIKE '%,%') AS comma_numbers,
                    COUNT(*) FILTER (WHERE regexp_matches("{col}"::VARCHAR, '^[\$£€]\d')) AS currency_strings,
                    COUNT(*) AS total,
                    ANY_VALUE("{col}") FILTER (WHERE regexp_matches("{col}"::VARCHAR, '^[\$£€]?[\d,]+(\.\d+)?$')) AS example
                FROM "{sample_table}"
                WHERE "{col}" IS NOT NULL
            """).fetchone()

            affected = int((result[0] or 0) + (result[1] or 0))
            if affected > 0:
                issues.append({
                    "id": str(uuid.uuid4()),
                    "type": "text_as_number",
                    "severity": "medium",
                    "table": table_name,
                    "column": col,
                    "affected_rows": affected,
                    "examples": [str(result[3])] if result[3] else [],
                    "message": f"Numeric values stored as text in {table_name}.{col} — {affected} rows",
                })
        except Exception:
            continue
    return issues
