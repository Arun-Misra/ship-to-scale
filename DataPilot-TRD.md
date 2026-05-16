# DataPilot — Technical Requirements Document

**Version:** 1.1 (Hackathon build — 20h)
**Companion to:** `DataPilot-PRD.md` v1.0
**Status:** Implementation-ready
**Scope rule:** This TRD specifies *what gets built in the hackathon* in full technical detail, and *what is architecturally defended in Q&A but not built*. Every "build" item here is on the critical path of PRD §10. Every "defend" item is whiteboard-ready, not coded.

---

## 0. How to read this document

| Tag | Meaning |
|---|---|
| **[BUILD]** | Coded and demoed in the 20h. On the critical path. |
| **[STUB]** | A real interface with a faked/seeded/pre-computed implementation. The *architecture* is real; the *scale/timing* is faked (PRD §10 demo principle). |
| **[DEFEND]** | Not coded. Must be answerable on a whiteboard in Q&A. |

The single inviolable rule from the PRD: **fake the scale and timing, never the architecture.** Every stub in this document exposes the same interface its real counterpart would, so the seam is invisible and the production path is a swap, not a rewrite.

---

## 1. System Architecture

### 1.1 Component map

```
                         ┌─────────────────────────────────────────┐
                         │  Browser (React/Vite SPA, Vercel)        │
                         │  - Appwrite SDK (auth)                    │
                         │  - SSE client (agent stream)              │
                         │  - Recharts / shadcn                      │
                         └───────────────┬─────────────────────────┘
                                         │ HTTPS + SSE
                                         │ JWT (Appwrite session)
                         ┌───────────────▼─────────────────────────┐
                         │  FastAPI (single-process uvicorn,        │
                         │  Render/Railway)                          │
                         │                                           │
                         │  ┌─────────────┐   ┌──────────────────┐  │
                         │  │ Auth guard  │   │ Connection mgr   │  │
                         │  │ (Appwrite   │   │ (read-only DSN,  │  │
                         │  │  JWT verify)│   │  schema crawl)   │  │
                         │  └─────────────┘   └────────┬─────────┘  │
                         │  ┌────────────────────────┐ │            │
                         │  │ Investigator Agent loop │ │            │
                         │  │ plan→SQL→EXPLAIN→run→   │ │            │
                         │  │ observe→reason→repeat   │ │            │
                         │  └───────┬─────────┬───────┘ │            │
                         │          │         │         │            │
                         │  ┌───────▼──┐ ┌────▼──────┐  │            │
                         │  │ Semantic │ │ DuckDB    │◄─┘            │
                         │  │ engine   │ │ session   │               │
                         │  │ resolver │ │ (:memory: │               │
                         │  └────┬─────┘ │  per inv.)│               │
                         │       │       └─────┬─────┘               │
                         │  ┌────▼───────┐     │                     │
                         │  │ Monitoring │     │ ATTACH read-only    │
                         │  │ detector   │     │                     │
                         │  │ (stub/seed)│     ▼                     │
                         │  └────┬───────┘  ┌──────────────────┐     │
                         └───────┼──────────┤ baked demo.duckdb│     │
                                 │          │ (read-only file) │     │
                                 │          └──────────────────┘     │
            ┌────────────────────┼─────────────────────────────────┐
            │                    │                                  │
   ┌────────▼────────┐  ┌────────▼─────────┐  ┌───────────────────┐ │
   │ Appwrite Cloud  │  │ Slack Bot        │  │ Gemini 2.0 Flash  │ │
   │ - auth/sessions │  │ (two-way:        │  │ - agent reasoning │ │
   │ - workspaces    │  │  Events API in + │  │ - SQL generation  │ │
   │ - connections   │  │  Web API out)    │  └───────────────────┘ │
   │ - query history │  └──────────────────┘                         │
   │ - semantic store│  ┌──────────────────┐                         │
   │ - reports       │  │ Live Postgres    │ (customer-owned,        │
   └─────────────────┘  │ read-only role   │  read-only DSN)         │
                        └──────────────────┘                         │
```

### 1.2 Process & concurrency model **[BUILD — non-negotiable]**

This is the single highest-risk technical decision in the build (PRD §8.1, §12 "`database is locked`"). It is specified exhaustively.

- **One** `uvicorn` process. **No** `--workers > 1`. No Gunicorn pre-fork. Concurrency comes from the asyncio event loop + a bounded threadpool, not OS processes.
- DuckDB releases the GIL on query execution, so blocking DuckDB calls run in `anyio.to_thread` / `run_in_executor` without stalling the event loop.
- **Two completely separate DuckDB code paths:**

  | Path | Connection | Lifetime | Concurrency safety |
  |---|---|---|---|
  | **Demo path** [BUILD] | `duckdb.connect('demo.duckdb', read_only=True)` | A new read-only handle per investigation; the file is baked into the image | Many read-only openers of the same file is **safe by DuckDB design**. "20 judges at once" cannot produce `database is locked`. |
  | **Live path** [BUILD] | `duckdb.connect(':memory:')` then `ATTACH '<postgres dsn>' (TYPE postgres, READ_ONLY)` | **One connection per investigation session**, created at session start, source attached once, the *entire* agent loop runs on it, destroyed at session end. **Never per-request.** | In-memory connections are not shared between sessions; no file lock exists. |

- **Forbidden, will kill the demo:** a single persistent `.duckdb` *file* opened writable under multiple workers. This combination is banned in code review. The demo file is opened `read_only=True` only; the live path is `:memory:` only.
- A `SessionManager` owns the lifecycle. A session is keyed by `investigation_id`, holds exactly one DuckDB connection, and is closed in a `finally` so a crashed agent loop cannot leak a connection.

```python
# Conceptual — the only two ways a DuckDB connection is ever created.
class DuckDBSession:
    def __init__(self, mode: Literal["demo", "live"], dsn: str | None):
        if mode == "demo":
            self.con = duckdb.connect(BAKED_DEMO_PATH, read_only=True)
        else:  # live
            self.con = duckdb.connect(":memory:")
            self.con.execute("INSTALL postgres; LOAD postgres;")
            self.con.execute(
                f"ATTACH '{dsn}' AS src (TYPE postgres, READ_ONLY)"
            )
        self._configure_sandbox(self.con)  # §6.2

    def close(self) -> None:
        self.con.close()
```

---

## 2. The FE↔BE API Contract — **hour-zero artifact [BUILD]**

Per PRD §8.1 build order: this contract is produced **before any other code**. FE streaming UI and BE agent loop deadlock without it. It is frozen at hour 0; changes require both owners to sign off.

### 2.1 Conventions

- Base URL: `/api/v1`.
- Auth: `Authorization: Bearer <appwrite_jwt>` on every endpoint except `/health`. JWT verified server-side against Appwrite (§7.2).
- All request/response bodies are JSON. All schemas are Pydantic v2 models; the OpenAPI doc generated by FastAPI **is** the canonical contract.
- Errors: RFC-7807-style `{ "type", "title", "status", "detail", "instance" }`. Never leak DSNs, SQL internals, or stack traces to the client.
- IDs are Appwrite document IDs (`$id`) or server-generated UUIDv4.

### 2.2 REST surface

| Method | Path | Purpose | Build |
|---|---|---|---|
| `GET` | `/health` | Liveness; no auth. Returns `{status, demo_db_present: bool}`. | [BUILD] |
| `POST` | `/connections` | Register a read-only data source. Body: `{kind: "postgres"\|"demo", dsn?, label}`. Validates connectivity + read-only role, crawls schema, returns `connection_id`. | [BUILD] |
| `GET` | `/connections/{id}/schema` | Crawled schema graph: tables, columns, types, FK relationships, detected views, dbt manifest summary. | [BUILD] |
| `GET` | `/connections/{id}/quality` | Read-only data quality scan: `issues[]` — each issue has a type (bad_date, bad_type, empty_field, likely_duplicate), affected table/column, row count, and examples. **Shows problems only, changes nothing.** | [BUILD] |
| `POST` | `/investigations` | Start an investigation. Body: `{connection_id, question}`. Returns `{investigation_id}`. Does **not** block on the loop. | [BUILD] |
| `GET` | `/investigations/{id}/stream` | **SSE** — the streamed agent loop (§2.3). The product. | [BUILD] |
| `GET` | `/investigations/{id}` | Final persisted result (replay-safe, for history). | [BUILD] |
| `GET` | `/signals` | Signals feed: pre-computed anomalies + cached investigations. | [STUB] |
| `POST` | `/reports/weekly/dispatch` | Trigger the outbound Slack report (manual trigger replaces the scheduler in demo). | [STUB] |
| `GET` | `/semantic` | The workspace's captured definitions (the moat, made visible). Read-only. | [BUILD] |
| `GET` | `/dashboard` | Summary for the dashboard: connected sources count, last-query timestamp, key metric snapshots, recent investigations. | [BUILD] |
| `POST` | `/slack/events` | Slack Events API webhook receiver — verifies Slack signature, parses `app_mention` / `message` events, enqueues for the agent. | [BUILD] |

### 2.3 The streaming wire format — **prevents the UI-crash trap by design [BUILD]**

This is the transport-layer application of the rigid-action / free-reasoning split (PRD §8.1 "Wire format"). It is specified so the frontend **never has to defend against a half-formed JSON object**, because the backend structurally cannot emit one.

`GET /investigations/{id}/stream` is `text/event-stream`. Events are typed by the SSE `event:` field. **Two and only two categories:**

1. **`reasoning`** — free-text, append-only, raw model tokens. The `data:` payload is **opaque UTF-8 text, not JSON.** The frontend appends it to a buffer and renders it. It is *never parsed*. It cannot break the UI because there is nothing to parse. This is the "spectator" stream.

2. **Structured events** — `step_start`, `action`, `observation`, `step_end`, `final`, `error`. Each `data:` payload is **exactly one fully-valid, complete JSON object emitted only after the corresponding step is fully computed.** The backend never `yield`s a partial structured object. JSON is serialized in full in memory, then written as one SSE event.

```
event: step_start
data: {"step": 1, "budget_remaining": 8}

event: reasoning
data: I should first confirm the revenue drop is real before attributing it.

event: reasoning
data:  Let me aggregate revenue by week for the last quarter.

event: action
data: {"step":1,"type":"sql_query","sql":"SELECT date_trunc('week', o.created_at) AS wk, SUM(...) ...","rationale_ref":"step-1"}

event: observation
data: {"step":1,"status":"ok","row_count":13,"columns":["wk","revenue"],"preview":[["2026-01-06",184320.0], ...],"truncated":false}

event: step_end
data: {"step":1}

event: final
data: {"investigation_id":"...","verdict":"confirmed","root_cause":"...","confidence":"medium","recommended_action":"...","charts":[...],"definition_receipts":[...]}
```

**Frontend contract (enforced):**
- On `reasoning`: append `data` verbatim to the live thought panel. No `JSON.parse`. Ever.
- On any structured event: `JSON.parse(data)` is guaranteed to succeed because the backend guarantees completeness. The parser is *not* wrapped in defensive partial-JSON logic — that logic is intentionally absent to prove the invariant holds.
- On `error`: render the graceful partial answer (§5.5). Never a stack trace.
- Heartbeat: `: keepalive\n\n` comment every 15s so proxies (Render/Vercel) don't drop the connection.

**Backend invariant (enforced by a single chokepoint):** all structured events go through one function:

```python
def sse_struct(event: str, model: BaseModel) -> bytes:
    # model.model_dump_json() either fully succeeds or raises here,
    # server-side, before a single byte is written to the wire.
    payload = model.model_dump_json()
    return f"event: {event}\ndata: {payload}\n\n".encode()

def sse_reasoning(token_text: str) -> bytes:
    # Opaque text. Newlines in model output are escaped to keep one
    # SSE record per event; the FE un-escapes on append.
    safe = token_text.replace("\n", "\\n")
    return f"event: reasoning\ndata: {safe}\n\n".encode()
```

There is no other path to the wire. This is reviewed as a hard invariant.

---

## 3. Layer 1 — Connect **[BUILD]**

### 3.1 Connection registration

- Supported kinds in the build: `postgres` (live, proves "no upload") and `demo` (baked file). Snowflake/BigQuery/Redshift are **[DEFEND]** — same `Connection` interface, different attach string + a SQLGlot transpile step.
- DSN is accepted, immediately validated, and **never persisted in plaintext**. Stored in Appwrite as a reference; the secret lives in a backend env/secret store keyed by `connection_id` for the hackathon (real KMS is [DEFEND]).
- **Read-only enforcement at the connection layer (PRD §4 L1 requirement):**
  - The provided Postgres role must be read-only. We do not trust the caller's claim — we *verify* by attempting a probe write to a scratch schema inside a transaction that is always rolled back; if the write *succeeds*, the connection is **rejected** with a clear error ("supplied role can write — DataPilot requires a read-only role"). DuckDB's `READ_ONLY` attach is a second belt; the rejected-on-writable-role check is the suspenders.
  - All subsequent access is via DuckDB `ATTACH ... READ_ONLY`. Source mutation is structurally impossible from our code path.

### 3.2 Schema crawl (on connect)

Produces a `SchemaGraph` persisted to Appwrite and returned to the FE:

- Tables, columns, types, nullability, row-count estimates.
- Foreign-key relationships (real FKs + heuristically inferred join keys by name/type for FK-less schemas — flagged as `inferred`).
- Existing views (these are first-class harvest input for Layer 4).
- **dbt manifest**: if `manifest.json` is discoverable (uploaded with the connection or in a configured path), parse `nodes` + `metrics` to inherit existing metric definitions on day one. Absent → skipped, not an error.

The schema graph is the grounding context handed to the agent and to `EXPLAIN` validation. It is crawled **once per connection**, cached, re-crawled on explicit refresh.

---

## 4. Layer 2 — Data Quality Scan **[BUILD — read-only, shows problems, changes nothing]**

### 4.1 Immutability model

DataPilot **never writes to the source, never applies fixes, never deletes or merges rows.** The data quality layer is a pure read: scan, analyse, report. The customer's database looks identical before and after connecting. This is a product decision (trust must be earned before touching data) and a technical invariant (all access is read-only by construction — §3.1, §6.2).

### 4.2 What the scan does

Runs once on connect, re-runnable on demand. Executes a set of read-only diagnostic SQL queries against the attached schema via DuckDB:

| Check | What it finds | Output |
|---|---|---|
| **Date format inconsistency** | Columns with mixed date formats (e.g. `01/02/23` and `2023-01-02` in the same column) | Table, column, example values, row count affected |
| **Text-as-number** | Numeric columns stored as text (e.g. `"1,200"`, `"$99.00"`) | Table, column, example values |
| **Unexpected nulls** | Columns with high null % in fields expected to be populated | Table, column, null % |
| **Likely duplicates** | Row pairs with high fuzzy similarity on key identifier columns (name, email, ID) | Pair examples, similarity score, count |
| **Cardinality anomalies** | Columns that look like enums but have unexpected variants (e.g. `"Male"`, `"male"`, `"M"`) | Table, column, value distribution |

### 4.3 API response shape

`GET /connections/{id}/quality` returns:

```json
{
  "connection_id": "...",
  "scanned_at": "2026-05-17T10:00:00Z",
  "issues": [
    {
      "id": "uuid",
      "type": "date_format_inconsistency",
      "severity": "high",
      "table": "orders",
      "column": "created_at",
      "affected_rows": 1420,
      "examples": ["01/02/23", "2023-01-02"],
      "message": "Mixed date formats in orders.created_at — 1,420 rows affected"
    }
  ],
  "summary": { "high": 2, "medium": 3, "low": 1 }
}
```

Nothing in this response causes any write. The frontend renders it as a read-only report. There are no action buttons that call back to the server to fix anything.

---

## 5. Layer 3 — Investigate — the Autonomous Analyst Agent **[BUILD — never cut]**

PRD §10: "Never cut: the streamed agent loop. It is the company." This section is the core of the build.

### 5.1 The loop (ReAct, hardened)

```
                ┌─────────────────────────────────────────┐
                │  plan ─► generate Action ─► validate     │
                │           (Pydantic)                     │
                │              │  invalid → observation     │
                │              ▼  (shared retry budget)     │
                │  EXPLAIN against live schema             │
                │              │  fails → observation       │
                │              ▼  (same shared budget)      │
                │  execute in read-only sandbox            │
                │   (timeout + row cap)                    │
                │              │                            │
                │              ▼                            │
                │  observation ─► reason (free-text,       │
                │   streamed, display-only) ─► repeat      │
                │              │                            │
                │   step budget exhausted / done           │
                │              ▼                            │
                │  synthesize narrative root-cause report  │
                │  (graceful partial if inconclusive)      │
                └─────────────────────────────────────────┘
```

### 5.2 Structured schemas (Pydantic v2) — **[BUILD]**

The rigid-action / free-reasoning split (PRD §4 L3, §8.1) is enforced here. `reasoning` is **never a field the control flow reads** — it is streamed to the UI as opaque text and discarded by the planner.

```python
class SqlQueryAction(BaseModel):
    type: Literal["sql_query"]
    sql: str
    intent: str  # short, for the receipt — NOT control flow

class ConcludeAction(BaseModel):
    type: Literal["conclude"]
    verdict: Literal["confirmed", "refuted", "inconclusive"]
    root_cause: str
    confidence: Literal["low", "medium", "high"]
    recommended_action: str

Action = Annotated[
    SqlQueryAction | ConcludeAction,
    Field(discriminator="type"),
]

class Observation(BaseModel):
    step: int
    status: Literal["ok", "explain_error", "exec_error", "validation_error",
                    "timeout", "row_cap"]
    row_count: int | None = None
    columns: list[str] | None = None
    preview: list[list] | None = None      # capped rows
    truncated: bool = False
    error: str | None = None               # fed back as corrective context
```

The model is prompted to emit a JSON object that parses into `Action`. **Free-text reasoning is requested on a separate channel** (streamed before the action) and is *never* fed to the discriminated-union parser.

### 5.3 Validation → EXPLAIN → sandbox (P1/P2) **[BUILD]**

Three gates, in order, before any data SQL touches the engine:

1. **Pydantic validation.** Model output → `Action`. `ValidationError` → corrective observation ("your action did not match the schema: …"), loop continues. Counts against the shared retry budget (§5.4).
2. **`EXPLAIN` pre-flight.** For `sql_query`, run `EXPLAIN <sql>` against the **live attached schema** before executing. Catches table/column/type errors and semantically-impossible joins early. Failure → the DB error text is fed back verbatim as an observation (self-correction). Counts against the **same** shared budget.
3. **Read-only sandbox execution.** Only `EXPLAIN`-clean SQL runs. Statement timeout + row cap enforced by the engine (§6.2). Result truncated to `preview` for the wire; full result kept server-side for chart synthesis.

### 5.4 The dual-but-shared retry budget — **[BUILD — non-negotiable]**

PRD §8.1: independent budgets multiply and explode the loop. Therefore:

- There is **one** integer `retry_budget` **per step** (default 2).
- A `ValidationError` (malformed action) **and** an `EXPLAIN` failure (valid action, bad SQL) **both decrement the same counter**.
- Each failure feeds its error back as a corrective observation so the next attempt is informed.
- Budget exhausted on a step → that step ends with a failure observation; it does **not** crash the loop and does **not** reset for free on the next planning attempt — it rolls into the global step budget.

### 5.5 Step budget → graceful partial answer **[BUILD]**

- A hard global step budget (default 8 reason/act cycles).
- On exhaustion, the agent is forced into a `ConcludeAction` with whatever it has: e.g. *"Confirmed revenue dropped 18% in week 14; could not conclusively attribute the cause within the step budget — strongest signal is Mumbai region."*
- This is a **first-class success state**, not an error. It is `verdict: "inconclusive"` with `confidence: "low"|"medium"`. It is *never* a confident wrong answer and *never* a crash (PRD §4 L3, §12).

### 5.6 LLM integration

- Gemini 2.0 Flash. Two prompt roles per step: (a) free-text reasoning (streamed token-by-token to `event: reasoning`), (b) a constrained "emit the next Action as JSON" call.
- Grounding context: the `SchemaGraph` (§3.2) + resolved semantic definitions (§7) + prior observations. Raw row data is summarized, not dumped, to bound tokens.
- Live LLM calls in the demo are **off the critical timing path** — see §10.

---

## 6. Sandboxing & SQL Safety **[BUILD]**

### 6.1 The agent never emits dialect SQL — semantic-layer-as-compilation-target

- The agent targets the **semantic/metric layer**. Metric references resolve (§7) to a canonical SQL expression. For the hackathon the physical engine is DuckDB, so the compiled output *is* DuckDB SQL — but the compilation step is real and isolated in a `compile(metric_ast, dialect)` function.
- **Multi-warehouse = a SQLGlot AST transpile** at that single function: `sqlglot.transpile(sql, read="duckdb", write="snowflake")`. **[DEFEND]** for non-DuckDB engines; the seam exists in code so the Q&A claim ("not 'same SQL' — a compilation target") is demonstrably true, not hand-waved.
- Guardrail: the agent is not rewarded for learning raw DuckDB idioms; prompts steer it to metric references where a definition exists.

### 6.2 Sandbox enforcement

Applied to **every** session connection at creation (`_configure_sandbox`):

- **Read-only**: demo file opened `read_only=True`; live path `ATTACH ... READ_ONLY`. No `CREATE/INSERT/UPDATE/DELETE/COPY/ATTACH` from agent SQL — statements are screened and the engine is read-only regardless.
- **Statement timeout**: per-statement wall-clock cap (default 8s) via a watchdog that interrupts the DuckDB connection; produces `status: "timeout"` observation, not a hang.
- **Row cap**: results hard-capped (default 5,000 rows server-side; `preview` to ≤50 rows on the wire). Over cap → `truncated: true`, `status: "row_cap"`, the agent is told and adapts (aggregate instead of scan).
- **Statement screening**: a deny-list reject of DDL/DML keywords as a pre-`EXPLAIN` static check — defense in depth on top of read-only, so a creative model can't even attempt a write.
- **No multi-statement**: one statement per action; `;`-separated batches rejected at validation.

---

## 7. Layer 4 — Learn — the Semantic Engine **[BUILD]** & Appwrite data model

### 7.1 Semantic store schema (Appwrite collection)

Per-workspace, per-tenant. **The moat: it compounds with use and does not transfer to a competitor** (PRD §9).

```
semantic_definition {
  $id
  workspace_id        (indexed)
  term                 e.g. "revenue"            (indexed, unique per workspace)
  definition_sql       canonical expression, dialect-agnostic at the metric layer
  natural_language     "SUM(order_total) excl. refunds, incl. shipping"
  source               "harvested" | "jit_capture" | "dbt" | "user_correction"
  owner_user_id        (vision: owner+scope — stored now, conflict-resolver [DEFEND])
  scope                "workspace" (MVP) | future: team/user
  materiality          "material" | "trivia"
  created_at, updated_at, version
}
```

### 7.2 Auth & workspace model (Appwrite) **[BUILD]**

- Appwrite Cloud owns auth, sessions, workspaces, saved connections, query history, reports, semantic store.
- Backend verifies the Appwrite JWT on every request (jwks/Appwrite SDK server-side). No backend session store; Appwrite is the source of truth.
- A user belongs to ≥1 workspace; all data (connections, semantic defs, history, reports) is workspace-scoped. The agent loop is testable with **zero auth** (hardcoded workspace + local Postgres) so it is not blocked by P3/P4 (PRD §8.1 build order).

### 7.3 The four mechanisms

1. **Harvest [BUILD, honest scope]** — before guessing, mine existing DB views, query logs (where available), and the dbt manifest into `semantic_definition` rows with `source="harvested"|"dbt"`. **Strong for DB connections; explicitly weak for cold CSV — we do not overclaim** (PRD §4 L4, §12 cold-start).
2. **Just-in-time capture [BUILD]** — the first time a term is **ambiguous ∧ material ∧ undefined**, the agent emits a single clarifying question (one round-trip, surfaced in chat), the answer is written to the store, and **the question is never asked again**. Subsequent uses read the stored definition silently.
3. **Definition receipts [BUILD]** — every answer carries a receipt: `Revenue = SUM(order_total) excl. refunds, incl. shipping`. Wrong guesses are **visible, never silent**. One-click correction is roadmap (requires write path — not in this version).
4. **Materiality gate [BUILD]** — only **material** terms (revenue, churn, profit — configurable list + heuristic) can trigger a JIT interruption. Trivia is answered silently with a best-effort definition and a receipt. This gate also fronts monitoring (§8) to prevent cost blowup.

### 7.4 Cross-user conflict resolution **[DEFEND]**

Owner + scope columns exist in the schema now. The resolver ("Finance defined this differently — which applies?") is **explicitly out of MVP** (PRD §4, §7, §12) and answered on the whiteboard: definitions are owned + scoped, conflicts surface a chooser instead of last-write-wins.

---

## 8. Cross-cutting — Proactive Monitoring **[STUB — architecture real, timing faked]**

PRD §4 cross-cutting, §10 item 7: **one pre-computed anomaly in a Signals feed; no real scheduler built.**

- **Architecture (real, [DEFEND]/[STUB]):** a cheap deterministic detector (stddev / moving average) runs **incrementally on the ingested snapshot — never on the customer's production DB**. It fires only past an **absolute materiality floor** (not mere statistical significance) **and** debounced. Only then does the expensive agent wake, investigate the "why," cache it, and post to the Signals feed / Slack. This ordering is the cost-control moat (PRD §12 cost blowup).
- **Built for the hackathon [STUB]:** the detector function is real and unit-tested on the snapshot, but it is invoked **once, offline, ahead of the demo**, to produce **one** pre-computed anomaly + its **cached full agent investigation**. `GET /signals` serves this. No live scheduler, no cron. The function signature and the materiality-floor + debounce logic are real so the production path is "wire this to a scheduler," not a rewrite.

---

## 9. Integration — Slack **[BUILD — two-way bot]**

The Slack bot is the primary day-to-day interface. Someone asks in a Slack channel or DM, the bot answers in the thread.

### 9.1 How it works

1. User types `@DataPilot what's our revenue this week?` in any channel the bot is added to.
2. Slack sends an event to `POST /slack/events` (the Events API webhook).
3. Backend verifies the Slack signature (HMAC-SHA256 on the raw request body + timestamp — mandatory, Slack rejects unverified apps).
4. The question is routed to the same agent pipeline as the web chat (§5). For simple questions: L1 answer path. For "why" questions: L2 investigation.
5. Response is posted back to the same thread via Slack Web API (`chat.postMessage`).

### 9.2 Response format (v1 — text only)

v1 responses are **plain text + numbers**. No Block Kit interactive components (roadmap). Format:

```
Revenue this week: $184,320
(+12% vs last week)

Definition used: Revenue = SUM(order_total), orders placed Mon–Sun this week.
```

For "why" questions that trigger the full investigation: the bot posts *"Investigating — this takes ~30s"*, runs the agent, then posts the summary. The full step-by-step reasoning is linked to the web dashboard (deep link to the investigation).

### 9.3 OAuth setup

- A Slack App with `app_mentions:read`, `channels:history`, `chat:write` scopes.
- OAuth 2.0 install flow so any workspace can add the bot.
- `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` in backend env.

### 9.4 Outbound reports (unchanged)

Weekly board report + anomaly alerts still post to a configured channel via `chat.postMessage`. Triggered by `POST /reports/weekly/dispatch` (manual in MVP, scheduler is roadmap).

### 9.5 What is roadmap (not v1)

- Block Kit interactive buttons/menus
- Slash commands (`/datapilot`)
- Home tab
- Scheduled automatic dispatch (cron)

---

## 10. Demo Engineering **[STUB — fake timing/scale, never architecture]**

PRD §11 demo-engineering rules are technical requirements, not stage notes:

- **Step 5 (kill shot) is a paced replay of a real prior run.** A real investigation is executed once during the build, its full event stream (every `reasoning` token, `action`, `observation`, `step_*`, `final`) captured to a fixture. The replay endpoint emits **the exact same SSE wire format** (§2.3) at ~2.5s/step (~25s total). The frontend cannot tell replay from live — same events, same parser. Timing **never** depends on Gemini latency.
- **Live LLM is an optional flex**, gated behind a config flag, used only if venue network is proven solid in rehearsal. Default = replay.
- **The fallback preserves the streamed reasoning.** It is forbidden to fall back to a static final report — the stream is the differentiator (PRD §10, §12). If anything fails, the paced replay still plays the full reasoning stream.
- **Demo dataset = the baked read-only `.duckdb` file** in the image (§1.2). Crash-proof under concurrent judge load by construction.
- **Deploy hour 0–1, redeploy continuously** (PRD §12): empty app to Vercel + Render at hour 1, public URL + QR fixed early, CI redeploys on every push so "deploy fails at the end" cannot happen.

---

## 11. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| **Availability (demo window)** | Demo path survives N concurrent judges with zero `database is locked` (guaranteed by §1.2). Health endpoint asserts `demo_db_present`. |
| **Latency** | In-app chat answer (L1) p50 < ~4s (network-dependent). Investigation replay deterministic ~25s. Live investigation bounded by step budget × (LLM + query) — not on the demo timing path. |
| **Time-to-first-answer** | < 2 min from signup (PRD §13): auth → connect demo → ask is the fast path. |
| **Security** | Read-only verified at connection (§3.1). No source mutation possible. No DSN/secret/SQL/stack-trace in any client response. JWT on every authed route. Sandbox: read-only + timeout + row cap + DDL/DML screen + single-statement. |
| **Cost control** | No LLM call in monitoring until deterministic detector + absolute materiality floor + debounce pass (§8). Agent token use bounded by step budget + summarized observations. |
| **Resilience** | No single persistent writable DuckDB file. Session connection closed in `finally`. Bounded shared retry budget. Graceful partial answer instead of crash. Continuous redeploy. |
| **Observability** | Structured logs per investigation: step count, retry-budget consumption, EXPLAIN failures, timeouts, final verdict. Enough to debug a failed demo run in < 2 min. |
| **Privacy** | Detector runs on ingested snapshot, **never** on the customer's production DB. Source is read-only and never mutated. |

---

## 12. Build Order & Critical Path (maps to PRD §8.1, §10)

| Phase | Owner track | Deliverable | Gate |
|---|---|---|---|
| **H0** | All | **FE↔BE API contract frozen** (§2). Empty app deployed to Vercel+Render, QR fixed. | Contract file committed; `/health` 200 in prod. |
| **P1** | BE | Pydantic `Action`/`Observation` (§5.2). DuckDB `SessionManager` + dual path (§1.2). Sandbox config (§6.2). | Unit: schemas reject malformed; demo file opens read-only under 10 concurrent handles. |
| **P2** | BE | validate→EXPLAIN→sandbox loop + shared retry budget + step budget + graceful partial (§5.3–5.5). Runs on local Postgres, **zero auth**. | A real "why did revenue drop" run completes end-to-end and produces a `final` event. |
| **P3** (∥) | BE/Infra | Appwrite auth → workspace; connection registration + read-only verify + schema crawl (§3, §7.2). | JWT enforced; writable role rejected. |
| **P4** (∥) | FE | Streaming UI: SSE client, append-only reasoning panel, structured-event renderer, definition receipts, charts (§2.3, Recharts). | Renders the P2 run's captured stream with no partial-JSON guard. |
| **P5** | BE/FE | Data quality scan (§4). Semantic store + JIT + receipts (§7). Web dashboard endpoint + UI (§2.2). | Quality report returns real issues from demo dataset; semantic definitions visible; dashboard shows connected sources + key numbers. |
| **P6** | BE | Two-way Slack bot: Events API receiver + Web API response (§9). Pre-computed Signals anomaly (§8). | Bot answers a question in Slack; `/signals` returns the anomaly; weekly report posts to Slack channel. |
| **P7** | All | Capture the replay fixture (§10). Rehearse 5× end-to-end. Q&A whiteboard prep for all **[DEFEND]** items. | Full demo runs 5× clean; QR works on a phone off-network-of-laptop. |

**Parallelism rule (PRD §8.1):** P3/P4 (Appwrite/auth) run **in parallel** with P1/P2 (the loop), never after — the loop is testable with hardcoded workspace + local Postgres; nothing downstream is testable without the loop. **The streamed agent loop is never cut.**

---

## 13. Q&A Defense Register (everything [DEFEND])

Whiteboard-ready, deliberately not built (PRD §7, §10, §12):

1. **"Same SQL, no rewrite?"** → No. The agent targets the semantic/metric layer; `compile(ast, dialect)` is the seam; SQLGlot AST transpile is the multi-warehouse path. We concede transpilation honestly; the dialect-agnostic asset is the semantic store, not the SQL string.
2. **DuckDB concurrency** → §1.2. Two separate paths; read-only baked file for the demo; one `:memory:` per investigation session for live; never a multi-worker persistent writable file.
3. **Dual retry budget** → §5.4. One shared bounded budget across ValidationError + EXPLAIN; independent budgets multiply and explode.
4. **Cross-user definition conflict** → §7.4. Owner+scope in schema now; conflict chooser is post-MVP, not last-write-wins.
5. **Semantic cold-start** → §7.3. Harvest is strong on DB connections, explicitly weak on cold CSV; JIT + receipts carry it; we don't overclaim.
6. **Monitoring cost blowup** → §8. Deterministic detector on snapshot + absolute materiality floor + debounce *before* any LLM call.
7. **Wrong-but-valid SQL** → §5.3 + §7.3. EXPLAIN pre-flight + read-only sandbox + definition receipts make wrongness visible and one-click correctable, never silent.
8. **What it does NOT replace** → senior data scientist doing novel ML/causal research (PRD §6). Stated explicitly for credibility.

---

*This TRD operationalizes the hardened architecture of the PRD: immutable read-only source (no writes anywhere in the product), a read-only data quality scanner that shows but never fixes problems, a Pydantic-rigid / free-reasoning sandboxed self-correcting agent with one shared retry budget and a graceful-partial floor, a two-way Slack bot as the primary interface, a web dashboard for deeper work, a deterministic-gated monitoring path, and a just-in-time per-tenant semantic engine as the compounding moat — with every faked element exposing its real interface so the demo fakes scale and timing, never architecture.*
