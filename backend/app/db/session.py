"""
P1 — DuckDB session management. THE highest-risk technical decision.
Owner: BE

TWO and ONLY TWO ways a DuckDB connection is ever created:

  demo path: duckdb.connect(DEMO_PATH, read_only=True)
             — safe for N concurrent openers. "20 judges at once" cannot crash it.

  live path: duckdb.connect(':memory:') then ATTACH '<dsn>' (TYPE postgres, READ_ONLY)
             — one connection per investigation session, created once, destroyed in finally.

FORBIDDEN: a single persistent .duckdb FILE opened writable under multiple workers.
           This combination will produce "database is locked" and kill the demo.
"""
from typing import Literal
import duckdb
from app.config import settings
from app.db.sandbox import configure_sandbox


class DuckDBSession:
    def __init__(self, mode: Literal["demo", "live"], dsn: str | None = None):
        if mode == "demo":
            self.con = duckdb.connect(settings.demo_db_path, read_only=True)
        else:
            if not dsn:
                raise ValueError("DSN required for live mode")
            self.con = duckdb.connect(":memory:")
            self.con.execute("INSTALL postgres; LOAD postgres;")
            self.con.execute(f"ATTACH '{dsn}' AS src (TYPE postgres, READ_ONLY)")

        configure_sandbox(self.con)

    def close(self) -> None:
        try:
            self.con.close()
        except Exception:
            pass  # already closed — not an error


class SessionManager:
    """Owns the lifecycle of investigation sessions. Keyed by investigation_id."""

    def __init__(self):
        self._sessions: dict[str, DuckDBSession] = {}

    def create(self, investigation_id: str, mode: Literal["demo", "live"], dsn: str | None = None) -> DuckDBSession:
        session = DuckDBSession(mode=mode, dsn=dsn)
        self._sessions[investigation_id] = session
        return session

    def get(self, investigation_id: str) -> DuckDBSession | None:
        return self._sessions.get(investigation_id)

    def close(self, investigation_id: str) -> None:
        session = self._sessions.pop(investigation_id, None)
        if session:
            session.close()


session_manager = SessionManager()
