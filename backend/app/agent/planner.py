"""
P2 — LLM integration. Generates Action JSON and reasoning tokens.
Model is configurable via GEMINI_MODEL env var (default: gemma-3-27b-it).
Owner: BE

CRITICAL — JSON markdown trap:
Primary fix: response_mime_type="application/json" + response_schema
Fallback: extract_json() regex strip before every model_validate_json()
"""
import json
import re
from typing import AsyncIterator

from google import genai
from google.genai.types import GenerateContentConfig
from pydantic import TypeAdapter

from app.agent.schemas import Action
from app.config import settings

_action_adapter: TypeAdapter[Action] = TypeAdapter(Action)

# Round-robin across all configured API keys to spread RPM/RPD load.
# Add GEMINI_API_KEY_2, GEMINI_API_KEY_3 … to .env for extra quota.
_clients: list[genai.Client] = []
_client_index = 0


def _get_client() -> genai.Client:
    global _clients, _client_index
    if not _clients:
        extra = [k.strip() for k in settings.gemini_extra_api_keys.split(",") if k.strip()]
        keys = [settings.gemini_api_key] + extra
        _clients = [genai.Client(api_key=k) for k in keys if k]
        if not _clients:
            raise RuntimeError("No GEMINI_API_KEY configured")
    client = _clients[_client_index % len(_clients)]
    _client_index += 1
    return client

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
    """
    Extract the first complete JSON object from model output.
    Handles markdown fences and trailing garbage text after the closing brace.
    """
    text = text.strip()
    # Strip markdown fences first
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    # Find the first { and its matching } to extract a clean JSON object
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start: i + 1]
    return text[start:]


def build_system_prompt(schema_graph: dict, semantic_defs: list[dict]) -> str:
    return f"""You are viriya's autonomous analyst agent. You investigate data questions by writing SQL queries and reasoning about results.

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

DuckDB date notes (critical — the created_at column is VARCHAR with mixed formats):
- Use TRY_STRPTIME(created_at, '%Y-%m-%d') for ISO dates, TRY_STRPTIME(created_at, '%m/%d/%Y') for US format.
- Combine with COALESCE: COALESCE(TRY_STRPTIME(created_at,'%Y-%m-%d'), TRY_STRPTIME(created_at,'%m/%d/%Y'))
- To get year-week: strftime(COALESCE(TRY_STRPTIME(created_at,'%Y-%m-%d'), TRY_STRPTIME(created_at,'%m/%d/%Y')), '%Y-W%W')
- Do NOT use CAST(created_at AS DATE) — it fails on mixed formats.
- Do NOT use the date() scalar function — it does not exist in DuckDB.
- location/city data is in the "region" column on both orders and customers tables.
"""


async def stream_reasoning(prompt: str) -> AsyncIterator[str]:
    """Stream free-text reasoning tokens. These are display-only — never parsed for control flow."""
    for chunk in _get_client().models.generate_content_stream(
        model=settings.gemini_model,
        contents=prompt,
    ):
        if chunk.text:
            yield chunk.text


_SQL_QUERY_KEYS = {"type", "sql", "intent"}
_CONCLUDE_KEYS = {"type", "verdict", "root_cause", "confidence", "recommended_action", "chart"}


def _strip_action(raw: dict) -> dict:
    """
    Gemini populates every field in the flat schema regardless of type discriminator.
    Strip keys that don't belong to the chosen action type so extra='forbid' doesn't reject them.
    """
    action_type = raw.get("type")
    if action_type == "sql_query":
        return {k: v for k, v in raw.items() if k in _SQL_QUERY_KEYS}
    if action_type == "conclude":
        return {k: v for k, v in raw.items() if k in _CONCLUDE_KEYS}
    return raw


def generate_action(prompt: str) -> Action:
    """
    Generate a structured Action. Uses response_mime_type=application/json as primary.
    Falls back to extract_json() strip before validation.
    """
    response = _get_client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=_ACTION_SCHEMA,
        ),
    )
    raw = json.loads(extract_json(response.text))
    return _action_adapter.validate_python(_strip_action(raw))
