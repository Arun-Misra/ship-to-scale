"""
P1 — Pydantic v2 Action/Observation/ChartConfig schemas.
Owner: BE

CRITICAL: extra='forbid' is MANDATORY on all Action models.
Without it, Pydantic v2 silently drops unknown fields — masking model misbehaviour.
"""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field


class ChartConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chart_type: Literal["line", "bar", "area", "scatter", "pie"]
    x_axis: str        # column name from the result set
    y_axis: str        # column name from the result set
    series_label: str  # human-readable legend label


class SqlQueryAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["sql_query"]
    sql: str
    intent: str  # short description for the receipt — NOT used in control flow


class ConcludeAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["conclude"]
    verdict: Literal["confirmed", "refuted", "inconclusive"]
    root_cause: str
    confidence: Literal["low", "medium", "high"]
    recommended_action: str
    chart: ChartConfig | None = None  # None if no chart is relevant


class ClarifyAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["clarify"]
    question: str  # the clarification question to ask the user


Action = Annotated[
    SqlQueryAction | ConcludeAction | ClarifyAction,
    Field(discriminator="type"),
]


class ClarificationEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str


class ChatResponseEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int
    status: Literal[
        "ok", "explain_error", "exec_error", "validation_error", "timeout", "row_cap"
    ]
    row_count: int | None = None
    columns: list[str] | None = None
    preview: list[list] | None = None   # capped to ≤50 rows on the wire
    truncated: bool = False
    error: str | None = None            # fed back to the model as corrective context


class StepStartEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int
    budget_remaining: int


class StepEndEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int


class FinalEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    investigation_id: str
    verdict: Literal["confirmed", "refuted", "inconclusive"]
    root_cause: str
    confidence: Literal["low", "medium", "high"]
    recommended_action: str
    chart: ChartConfig | None = None
    data: list[list] = []    # ≤50 row preview for Recharts
    definition_receipts: list[dict] = []


class ErrorEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str
    message: str
