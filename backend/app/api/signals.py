"""
Signals feed — statistical checks against any registered connection.
Each signal is a cheap check that flags material deviations.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

import anyio

from app.appwrite.auth import require_auth
from app.appwrite.store import get_connection
from app.db.session import DuckDBSession

router = APIRouter()

# Cache per connection_id → list[dict]
_signal_cache: dict[str, list[dict]] = {}


def _compute_signals(con, schema_name: str) -> list[dict]:
    signals = []
    ts = datetime.now(timezone.utc).isoformat()

    # 1. Refund rate by region
    try:
        rows = con.execute(f"""
            SELECT region,
                   COUNT(*) AS total,
                   SUM(CASE WHEN refunded THEN 1 ELSE 0 END) AS refunds,
                   ROUND(100.0 * SUM(CASE WHEN refunded THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
            FROM "{schema_name}"."orders"
            GROUP BY region
            ORDER BY pct DESC
        """).fetchall()

        if rows:
            top_region, top_total, top_refunds, top_pct = rows[0]
            avg_pct = sum(r[3] for r in rows) / len(rows)
            if top_pct > avg_pct * 1.4:
                signals.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"refund-{top_region}")),
                    "title": f"Elevated refund rate in {top_region}",
                    "details": (
                        f"{top_region} shows a {top_pct}% refund rate ({top_refunds}/{top_total} orders), "
                        f"which is {round(top_pct / avg_pct, 1)}x the cross-region average of {round(avg_pct, 1)}%. "
                        "This may indicate product quality issues, fulfilment delays, or regional fraud patterns."
                    ),
                    "priority": "critical",
                    "detected_at": ts,
                    "investigation": {"trigger": "refund_rate_anomaly"},
                })
    except Exception:
        pass

    # 2. Revenue gap between regions
    try:
        rev_rows = con.execute(f"""
            SELECT region, ROUND(AVG(order_total), 2) AS avg_rev, COUNT(*) AS cnt
            FROM "{schema_name}"."orders"
            GROUP BY region
            ORDER BY avg_rev DESC
        """).fetchall()

        if len(rev_rows) >= 2:
            high_region, high_avg, _ = rev_rows[0]
            low_region, low_avg, _ = rev_rows[-1]
            gap_pct = round((high_avg - low_avg) / low_avg * 100, 1)
            if gap_pct > 15:
                signals.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"rev-gap-{high_region}-{low_region}")),
                    "title": f"Revenue-per-order gap: {high_region} vs {low_region}",
                    "details": (
                        f"{high_region} averages ${high_avg} per order while {low_region} averages ${low_avg} "
                        f"— a {gap_pct}% difference. This may reflect plan-mix differences, regional discounting, "
                        "or pricing strategy misalignment."
                    ),
                    "priority": "warning",
                    "detected_at": ts,
                    "investigation": {"trigger": "revenue_gap"},
                })
    except Exception:
        pass

    # 3. Date format inconsistency in orders.created_at
    try:
        format_rows = con.execute(f"""
            SELECT
                SUM(CASE WHEN created_at LIKE '____-__-__' THEN 1 ELSE 0 END) AS iso_count,
                SUM(CASE WHEN created_at LIKE '__/__/____' THEN 1 ELSE 0 END) AS us_count,
                COUNT(*) AS total
            FROM "{schema_name}"."orders"
        """).fetchone()

        if format_rows and format_rows[0] > 0 and format_rows[1] > 0:
            signals.append({
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "date-format-mix")),
                "title": "Mixed date formats in orders.created_at",
                "details": (
                    f"The orders table contains {format_rows[0]} ISO-format dates (YYYY-MM-DD) and "
                    f"{format_rows[1]} US-format dates (MM/DD/YYYY) out of {format_rows[2]} total rows. "
                    "This inconsistency breaks time-series queries and weekly/monthly aggregations."
                ),
                "priority": "warning",
                "detected_at": ts,
                "investigation": None,
            })
    except Exception:
        pass

    # 4. Top customer concentration
    try:
        conc_rows = con.execute(f"""
            SELECT c.name, COUNT(o.order_id) AS order_count, ROUND(SUM(o.order_total), 2) AS revenue
            FROM "{schema_name}"."orders" o
            JOIN "{schema_name}"."customers" c ON o.customer_id = c.customer_id
            GROUP BY c.name
            ORDER BY revenue DESC
            LIMIT 1
        """).fetchone()

        total_revenue = con.execute(
            f'SELECT ROUND(SUM(order_total), 2) FROM "{schema_name}"."orders"'
        ).fetchone()[0]

        if conc_rows and total_revenue and total_revenue > 0:
            share = round(conc_rows[2] / total_revenue * 100, 1)
            if share > 5:
                signals.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"concentration-{conc_rows[0]}")),
                    "title": f"Customer concentration: {conc_rows[0]} is {share}% of revenue",
                    "details": (
                        f"{conc_rows[0]} accounts for ${conc_rows[2]} ({share}% of total revenue) "
                        f"across {conc_rows[1]} orders. High customer concentration creates churn risk."
                    ),
                    "priority": "informational",
                    "detected_at": ts,
                    "investigation": {"trigger": "customer_concentration"},
                })
    except Exception:
        pass

    return signals


@router.get("/signals")
async def get_signals(connection_id: Optional[str] = None, user=Depends(require_auth)):
    # Resolve which connection to use
    if not connection_id:
        # No connection specified — use demo as default
        session = DuckDBSession(mode="demo")
        schema_name = "main"
        cache_key = "__demo__"
    elif connection_id == "demo":
        session = DuckDBSession(mode="demo")
        schema_name = "main"
        cache_key = "demo"
    else:
        conn = await get_connection(connection_id, workspace_id=user["workspace_id"])
        if not conn:
            raise HTTPException(404, "Connection not found")
        kind = conn.get("kind", "demo")
        schema_name = "main" if kind == "demo" else "src"
        session = (
            DuckDBSession(mode="live", dsn=conn["dsn"])
            if kind == "postgres"
            else DuckDBSession(mode="demo")
        )
        cache_key = connection_id

    if cache_key in _signal_cache:
        session.close()
        return {"signals": _signal_cache[cache_key], "connection_id": connection_id}

    try:
        signals = await anyio.to_thread.run_sync(
            lambda: _compute_signals(session.con, schema_name)
        )
    finally:
        session.close()

    _signal_cache[cache_key] = signals
    return {"signals": signals, "connection_id": connection_id}
