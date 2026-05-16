"""
P2 — ReAct agent loop. The core product — NEVER cut.
Owner: BE

Loop: plan → generate Action → Pydantic validate → EXPLAIN → sandbox execute → Observation → reason → repeat
One shared retry budget per step (ValidationError + EXPLAIN failures share the same counter).
Hard step budget → graceful partial answer (never a crash, never a confident wrong answer).
"""
import asyncio
import json
from typing import AsyncIterator

from pydantic import ValidationError

from app.agent.schemas import (
    Action, SqlQueryAction, ConcludeAction,
    Observation, StepStartEvent, StepEndEvent, FinalEvent, ErrorEvent,
)
from app.agent.sse import sse_struct, sse_reasoning, sse_keepalive
from app.agent.executor import explain_sql, execute_sql
from app.agent.planner import build_system_prompt, stream_reasoning, generate_action
from app.db.session import DuckDBSession
from app.appwrite.store import list_semantic_definitions, get_connection
from app.config import settings


async def run_investigation(
    investigation_id: str,
    question: str,
    connection_id: str,
    workspace_id: str,
) -> AsyncIterator[bytes]:
    """
    Full ReAct loop. Yields SSE bytes.
    The agent loop is testable with zero auth — hardcode workspace_id + local Postgres.
    """
    semantic_defs = await list_semantic_definitions(workspace_id)

    conn_doc = await get_connection(connection_id, workspace_id)
    if conn_doc and conn_doc.get("kind") == "postgres":
        session = DuckDBSession(mode="live", dsn=conn_doc["dsn"])
    else:
        session = DuckDBSession(mode="demo")

    try:
        raw_schema = conn_doc.get("schema", "{}") if conn_doc else "{}"
        try:
            schema_graph = json.loads(raw_schema)
        except Exception:
            schema_graph = {}
        system_prompt = build_system_prompt(schema_graph, semantic_defs)
        observations: list[Observation] = []
        step_budget = settings.agent_step_budget
        last_sql_result: tuple[list[str], list[list]] | None = None  # (columns, preview)

        loop = asyncio.get_event_loop()
        last_ka_at = loop.time()

        def _keepalive() -> bytes | None:
            nonlocal last_ka_at
            now = loop.time()
            if now - last_ka_at >= 15:
                last_ka_at = now
                return sse_keepalive()
            return None

        for step in range(1, step_budget + 1):
            retry_budget = settings.agent_retry_budget_per_step

            yield sse_struct("step_start", StepStartEvent(step=step, budget_remaining=step_budget - step))

            # Free-text reasoning — display only, never parsed
            reasoning_prompt = _build_reasoning_prompt(system_prompt, question, observations)
            async for token in stream_reasoning(reasoning_prompt):
                yield sse_reasoning(token)
                if (ka := _keepalive()):
                    yield ka

            # Structured action — Pydantic validated
            action_prompt = _build_action_prompt(system_prompt, question, observations)
            action: Action | None = None
            observation: Observation | None = None

            while retry_budget > 0:
                try:
                    action = generate_action(action_prompt)
                    break
                except (ValidationError, Exception) as e:
                    retry_budget -= 1
                    observation = Observation(
                        step=step, status="validation_error", error=str(e)
                    )
                    yield sse_struct("observation", observation)
                    observations.append(observation)
                    if retry_budget == 0:
                        break
                    action_prompt = _build_action_prompt(system_prompt, question, observations)

            if action is None:
                # Retry budget exhausted — force conclude with what we have
                action = ConcludeAction(
                    type="conclude",
                    verdict="inconclusive",
                    root_cause="Could not generate a valid action within the retry budget.",
                    confidence="low",
                    recommended_action="Review the question and try again.",
                )

            if isinstance(action, ConcludeAction):
                yield sse_struct("action", action)
                yield sse_struct("step_end", StepEndEvent(step=step))
                data = last_sql_result[1] if last_sql_result else []
                yield sse_struct(
                    "final",
                    FinalEvent(
                        investigation_id=investigation_id,
                        verdict=action.verdict,
                        root_cause=action.root_cause,
                        confidence=action.confidence,
                        recommended_action=action.recommended_action,
                        chart=action.chart,
                        data=data,
                        definition_receipts=_build_receipts(semantic_defs),
                    ),
                )
                return

            # sql_query action — EXPLAIN pre-flight
            assert isinstance(action, SqlQueryAction)
            yield sse_struct("action", action)

            explain_error = explain_sql(session.con, action.sql)
            if explain_error:
                retry_budget -= 1
                observation = Observation(step=step, status="explain_error", error=explain_error)
                yield sse_struct("observation", observation)
                observations.append(observation)
                yield sse_struct("step_end", StepEndEvent(step=step))
                continue

            # Execute in read-only sandbox
            observation = await asyncio.to_thread(execute_sql, session.con, step, action)
            yield sse_struct("observation", observation)
            if (ka := _keepalive()):
                yield ka
            observations.append(observation)

            if observation.status == "ok" and observation.columns and observation.preview:
                last_sql_result = (observation.columns, observation.preview)

            yield sse_struct("step_end", StepEndEvent(step=step))

        # Step budget exhausted — graceful partial
        yield sse_struct(
            "final",
            FinalEvent(
                investigation_id=investigation_id,
                verdict="inconclusive",
                root_cause="Step budget exhausted. Partial findings in the observations above.",
                confidence="low",
                recommended_action="Try a more specific question or increase the step budget.",
                data=last_sql_result[1] if last_sql_result else [],
                definition_receipts=_build_receipts(semantic_defs),
            ),
        )

    except Exception as e:
        yield sse_struct("error", ErrorEvent(code="agent_error", message=str(e)))
    finally:
        session.close()


def _build_reasoning_prompt(system: str, question: str, observations: list) -> str:
    obs_text = "\n".join(f"Step {o.step}: {o.status} — {o.error or o.preview}" for o in observations)
    return f"{system}\n\nQuestion: {question}\n\nObservations so far:\n{obs_text}\n\nThink step by step about what to investigate next:"


def _build_action_prompt(system: str, question: str, observations: list) -> str:
    obs_text = "\n".join(f"Step {o.step}: {o.status} — {o.error or o.preview}" for o in observations)
    return (
        f"{system}\n\nQuestion: {question}\n\nObservations so far:\n{obs_text}\n\n"
        "Emit your next action as a JSON object matching the Action schema. "
        "Do NOT wrap in markdown. Do NOT include any reasoning text."
    )


def _build_receipts(semantic_defs: list[dict]) -> list[dict]:
    return [
        {"term": d["term"], "definition": d["natural_language"], "source": d["source"]}
        for d in semantic_defs
        if d.get("materiality") == "material"
    ]
