"""P1 gate: SSE functions emit valid, complete SSE frames."""
from app.agent.sse import sse_struct, sse_reasoning, sse_keepalive
from app.agent.schemas import StepStartEvent


def test_sse_struct_emits_complete_json():
    event = StepStartEvent(step=1, budget_remaining=7)
    frame = sse_struct("step_start", event).decode()
    assert frame.startswith("event: step_start\n")
    assert "data: " in frame
    assert frame.endswith("\n\n")
    # Must be parseable
    import json
    data_line = [l for l in frame.split("\n") if l.startswith("data:")][0]
    parsed = json.loads(data_line.removeprefix("data: "))
    assert parsed["step"] == 1


def test_sse_reasoning_never_breaks_on_newlines():
    frame = sse_reasoning("line one\nline two").decode()
    assert "\n\n" == frame[-2:]  # only the trailing separator has double newline
    assert "\\n" in frame  # internal newlines are escaped


def test_sse_keepalive_is_comment():
    frame = sse_keepalive().decode()
    assert frame.startswith(": ")
