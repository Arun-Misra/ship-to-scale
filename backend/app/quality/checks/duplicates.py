"""
P5 — Check: likely duplicate rows on key identifier columns (email, name, ID).
Runs on in-memory sample ONLY. Never pushes fuzzy matching to Postgres.
"""
import uuid
import duckdb

# Columns where uniqueness is always expected (regardless of table context)
UNIQUE_HINTS = {"email", "name", "customer_name", "user_name", "phone", "mobile"}


def _singular(name: str) -> str:
    """Best-effort plural → singular for table name matching."""
    if name.endswith("ies"):
        return name[:-3] + "y"   # companies → company
    if name.endswith("es") and len(name) > 3:
        return name[:-2]          # processes → process
    if name.endswith("s") and len(name) > 2:
        return name[:-1]          # orders → order
    return name


def _is_uniqueness_candidate(col: str, table_name: str) -> bool:
    """
    Returns True only if the column is plausibly a unique identifier for this table.

    Exact "id" column or {table}_id (own PK) → check.
    {other}_id columns → skip — they are foreign keys where repeats are expected.
    """
    col_lower = col.lower()
    table_lower = table_name.lower()
    table_singular = _singular(table_lower)

    if col_lower.endswith("_id"):
        prefix = col_lower[:-3]  # strip "_id"
        # Own PK: "order_id" in "orders", "customer_id" in "customers", "company_id" in "companies"
        if prefix in table_lower or prefix in table_singular:
            return True
        # Foreign key — customer_id in orders, order_id in invoices, etc. → skip
        return False

    if col_lower == "id":
        return True

    return any(hint in col_lower for hint in UNIQUE_HINTS)


def check_likely_duplicates(
    con: duckdb.DuckDBPyConnection,
    sample_table: str,
    table_name: str,
    columns: list[str],
) -> list[dict]:
    issues = []
    candidate_cols = [c for c in columns if _is_uniqueness_candidate(c, table_name)]

    for col in candidate_cols:
        try:
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
