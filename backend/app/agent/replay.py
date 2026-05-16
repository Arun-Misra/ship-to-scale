"""
P7 [STUB] — Paced replay of a captured SSE fixture stream.
Owner: BE

The frontend CANNOT tell replay from live — same SSE wire format, same parser.
Timing never depends on Gemini. Default demo path is replay, not live LLM.
"""
import asyncio
import json
import os
from typing import AsyncIterator

from app.agent.sse import sse_struct, sse_reasoning
from app.agent.schemas import (
    StepStartEvent, StepEndEvent, FinalEvent, ErrorEvent, Observation
)

FIXTURE_PATH = "fixtures/replay_fixture.json"
STEP_DELAY_SECONDS = 2.5  # ~2.5s per step → ~25s total for 10 steps


async def replay_fixture(investigation_id: str) -> AsyncIterator[bytes]:
    """
    Emit the captured fixture stream at ~2.5s/step.
    TODO P7: capture a real investigation run and save to fixtures/replay_fixture.json
    """
    if not os.path.exists(FIXTURE_PATH):
        yield sse_struct("error", ErrorEvent(code="no_fixture", message="Replay fixture not yet captured. Run a live investigation first."))
        return

    with open(FIXTURE_PATH) as f:
        events = json.load(f)

    current_step = None
    for event in events:
        event_type = event["event"]
        data = event["data"]

        if event_type == "step_start" and current_step != data.get("step"):
            current_step = data.get("step")
            await asyncio.sleep(STEP_DELAY_SECONDS)

        if event_type == "reasoning":
            yield sse_reasoning(data)
            await asyncio.sleep(0.05)  # simulate token streaming
        else:
            yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n".encode()
