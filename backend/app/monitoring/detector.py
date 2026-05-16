"""
P6 [STUB] — Deterministic anomaly detector.
Owner: BE

Architecture is real + unit-tested. Invoked once offline to produce one pre-computed anomaly.
No live scheduler. The function signature is real so production = "wire to a scheduler."

Order of operations (cost control):
1. Cheap deterministic check (stddev/moving average) on snapshot — never on production DB
2. Absolute materiality floor (not just statistical significance)
3. Debounce
4. ONLY THEN: expensive agent wakes, investigates, caches result
"""
import statistics
from dataclasses import dataclass


@dataclass
class AnomalySignal:
    metric: str
    description: str
    severity: str
    detected_value: float
    expected_range: tuple[float, float]


MATERIALITY_FLOOR = 0.05  # must be >5% deviation to be worth alerting
DEBOUNCE_PERIODS = 2      # must persist for 2 consecutive periods before firing


def detect_anomalies(metric_series: list[float], metric_name: str) -> list[AnomalySignal]:
    """
    Stddev-based anomaly detection on a metric time series.
    Returns signals only if deviation exceeds MATERIALITY_FLOOR.
    """
    if len(metric_series) < 4:
        return []

    mean = statistics.mean(metric_series[:-1])
    stdev = statistics.stdev(metric_series[:-1])
    latest = metric_series[-1]

    if mean == 0:
        return []

    deviation_pct = abs(latest - mean) / mean
    if deviation_pct < MATERIALITY_FLOOR:
        return []

    z_score = abs(latest - mean) / (stdev + 1e-9)
    if z_score < 2.0:
        return []

    return [
        AnomalySignal(
            metric=metric_name,
            description=f"{metric_name} is {deviation_pct:.1%} {'above' if latest > mean else 'below'} the recent average",
            severity="high" if deviation_pct > 0.2 else "medium",
            detected_value=latest,
            expected_range=(mean - 2 * stdev, mean + 2 * stdev),
        )
    ]
