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


def crawl_schema(con: duckdb.DuckDBPyConnection, schema_name: str = "src") -> SchemaGraph:
    """
    Crawl schema via DuckDB's information_schema views.
    schema_name="src" for live postgres (ATTACHed as src).
    schema_name="main" for demo DuckDB file.
    Infers FK relationships by name/type heuristics when real FKs are absent.
    """
    graph = SchemaGraph()

    try:
        tables_result = con.execute(
            f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{schema_name}' AND table_type = 'BASE TABLE'"
        ).fetchall()

        for (table_name,) in tables_result:
            cols_result = con.execute(
                f"SELECT column_name, data_type, is_nullable FROM information_schema.columns "
                f"WHERE table_schema = '{schema_name}' AND table_name = '{table_name}' ORDER BY ordinal_position"
            ).fetchall()
            columns = [
                ColumnInfo(name=c[0], type=c[1], nullable=(c[2] == "YES"))
                for c in cols_result
            ]
            # Row estimate — best effort, non-fatal
            try:
                row_est = con.execute(
                    f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"'
                ).fetchone()[0]
            except Exception:
                row_est = 0

            graph.tables.append(TableInfo(name=table_name, columns=columns, row_estimate=row_est))

        # Infer FK relationships by naming convention (e.g. customer_id → customers.id)
        table_names = {t.name for t in graph.tables}
        for table in graph.tables:
            for col in table.columns:
                if not col.name.endswith("_id"):
                    continue
                referenced = col.name[:-3]  # strip _id suffix
                # Try plural and singular forms
                for candidate in (referenced + "s", referenced):
                    if candidate in table_names and candidate != table.name:
                        graph.relationships.append(Relationship(
                            from_table=table.name,
                            from_col=col.name,
                            to_table=candidate,
                            to_col="id",
                            inferred=True,
                        ))
                        break

    except Exception:
        pass  # Schema crawl failure is non-fatal

    return graph
