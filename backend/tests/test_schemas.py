"""
P1 gate: Pydantic schemas reject malformed input.
"""
import pytest
from pydantic import ValidationError
from app.agent.schemas import SqlQueryAction, ConcludeAction, Observation


def test_sql_query_action_valid():
    a = SqlQueryAction(type="sql_query", sql="SELECT 1", intent="test")
    assert a.type == "sql_query"


def test_sql_query_action_rejects_extra_fields():
    with pytest.raises(ValidationError):
        SqlQueryAction(type="sql_query", sql="SELECT 1", intent="test", reasoning="oops")


def test_conclude_action_valid():
    a = ConcludeAction(
        type="conclude",
        verdict="confirmed",
        root_cause="Revenue dropped in Mumbai",
        confidence="high",
        recommended_action="Investigate Mumbai pipeline",
    )
    assert a.verdict == "confirmed"


def test_conclude_action_rejects_extra_fields():
    with pytest.raises(ValidationError):
        ConcludeAction(
            type="conclude",
            verdict="confirmed",
            root_cause="test",
            confidence="high",
            recommended_action="test",
            extra_field="not allowed",
        )


def test_observation_valid():
    o = Observation(step=1, status="ok", row_count=5, columns=["a", "b"], preview=[[1, 2]])
    assert o.status == "ok"


def test_observation_rejects_invalid_status():
    with pytest.raises(ValidationError):
        Observation(step=1, status="unknown_status")
