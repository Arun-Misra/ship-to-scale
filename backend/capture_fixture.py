"""
Capture a live investigation into fixtures/replay_fixture.json.
Run once before demo; replay.py will serve the fixture to the frontend.

Usage:
    cd backend
    python capture_fixture.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Inject real demo schema so the agent uses correct column names (region, not city).
# Appwrite is not available in capture context — patch loop.get_connection to return
# a fake demo conn_doc with the pre-crawled schema embedded.
# NOTE: loop.py uses `from app.appwrite.store import get_connection` — so we must
# patch the name inside app.agent.loop, not app.appwrite.store.
_DEMO_SCHEMA = json.dumps({
    "tables": [
        {"name": "customers", "columns": [
            {"name": "customer_id", "type": "INTEGER", "nullable": False},
            {"name": "name",        "type": "VARCHAR", "nullable": True},
            {"name": "email",       "type": "VARCHAR", "nullable": True},
            {"name": "region",      "type": "VARCHAR", "nullable": True},
            {"name": "signup_date", "type": "VARCHAR", "nullable": True},
            {"name": "plan",        "type": "VARCHAR", "nullable": True},
        ], "row_estimate": 5},
        {"name": "orders", "columns": [
            {"name": "order_id",     "type": "INTEGER",       "nullable": False},
            {"name": "customer_id",  "type": "INTEGER",       "nullable": True},
            {"name": "order_total",  "type": "DECIMAL(10,2)", "nullable": True},
            {"name": "refunded",     "type": "BOOLEAN",       "nullable": True},
            {"name": "shipping_fee", "type": "DECIMAL(10,2)", "nullable": True},
            {"name": "status",       "type": "VARCHAR",       "nullable": True},
            {"name": "created_at",   "type": "VARCHAR",       "nullable": True},
            {"name": "region",       "type": "VARCHAR",       "nullable": True},
        ], "row_estimate": 507},
    ],
    "relationships": [
        {"from_table": "orders", "from_col": "customer_id",
         "to_table": "customers", "to_col": "id", "inferred": True},
    ],
    "views": [], "dbt_metrics": [],
})


async def _fake_get_connection(connection_id: str, workspace_id: str):
    return {"kind": "demo", "schema": _DEMO_SCHEMA, "dsn": "", "workspace_id": workspace_id}


import app.agent.loop as _loop  # noqa: E402 — must import before patching
from app.agent.loop import run_investigation  # noqa: E402

_loop.get_connection = _fake_get_connection  # type: ignore

QUESTION = "Why did Mumbai revenue drop so sharply in the week of February 24, 2025?"
FIXTURE_PATH = "fixtures/replay_fixture.json"


def _parse_frame(chunk: bytes) -> dict | None:
    """Convert one SSE frame (bytes) into {"event": ..., "data": ...} or None."""
    text = chunk.decode("utf-8").strip()
    if not text or text.startswith(":"):
        return None  # keepalive comment

    event_type = None
    data_str = None
    for line in text.split("\n"):
        if line.startswith("event: "):
            event_type = line[7:]
        elif line.startswith("data: "):
            data_str = line[6:]

    if not event_type or data_str is None:
        return None

    if event_type == "reasoning":
        # data is plain text with \n escaped
        return {"event": "reasoning", "data": data_str.replace("\\n", "\n")}

    try:
        return {"event": event_type, "data": json.loads(data_str)}
    except json.JSONDecodeError:
        return {"event": event_type, "data": data_str}


async def capture() -> None:
    print(f"Question: {QUESTION!r}")
    print("Running against demo.duckdb — Appwrite failures are expected and harmless.\n")

    events: list[dict] = []
    chunk_count = 0

    async for chunk in run_investigation(
        investigation_id="capture-run-001",
        question=QUESTION,
        connection_id="demo",   # Appwrite lookup fails → falls back to DuckDB demo
        workspace_id="capture",
    ):
        chunk_count += 1
        ev = _parse_frame(chunk)
        if ev is None:
            continue
        events.append(ev)

        match ev["event"]:
            case "step_start":
                print(f"\n  [step {ev['data'].get('step')}] reasoning...", end="", flush=True)
            case "reasoning":
                print(".", end="", flush=True)
            case "action":
                t = ev["data"].get("type", "?")
                print(f" action={t}", end="", flush=True)
            case "observation":
                s = ev["data"].get("status", "?")
                err = (ev["data"].get("error") or "")[:60]
                print(f" obs={s}({err})" if err else f" obs={s}", end="", flush=True)
            case "final":
                print(f"\n\n  verdict={ev['data'].get('verdict')}  confidence={ev['data'].get('confidence')}")
            case "error":
                print(f"\n\n  ERROR: {ev['data']}")

    print(f"\nTotal: {len(events)} events captured from {chunk_count} SSE frames.")

    os.makedirs(os.path.dirname(FIXTURE_PATH), exist_ok=True)
    with open(FIXTURE_PATH, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    print(f"Saved -> {FIXTURE_PATH}")


if __name__ == "__main__":
    asyncio.run(capture())
