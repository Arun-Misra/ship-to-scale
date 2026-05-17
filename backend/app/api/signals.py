"""
Signals feed — computed live from the demo DuckDB snapshot.
Each signal is a cheap statistical check that flags material deviations.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.appwrite.auth import require_auth
from app.db.session import DuckDBSession

router = APIRouter()

_cached_signals: list[dict] | None = None


def _compute_signals() -> list[dict]:
    session = DuckDBSession(mode="demo")
    signals = []
    try:
        con = session.con

        # 1. Refund rate by region — flag Asia as above-average
        rows = con.execute("""
            SELECT region,
                   COUNT(*) AS total,
                   SUM(CASE WHEN refunded THEN 1 ELSE 0 END) AS refunds,
                   ROUND(100.0 * SUM(CASE WHEN refunded THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
            FROM orders
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
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                    "investigation": {"trigger": "refund_rate_anomaly"},
                })

        # 2. Revenue gap between regions
        rev_rows = con.execute("""
            SELECT region, ROUND(AVG(order_total), 2) AS avg_rev, COUNT(*) AS cnt
            FROM orders
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
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                    "investigation": {"trigger": "revenue_gap"},
                })

        # 3. Date format inconsistency in orders.created_at
        format_rows = con.execute("""
            SELECT
                SUM(CASE WHEN created_at LIKE '____-__-__' THEN 1 ELSE 0 END) AS iso_count,
                SUM(CASE WHEN created_at LIKE '__/__/____' THEN 1 ELSE 0 END) AS us_count,
                COUNT(*) AS total
            FROM orders
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
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "investigation": None,
            })

        # 4. Top customer concentration check
        conc_rows = con.execute("""
            SELECT c.name, COUNT(o.order_id) AS order_count, ROUND(SUM(o.order_total), 2) AS revenue
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            GROUP BY c.name
            ORDER BY revenue DESC
            LIMIT 1
        """).fetchone()

        total_revenue = con.execute("SELECT ROUND(SUM(order_total), 2) FROM orders").fetchone()[0]
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
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                    "investigation": {"trigger": "customer_concentration"},
                })

    except Exception:
        pass
    finally:
        session.close()

    return signals


@router.get("/signals")
async def get_signals(user=Depends(require_auth)):
    global _cached_signals
    if _cached_signals is None:
        _cached_signals = _compute_signals()
    return {"signals": _cached_signals}
