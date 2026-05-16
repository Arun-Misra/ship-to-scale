"""
P5 — Materiality gate: only material terms can trigger a JIT interruption.
Trivia is answered silently with a best-effort definition + receipt.
"""

MATERIAL_TERMS = {"revenue", "churn", "profit", "mrr", "arr", "ltv", "cac", "conversion"}


def is_material(term: str) -> bool:
    """Returns True if the term should trigger a JIT clarification question."""
    return term.lower() in MATERIAL_TERMS
