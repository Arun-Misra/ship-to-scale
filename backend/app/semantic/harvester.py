"""
P5 — Semantic harvester: mine existing DB views + dbt manifest for definitions.
Owner: BE

Honest scope: strong for DB connections, explicitly weak for cold CSV.
Do NOT overclaim harvesting on cold CSV — state this clearly in the UI.
"""
import duckdb
from app.appwrite.store import save_semantic_definition


def harvest_from_views(con: duckdb.DuckDBPyConnection, workspace_id: str) -> list[dict]:
    """
    Extract metric-like column aliases from existing SQL views.
    Returns a list of harvested definition dicts (not yet saved).
    TODO P5: parse view definitions for SUM/COUNT/AVG patterns with aliases.
    """
    harvested = []
    try:
        views = con.execute(
            "SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = 'src'"
        ).fetchall()
        for name, definition in views:
            # TODO: parse definition SQL for revenue/churn/etc patterns
            pass
    except Exception:
        pass
    return harvested


def harvest_from_dbt_manifest(manifest: dict, workspace_id: str) -> list[dict]:
    """
    Parse dbt manifest.json nodes + metrics block.
    Returns a list of definition dicts to be saved with source='dbt'.
    TODO P5: implement dbt metric node parsing.
    """
    definitions = []
    metrics = manifest.get("metrics", {})
    for metric_name, metric in metrics.items():
        definitions.append({
            "term": metric_name,
            "natural_language": metric.get("description", ""),
            "definition_sql": metric.get("calculation_method", ""),
            "source": "dbt",
            "materiality": "material",
        })
    return definitions
