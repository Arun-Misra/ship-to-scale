"""
P1 gate: Demo file opens read-only under 10 concurrent handles without 'database is locked'.
"""
import concurrent.futures
import os
import pytest
from app.db.session import DuckDBSession
from app.config import settings


@pytest.mark.skipif(
    not os.path.exists(settings.demo_db_path),
    reason="demo.duckdb not yet seeded — run data/seed/seed_demo.py first",
)
def test_demo_db_10_concurrent_readers():
    def open_and_query(_):
        session = DuckDBSession(mode="demo")
        result = session.con.execute("SELECT COUNT(*) FROM orders").fetchone()
        session.close()
        return result[0]

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(open_and_query, range(10)))

    assert all(r > 0 for r in results), "All concurrent handles should return row count > 0"


def test_live_session_requires_dsn():
    with pytest.raises(ValueError):
        DuckDBSession(mode="live", dsn=None)
