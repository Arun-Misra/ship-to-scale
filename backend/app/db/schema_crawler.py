"""
P3 — Schema crawl on connect. Produces SchemaGraph persisted to Appwrite.
Owner: BE
"""
from dataclasses import dataclass, field
import duckdb


@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool


@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo]
    row_estimate: int = 0


@dataclass
class Relationship:
    from_table: str
    from_col: str
    to_table: str
    to_col: str
    inferred: bool = False  # True = heuristic name match, not a real FK


@dataclass
class SchemaGraph:
    tables: list[TableInfo] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)
    views: list[dict] = field(default_factory=list)
    dbt_metrics: list[dict] = field(default_factory=list)


def crawl_schema(con: duckdb.DuckDBPyConnection) -> SchemaGraph:
    """
    Crawl the attached Postgres schema via DuckDB's information_schema views.
    Infers FK relationships by name/type heuristics when real FKs are absent.
    TODO P3: implement fully.
    """
    graph = SchemaGraph()

    try:
        tables_result = con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'src' AND table_type = 'BASE TABLE'"
        ).fetchall()

        for (table_name,) in tables_result:
            cols_result = con.execute(
                f"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'src' AND table_name = '{table_name}' ORDER BY ordinal_position"
            ).fetchall()
            columns = [
                ColumnInfo(name=c[0], type=c[1], nullable=(c[2] == "YES"))
                for c in cols_result
            ]
            graph.tables.append(TableInfo(name=table_name, columns=columns))
    except Exception:
        pass  # Schema crawl failure is non-fatal — log and continue

    return graph
