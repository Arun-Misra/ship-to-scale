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
    """Reasoning tokens — display-only, never parsed for control flow.
    Uses generate_content (not streaming) to avoid MALFORMED_RESPONSE issues with Gemma models.
    Failures are swallowed silently."""
    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        text = _response_text(response)
        if text:
            yield text
    except Exception:
        yield "> Analyzing..."


_SQL_QUERY_KEYS = {"type", "sql", "intent"}
_CONCLUDE_KEYS = {"type", "verdict", "root_cause", "confidence", "recommended_action", "chart"}


def _normalize_action(raw: dict) -> dict:
    """Normalize common model field-name variations so the Pydantic discriminator finds 'type'."""
    raw = dict(raw)
    # Fix missing/renamed type field
    if "type" not in raw:
        for alt in ("action", "action_type", "kind"):
            if alt in raw:
                raw["type"] = raw.pop(alt)
                break
    # Normalize type values
    type_map = {
        "sql": "sql_query", "query": "sql_query", "SQL": "sql_query",
        "sql-query": "sql_query", "sqlquery": "sql_query",
        "CONCLUDE": "conclude", "finish": "conclude", "done": "conclude", "end": "conclude",
    }
    if raw.get("type") in type_map:
        raw["type"] = type_map[raw["type"]]
    # Fix sql field name variations for sql_query actions
    if raw.get("type") == "sql_query" and "sql" not in raw:
        for alt in ("query", "SQL", "statement", "sql_statement"):
            if alt in raw:
                raw["sql"] = raw.pop(alt)
                break
    return raw


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


def _response_text(response) -> str:
    """Extract text from a Gemini response, handling MALFORMED_RESPONSE finish reason."""
    try:
        text = response.text
        if text:
            return text
    except Exception:
        pass
    # Fallback: pull text directly from candidates
    try:
        for candidate in response.candidates or []:
            for part in (candidate.content.parts or []):
                if hasattr(part, "text") and part.text:
                    return part.text
    except Exception:
        pass
    raise ValueError("Empty or malformed response from model")


def generate_action(prompt: str) -> Action:
    """
    Generate a structured Action.
    Tries each API key in the pool once. For each key, attempts structured output first
    (Gemini models) then falls back to plain generation (Gemma models).
    Raises the last exception only after all keys are exhausted.
    """
    # Ensure pool is initialized; _get_client() handles first-time setup.
    _get_client()
    last_error: Exception = RuntimeError("No Gemini clients available")

    for client in _clients:
        try:
            text = ""
            # Structured output (works on Gemini, returns 500 on Gemma — caught below)
            try:
                response = client.models.generate_content(
                    model=settings.gemini_model,
                    contents=prompt,
                    config=GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=_ACTION_SCHEMA,
                    ),
                )
                text = _response_text(response)
            except Exception:
                pass

            # Plain generation fallback (required for Gemma models)
            if not text:
                response = client.models.generate_content(
                    model=settings.gemini_model,
                    contents=prompt,
                )
                text = _response_text(response)

            raw = json.loads(extract_json(text))
            return _action_adapter.validate_python(_strip_action(_normalize_action(raw)))
        except Exception as e:
            last_error = e
            continue

    raise last_error
