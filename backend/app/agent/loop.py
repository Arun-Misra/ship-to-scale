"""
P2 — ReAct agent loop. The core product — NEVER cut.
Owner: BE

Loop: plan → generate Action → Pydantic validate → EXPLAIN → sandbox execute → Observation → reason → repeat
One shared retry budget per step (ValidationError + EXPLAIN failures share the same counter).
Hard step budget → graceful partial answer (never a crash, never a confident wrong answer).
"""
import asyncio
import dataclasses
import json
from typing import AsyncIterator

from pydantic import ValidationError

from app.agent.schemas import (
    Action, SqlQueryAction, ConcludeAction, ClarifyAction,
    Observation, StepStartEvent, StepEndEvent, FinalEvent, ErrorEvent,
    ClarificationEvent, ChatResponseEvent,
)
from app.agent.sse import sse_struct, sse_reasoning, sse_keepalive
from app.agent.executor import explain_sql, execute_sql
from app.agent.planner import build_system_prompt, generate_action, generate_chat_response
from app.db.session import DuckDBSession
from app.appwrite.store import list_semantic_definitions, get_connection, update_investigation_result
from app.db.schema_crawler import crawl_schema
from app.config import settings
from app.state import investigations as _investigations


async def _persist_result(
    investigation_id: str,
    verdict: str,
    root_cause: str,
    confidence: str,
    recommended_action: str,
) -> None:
    """Save final result to both in-memory state and Appwrite."""
    if investigation_id in _investigations:
        _investigations[investigation_id].update({
            "status": "completed",
            "verdict": verdict,
            "root_cause": root_cause,
            "confidence": confidence,
            "recommended_action": recommended_action,
        })
    await update_investigation_result(
        investigation_id=investigation_id,
        verdict=verdict,
        root_cause=root_cause,
        confidence=confidence,
        recommended_action=recommended_action,
    )


async def run_investigation(
    investigation_id: str,
    question: str,
    connection_id: str,
    workspace_id: str,
    conversation_history: list[dict] | None = None,
) -> AsyncIterator[bytes]:
    """
    Full ReAct loop. Yields SSE bytes.
    The agent loop is testable with zero auth — hardcode workspace_id + local Postgres.
    """
    if conversation_history is None:
        conversation_history = []

    semantic_defs = await list_semantic_definitions(workspace_id)

    conn_doc = await get_connection(connection_id, workspace_id)

    session: DuckDBSession | None = None
    try:
        if conn_doc and conn_doc.get("kind") == "postgres":
            session = DuckDBSession(mode="live", dsn=conn_doc["dsn"])
        else:
            session = DuckDBSession(mode="demo")

        if conn_doc:
            raw_schema = conn_doc.get("schema", "{}")
            try:
                schema_graph = json.loads(raw_schema)
            except Exception:
                schema_graph = {}
        else:
            # Demo connection — crawl schema live from demo.duckdb
            try:
                schema_graph = dataclasses.asdict(
                    await asyncio.to_thread(crawl_schema, session.con, "main")
                )
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

            # Single LLM call: returns reasoning text + structured action together
            action_prompt = _build_action_prompt(system_prompt, question, observations, conversation_history)
            action: Action | None = None
            observation: Observation | None = None
            reasoning_text = ""

            while retry_budget > 0:
                try:
                    reasoning_text, action = generate_action(action_prompt)
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
                    action_prompt = _build_action_prompt(system_prompt, question, observations, conversation_history)

            # Emit reasoning before the action so the UI shows thinking first
            if reasoning_text:
                yield sse_reasoning(reasoning_text)
                if (ka := _keepalive()):
                    yield ka

            if action is None:
                # Retry budget exhausted — force conclude with what we have
                action = ConcludeAction(
                    type="conclude",
                    verdict="inconclusive",
                    root_cause="Could not generate a valid action within the retry budget.",
                    confidence="low",
                    recommended_action="Review the question and try again.",
                )

            if isinstance(action, ClarifyAction):
                yield sse_struct("action", action)
                yield sse_struct("clarification", ClarificationEvent(question=action.question))
                yield sse_struct("step_end", StepEndEvent(step=step))
                if investigation_id in _investigations:
                    _investigations[investigation_id]["status"] = "needs_clarification"
                return

            if isinstance(action, ConcludeAction):
                yield sse_struct("action", action)
                yield sse_struct("step_end", StepEndEvent(step=step))
                data = last_sql_result[1] if last_sql_result else []
                final_event = FinalEvent(
                    investigation_id=investigation_id,
                    verdict=action.verdict,
                    root_cause=action.root_cause,
                    confidence=action.confidence,
                    recommended_action=action.recommended_action,
                    chart=action.chart,
                    data=data,
                    definition_receipts=_build_receipts(semantic_defs),
                )
                yield sse_struct("final", final_event)
                # Generate human-readable chat response
                try:
                    chat_text = await asyncio.to_thread(
                        generate_chat_response, question, {
                            "verdict": action.verdict, "root_cause": action.root_cause,
                            "confidence": action.confidence, "recommended_action": action.recommended_action,
                        }, conversation_history
                    )
                    yield sse_struct("chat_response", ChatResponseEvent(text=chat_text))
                except Exception:
                    yield sse_struct("chat_response", ChatResponseEvent(text=action.root_cause))
                asyncio.create_task(_persist_result(
                    investigation_id, action.verdict, action.root_cause,
                    action.confidence, action.recommended_action,
                ))
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
        budget_root_cause = "Step budget exhausted. Partial findings in the observations above."
        budget_recommended = "Try a more specific question or increase the step budget."
        yield sse_struct(
            "final",
            FinalEvent(
                investigation_id=investigation_id,
                verdict="inconclusive",
                root_cause=budget_root_cause,
                confidence="low",
                recommended_action=budget_recommended,
                data=last_sql_result[1] if last_sql_result else [],
                definition_receipts=_build_receipts(semantic_defs),
            ),
        )
        try:
            chat_text = await asyncio.to_thread(
                generate_chat_response, question, {
                    "verdict": "inconclusive", "root_cause": budget_root_cause,
                    "confidence": "low", "recommended_action": budget_recommended,
                }, conversation_history
            )
            yield sse_struct("chat_response", ChatResponseEvent(text=chat_text))
        except Exception:
            yield sse_struct("chat_response", ChatResponseEvent(text=budget_root_cause))
        asyncio.create_task(_persist_result(
            investigation_id, "inconclusive",
            "Step budget exhausted.", "low", "Try a more specific question.",
        ))

    except Exception as e:
        yield sse_struct("error", ErrorEvent(code="agent_error", message=str(e)))
    finally:
        if session is not None:
            session.close()


def _format_history(conversation_history: list[dict]) -> str:
    """Format the last 6 messages of conversation history for prompt injection."""
    if not conversation_history:
        return ""
    lines = []
    for m in conversation_history[-6:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        lines.append(f"{role}: {m.get('content', '')}")
    return "Conversation history:\n" + "\n".join(lines) + "\n\n"


def _build_action_prompt(system: str, question: str, observations: list, conversation_history: list[dict] | None = None) -> str:
    obs_text = "\n".join(f"Step {o.step}: {o.status} — {o.error or o.preview}" for o in observations)
    history_text = _format_history(conversation_history or [])
    return (
        f"{system}\n\n{history_text}Question: {question}\n\nObservations so far:\n{obs_text}\n\n"
        "Output exactly ONE raw JSON object. No markdown fences. No explanation text before or after.\n"
        "Include an optional 'reasoning' field with 1-2 sentences of thinking. Use EXACTLY one of these formats:\n"
        '  {"reasoning": "<brief thinking>", "type": "sql_query", "sql": "<DuckDB SELECT>", "intent": "<one-line>"}\n'
        '  {"reasoning": "<brief thinking>", "type": "conclude", "verdict": "confirmed|refuted|inconclusive", '
        '"root_cause": "<explanation>", "confidence": "low|medium|high", "recommended_action": "<action>"}\n'
        '  {"reasoning": "<brief thinking>", "type": "clarify", "question": "<clarification question>"}\n'
        'The "type" field is required. Use "sql_query" to run another query, "conclude" when you have enough evidence, '
        '"clarify" only when the question is too ambiguous to investigate.'
    )


def _build_receipts(semantic_defs: list[dict]) -> list[dict]:
    return [
        {"term": d["term"], "definition": d["natural_language"], "source": d["source"]}
        for d in semantic_defs
        if d.get("materiality") == "material"
    ]
