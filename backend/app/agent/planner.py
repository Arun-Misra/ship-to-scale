"""
P2 — LLM integration. Generates Action JSON and reasoning tokens.
Model is configurable via GEMINI_MODEL env var (default: gemma-3-27b-it).
Owner: BE

CRITICAL — JSON markdown trap:
Primary fix: response_mime_type="application/json" + response_schema
Fallback: extract_json() regex strip before every model_validate_json()
"""
import re
from typing import AsyncIterator

from google import genai
from google.genai.types import GenerateContentConfig

from app.agent.schemas import Action
from app.config import settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client

_ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["sql_query", "conclude"]},
        "sql": {"type": "string"},
        "intent": {"type": "string"},
        "verdict": {"type": "string", "enum": ["confirmed", "refuted", "inconclusive"]},
        "root_cause": {"type": "string"},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "recommended_action": {"type": "string"},
    },
    "required": ["type"],
}


def extract_json(text: str) -> str:
    """Strip markdown fences if Gemini wraps JSON despite response_mime_type setting."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    return m.group(1).strip() if m else text


def build_system_prompt(schema_graph: dict, semantic_defs: list[dict]) -> str:
    return f"""You are Niriya's autonomous analyst agent. You investigate data questions by writing SQL queries and reasoning about results.

Schema:
{schema_graph}

Semantic definitions (use these for metric terms — do not guess):
{semantic_defs}

Rules:
- Target the semantic/metric layer. Use defined metric terms, not raw column math.
- Write DuckDB-dialect SQL only.
- Do NOT write multi-statement SQL (no semicolons separating statements).
- Do NOT write DDL or DML (SELECT only).
- Aggregate before returning — aim for ≤50 result rows.
- When you have enough evidence, emit a conclude action.
"""


async def stream_reasoning(prompt: str) -> AsyncIterator[str]:
    """Stream free-text reasoning tokens. These are display-only — never parsed for control flow."""
    for chunk in _get_client().models.generate_content_stream(
        model=settings.gemini_model,
        contents=prompt,
    ):
        if chunk.text:
            yield chunk.text


def generate_action(prompt: str) -> Action:
    """
    Generate a structured Action. Uses response_mime_type=application/json as primary.
    Falls back to extract_json() strip before model_validate_json().
    """
    response = _get_client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=_ACTION_SCHEMA,
        ),
    )
    return Action.model_validate_json(extract_json(response.text))
