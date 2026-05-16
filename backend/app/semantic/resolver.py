"""
P5 — Semantic resolver: look up definitions, handle JIT capture flow.
Owner: BE
"""
from app.appwrite.store import get_semantic_definition, save_semantic_definition
from app.semantic.materiality import is_material


async def resolve_term(term: str, workspace_id: str) -> dict | None:
    """
    Look up a term in the semantic store.
    Returns the definition dict or None if undefined.
    """
    return await get_semantic_definition(term=term, workspace_id=workspace_id)


async def should_ask_jit(term: str, workspace_id: str) -> bool:
    """
    Returns True if we should ask the user to define this term (JIT capture).
    Conditions: ambiguous AND material AND undefined.
    """
    existing = await resolve_term(term, workspace_id)
    if existing:
        return False
    return is_material(term)


async def capture_definition(
    term: str,
    workspace_id: str,
    natural_language: str,
    definition_sql: str,
    source: str = "jit_capture",
) -> None:
    """Save a new definition to the semantic store. Never ask again after this."""
    await save_semantic_definition(
        workspace_id=workspace_id,
        term=term,
        natural_language=natural_language,
        definition_sql=definition_sql,
        source=source,
        materiality="material" if is_material(term) else "trivia",
    )
