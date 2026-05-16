# Viriya — Technical Requirements Document

**Version:** 1.1 (Hackathon build — 20h)
**Companion to:** `Viriya-PRD.md` v1.0
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
| `GET` | `/slack/oauth/callback` | Slack OAuth install callback — exchanges `code` for `bot_token`, writes `slack_installations` document, redirects to dashboard. | [BUILD] |

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
data: {"investigation_id":"...","verdict":"confirmed","root_cause":"...","confidence":"medium","recommended_action":"...","chart":{"chart_type":"line","x_axis":"wk","y_axis":"revenue","series_label":"Revenue"},"data":[["2026-01-06",184320.0],...],"definition_receipts":[...]}
```

**Frontend contract (enforced):**
- **Do NOT use the native `EventSource` API.** The browser's `EventSource` auto-reconnects on any dropped packet — for a replayed stream with no server-side cursor, this restarts the stream from step 1, duplicating all reasoning output and charts in the UI. Use `fetch` + `ReadableStream` + `AbortController` instead for absolute control.

**The zombie-stream trap:** if the `while(true)` reader runs inside a `useEffect` or submit handler without cleanup, and the user navigates away or double-clicks "Ask", the old reader keeps running in the background. It tries to update unmounted React state, throws memory-leak warnings, and can corrupt the reasoning panel if a second stream fires concurrently. The `AbortController` is mandatory — not optional.

**The controller must live in a `useRef`** so both the `useEffect` cleanup and the new-question submit handler reference the same instance. A local variable is not sufficient — a double-click creates a new controller while cleanup still holds the old one.

```typescript
// At component level — not inside the handler
const abortRef = useRef<AbortController | null>(null);

async function startStream(id: string, jwt: string) {
  // Abort any in-flight stream before starting a new one (double-click safe)
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  try {
    const response = await fetch(`/api/v1/investigations/${id}/stream`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: controller.signal,   // ← mandatory
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop()!;  // keep incomplete trailing frame

      for (const frame of frames) {
        const eventLine = frame.match(/^event: (.+)$/m)?.[1];
        const dataLine  = frame.match(/^data: (.+)$/ms)?.[1];
        if (!eventLine || !dataLine) continue;

        if (eventLine === "reasoning") {
          appendReasoning(dataLine.replace(/\\n/g, "\n"));
        } else {
          dispatch(eventLine, JSON.parse(dataLine));  // guaranteed complete
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return;  // clean exit — user navigated away or fired a new question. Not an error.
    }
    renderError("Stream connection lost. Please try again.");
  }
}

// In the useEffect that owns the stream:
useEffect(() => {
  startStream(investigationId, jwt);
  return () => { abortRef.current?.abort(); };   // cleanup on unmount
}, [investigationId]);
```

- On `reasoning`: `appendReasoning` — append to the live thought panel. No `JSON.parse`.
- On any structured event: `JSON.parse(dataLine)` is guaranteed to succeed — backend invariant.
- On `AbortError`: silent clean exit. Never show an error to the user.
- On any other error: show the graceful partial message (§5.5). Never a stack trace.
- Heartbeat: `: keepalive\n\n` comment every 15s so proxies (Render/Vercel) don't drop the connection. The reader skips frames with no `event:`/`data:` silently.

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
  - The provided Postgres role must be read-only. We do not trust the caller's claim — we *verify* by attempting a probe write to a scratch schema inside a transaction that is always rolled back; if the write *succeeds*, the connection is **rejected** with a clear error ("supplied role can write — Viriya requires a read-only role"). DuckDB's `READ_ONLY` attach is a second belt; the rejected-on-writable-role check is the suspenders.
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

Viriya **never writes to the source, never applies fixes, never deletes or merges rows.** The data quality layer is a pure read: scan, analyse, report. The customer's database looks identical before and after connecting. This is a product decision (trust must be earned before touching data) and a technical invariant (all access is read-only by construction — §3.1, §6.2).

### 4.2 What the scan does — and the pushdown trap **[BUILD — non-negotiable]**

**The trap:** DuckDB pushes query predicates down to Postgres when using `ATTACH ... (TYPE postgres)`. A regex check or fuzzy-string comparison against a 2M-row production table runs as a full table scan on the customer's live Postgres — hanging the endpoint indefinitely and degrading their DB. This must be prevented structurally, not just carefully.

**The fix — two-step sample approach:**

1. **Pull a bounded sample into DuckDB memory first.** Every diagnostic query fetches at most 5,000 rows from Postgres using `LIMIT 5000`. This is a fast, index-friendly Postgres operation. Once those rows are in DuckDB's in-memory space, all subsequent checks run locally in DuckDB — regex, fuzzy matching, cardinality analysis — with zero further load on Postgres.

2. **Never run fuzzy/regex directly over the attached Postgres.** Fuzzy duplicate detection especially must only run on the in-memory sample.

```python
# Safe pattern — pull sample first, analyse locally
SAMPLE_SQL = "SELECT {cols} FROM src.{table} LIMIT 5000"
con.execute(f"CREATE TEMP TABLE _sample AS ({SAMPLE_SQL})")
# All checks now run on _sample — DuckDB in-memory, no Postgres load
```

> Note on TABLESAMPLE: DuckDB's Postgres scanner may not push `TABLESAMPLE` to Postgres reliably. `LIMIT 5000` is the safe, guaranteed-pushdown path.

Runs once on connect, re-runnable on demand. Checks performed on the in-memory sample:

| Check | What it finds | Output |
|---|---|---|
| **Date format inconsistency** | Columns with mixed date formats (e.g. `01/02/23` and `2023-01-02` in the same column) | Table, column, example values, estimated row count affected |
| **Text-as-number** | Numeric columns stored as text (e.g. `"1,200"`, `"$99.00"`) | Table, column, example values |
| **Unexpected nulls** | Columns with high null % in fields expected to be populated | Table, column, null % in sample |
| **Likely duplicates** | Row pairs with high fuzzy similarity on key identifier columns (name, email, ID) — run on sample in DuckDB only | Pair examples, similarity score |
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

**Foundational principle: treat every LLM output as untrusted user input.** The model is a probabilistic text generator. It will occasionally add extra fields, embed reasoning inside the action JSON, nest objects unexpectedly, or produce a string where an int is required. The Pydantic schemas are the physics of the sandbox — they define what can exist, and anything outside those bounds is rejected immediately and fed back as a corrective observation.

The rigid-action / free-reasoning split (PRD §4 L3, §8.1) is enforced here. `reasoning` is **never a field the control flow reads** — it is streamed to the UI as opaque text and discarded by the planner.

**`extra='forbid'` is mandatory on all Action models.** If the model smuggles a `reasoning` field into the action JSON, Pydantic must reject it — not silently ignore it. Without `extra='forbid'`, Pydantic v2 silently drops unknown fields by default, which masks the model misbehaving.

```python
class SqlQueryAction(BaseModel):
    model_config = ConfigDict(extra="forbid")  # reject unknown fields — mandatory
    type: Literal["sql_query"]
    sql: str
    intent: str  # short, for the receipt — NOT control flow

class ConcludeAction(BaseModel):
    model_config = ConfigDict(extra="forbid")  # reject unknown fields — mandatory
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
    model_config = ConfigDict(extra="forbid")
    step: int
    status: Literal["ok", "explain_error", "exec_error", "validation_error",
                    "timeout", "row_cap"]
    row_count: int | None = None
    columns: list[str] | None = None
    preview: list[list] | None = None      # capped rows
    truncated: bool = False
    error: str | None = None               # fed back as corrective context
```

The model is prompted to emit a JSON object that parses into `Action`. **Free-text reasoning is requested on a separate channel** (streamed before the action) and is *never* fed to the discriminated-union parser. `ValidationError` from any of the above → the error message is the corrective observation, loop continues, shared retry budget decremented.

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

### 5.6.1 Gemini markdown JSON trap — and the fix **[BUILD — non-negotiable]**

**The trap:** Even when explicitly prompted to output only raw JSON, Gemini 2.0 Flash frequently wraps output in Markdown fences:

````
```json
{ "type": "sql_query", "sql": "..." }
```
````

`Action.model_validate_json()` receives the raw string including backticks and throws `ValidationError` immediately. This burns the shared retry budget, Gemini apologies in its next response (also in text), and the budget exhausts in seconds.

**Primary fix — use Gemini's structured output mode:**

```python
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=prompt,
    config=GenerateContentConfig(
        response_mime_type="application/json",   # ← forces raw JSON, no fences
        response_schema=action_schema,           # ← JSON schema derived from Action
    ),
)
action = Action.model_validate_json(response.text)
```

`response_mime_type="application/json"` instructs Gemini at the API level to emit raw JSON. This is the cleanest fix — the markdown fence problem disappears entirely.

**Fallback strip — defence-in-depth for any model that still wraps:**

```python
import re

def extract_json(text: str) -> str:
    text = text.strip()
    # Handles ```json ... ``` and ``` ... ``` with any whitespace variation
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    return m.group(1).strip() if m else text

action = Action.model_validate_json(extract_json(response.text))
```

The regex approach is more robust than line-splitting (`split("\n")[1:-1]`) which breaks when the closing fence has trailing whitespace or the JSON has a blank last line. Apply both: structured output mode as primary, `extract_json` as the fallback before every `model_validate_json` call.

### 5.7 Chart synthesis — lightweight config, never raw rows to LLM **[BUILD — non-negotiable]**

**The trap:** the agent's final SQL query may return up to 5,000 rows (the sandbox cap). Feeding a 5,000-row JSON array into a Gemini prompt to ask "generate a chart config" consumes the entire context window, spikes latency to 30+ seconds, and will fail outright. This must never happen.

**The rule:** the LLM never sees more than the 50-row `preview`. Chart synthesis is based on column headers + preview only. The agent emits a `ChartConfig` as part of `ConcludeAction` — a lightweight declarative spec:

```python
class ChartConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chart_type: Literal["line", "bar", "area", "scatter", "pie"]
    x_axis: str        # column name
    y_axis: str        # column name
    series_label: str  # human label for the legend

class ConcludeAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["conclude"]
    verdict: Literal["confirmed", "refuted", "inconclusive"]
    root_cause: str
    confidence: Literal["low", "medium", "high"]
    recommended_action: str
    chart: ChartConfig | None = None   # None if no chart is relevant
```

The `final` SSE event carries both `chart` (the config) and `data` (the 50-row `preview` from the last relevant query step). The frontend binds them: Recharts uses `data` as the data array, `chart.x_axis`/`chart.y_axis` as the axis keys. No separate data fetch required.

**Why 50 rows is enough for charts:** a correctly-written agent query GROUPs and aggregates before returning (weekly revenue = 13 rows, monthly cohorts = 12 rows). If a query returns 5,000 raw rows, the `row_cap` observation already tells the agent to aggregate instead of scan. 5,000-row chart results indicate a bad agent query, which the EXPLAIN pre-flight and row_cap feedback should have caught.

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

### 7.2.1 The Appwrite async trap — mandatory thread wrapping **[BUILD — non-negotiable]**

**The trap:** The official Appwrite Python SDK (`appwrite` on PyPI) is **strictly synchronous** — it uses the `requests` library under the hood. You cannot `await` Appwrite SDK methods. Two failure modes:

- `await appwrite_db.get_installation(team_id)` → `TypeError` crash immediately.
- Call without `await` inside an `async def` FastAPI route → blocks the entire ASGI event loop during the network round-trip. Every SSE stream stalls, every other user's request queues behind it. The single-process concurrency model collapses.

**The fix:** wrap every Appwrite SDK call in `anyio.to_thread.run_sync()`. This pattern is already established in the TRD for DuckDB (§1.2) — apply it identically to all Appwrite calls:

```python
import anyio

# Instead of:  result = appwrite_db.list_documents(...)
# Use:
result = await anyio.to_thread.run_sync(
    lambda: appwrite_db.list_documents(
        database_id=DB_ID,
        collection_id=COLLECTION_ID,
        queries=[Query.equal("slack_team_id", team_id)],
    )
)
```

**Alternative:** use `httpx.AsyncClient` to hit the Appwrite REST API directly (same endpoints, full async, no SDK dependency). Better for production; `anyio.to_thread` is sufficient for the hackathon.

Every Appwrite call in this TRD — `get_installation`, `create_installation`, semantic store reads/writes, workspace lookups — is subject to this rule without exception.

### 7.3 Slack tenant mapping — **`slack_installations` collection [BUILD — required for Slack to work at all]**

**The gap:** Slack webhooks carry no Appwrite JWT. They carry a `team_id`. Without a mapping from `team_id` → `workspace_id` → `default_connection_id`, the agent loop has no context to run — it doesn't know whose database to query or which semantic store to load.

**The fix:** a `slack_installations` Appwrite collection, written once during Slack OAuth install:

```
slack_installations {
  $id
  slack_team_id          (indexed, unique)
  slack_team_name
  slack_bot_token        (encrypted at rest — used for chat.postMessage)
  appwrite_workspace_id  (FK → workspace)
  default_connection_id  (FK → connections — the DB to query for this workspace)
  installed_by_user_id
  installed_at
}
```

**The OAuth state trap — and the fix:** When the user clicks "Add to Slack" in the React app, they leave to Slack's auth page. When Slack redirects back to `/slack/oauth/callback`, it is a cross-origin browser redirect — **no Appwrite JWT is attached**. The backend has no idea which workspace to link the new `team_id` to without it.

**Fix: the `state` nonce pattern.** Raw base64 of `workspace_id` in `state` is a CSRF vulnerability (an attacker can craft a URL with a victim's `workspace_id`). Use a nonce instead:

```python
# 1. React app calls this to get the install URL
@app.get("/slack/install-url")
async def slack_install_url(workspace_id: str, user=Depends(require_auth)):
    nonce = secrets.token_urlsafe(16)
    # Store nonce → workspace_id with a 10-minute TTL (in-memory dict or Appwrite)
    pending_installs[nonce] = {"workspace_id": workspace_id, "expires": time() + 600}
    url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={SLACK_CLIENT_ID}"
        f"&scope=app_mentions:read,chat:write,channels:history"
        f"&state={nonce}"          # ← nonce, not workspace_id directly
        f"&redirect_uri={CALLBACK_URL}"
    )
    return {"url": url}

# 2. Slack redirects here after authorization
@app.get("/slack/oauth/callback")
async def slack_oauth_callback(code: str, state: str):
    entry = pending_installs.pop(state, None)
    if not entry or time() > entry["expires"]:
        raise HTTPException(403, "Invalid or expired state")

    # Exchange code for bot_token
    resp = await slack_client.oauth_v2_access(code=code)
    team_id   = resp["team"]["id"]
    bot_token = resp["access_token"]

    # Write the mapping
    await appwrite_db.create_installation(
        slack_team_id=team_id,
        appwrite_workspace_id=entry["workspace_id"],
        slack_bot_token=bot_token,
    )
    return RedirectResponse("/dashboard?slack=connected")
```

**Written during Slack OAuth install flow** — the flow above runs once per workspace install. The `state` nonce expires in 10 minutes and is one-time-use, preventing replay and CSRF.

**Read in the event handler** (synchronously, before enqueuing):

```python
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    verify_slack_signature(body, request.headers)
    payload = json.loads(body)

    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}

    event = payload.get("event", {})
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return {"status": "ok"}

    team_id = payload.get("team_id")
    installation = await appwrite_db.get_installation(team_id)  # ← the lookup
    if not installation:
        return {"status": "ok"}  # not installed for this team — silent drop

    event_id = payload.get("event_id")
    if is_duplicate(event_id):
        return {"status": "ok"}
    mark_seen(event_id)

    background_tasks.add_task(
        handle_slack_event,
        question=event.get("text", ""),
        channel=event.get("channel"),
        thread_ts=event.get("ts"),
        workspace_id=installation["appwrite_workspace_id"],
        connection_id=installation["default_connection_id"],
        bot_token=installation["slack_bot_token"],
    )
    return {"status": "ok"}
```

**Why not hardcode:** the full solution is ~30 minutes (OAuth callback + one Appwrite write). Hardcoding means you can't demo "install the bot in your workspace" — you lose the land-and-expand story. Build it properly.

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

### 9.1 How it works — with raw body + signature verification **[BUILD — non-negotiable]**

1. User types `@Viriya what's our revenue this week?` in any channel the bot is added to.
2. Slack sends an event to `POST /slack/events`.
3. Backend verifies the Slack HMAC-SHA256 signature **on the exact raw request bytes**.
4. Question is routed to the same agent pipeline as the web chat (§5).
5. Response posted back to the thread via `chat.postMessage`.

**The raw body trap:** standard FastAPI middleware (CORS, logging, compression) may consume or mutate the request body before the route handler sees it. If the body bytes are modified even slightly, the HMAC hash mismatches and Slack rejects 100% of legitimate events silently — the bot stops working with no error visible to users. Fix: read raw bytes first at the route level, verify signature, then parse JSON. Never call `await request.json()` before verification.

**The timestamp check is mandatory** — without it, an attacker can replay captured valid requests indefinitely:

```python
import hashlib, hmac, time, json

def verify_slack_signature(raw_body: bytes, headers: dict) -> None:
    slack_signature  = headers.get("x-slack-signature", "")
    slack_timestamp  = headers.get("x-slack-request-timestamp", "")

    # Replay attack prevention — reject requests older than 5 minutes
    if abs(time.time() - float(slack_timestamp)) > 300:
        raise HTTPException(403, "Request timestamp too old")

    sig_basestring = f"v0:{slack_timestamp}:{raw_body.decode('utf-8')}"
    expected = "v0=" + hmac.new(
        SLACK_SIGNING_SECRET.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, slack_signature):
        raise HTTPException(403, "Invalid signature")

@app.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()          # ← raw bytes first, always
    verify_slack_signature(raw_body, request.headers)   # ← verify on raw bytes
    payload = json.loads(raw_body)           # ← parse JSON only after verification

    # ... rest of handler
```

`request.body()` in Starlette caches the bytes — calling it again later is safe. The rule is: **verify before parse, never parse before verify**.

### 9.2 The bot self-loop trap **[BUILD — non-negotiable]**

When the bot calls `chat.postMessage`, Slack fires a new `message` event back to `POST /slack/events`. Without filtering, the bot processes its own reply, calls the agent again, posts another answer, and loops indefinitely — filling the channel with recursive responses.

**Fix:** check `bot_id` in the event payload before any other processing. Drop silently if it's from a bot (including our own bot):

```python
event = payload.get("event", {})
if event.get("bot_id") or event.get("subtype") == "bot_message":
    return {"status": "ok"}  # drop — our own reply or another bot
```

This check goes **before** the deduplication check and **before** enqueuing.

### 9.3 thread_ts capture — must happen synchronously **[BUILD]**

The background task needs `channel` and `thread_ts` from the original event to reply in-thread (so the answer appears as a reply, not a new top-level message). These must be extracted **synchronously inside the route handler** before returning 200, because the request object is gone by the time the background task runs.

```python
# Inside the route handler, before returning 200
event = payload.get("event", {})
channel = event.get("channel")
thread_ts = event.get("ts")        # reply to this thread
question  = event.get("text", "")

background_tasks.add_task(
    handle_slack_event,
    question=question,
    channel=channel,
    thread_ts=thread_ts,
)
return {"status": "ok"}
```

`handle_slack_event` uses `thread_ts` when calling `chat.postMessage` so the response is threaded under the original question.

### 9.4 Response format (v1 — text only)

v1 responses are **plain text + numbers**. No Block Kit interactive components (roadmap). Format:

```
Revenue this week: $184,320
(+12% vs last week)

Definition used: Revenue = SUM(order_total), orders placed Mon–Sun this week.
```

For "why" questions that trigger the full investigation: the bot posts *"Investigating — this takes ~30s"* immediately (via a second `chat.postMessage` before the agent starts), runs the agent in the background, then posts the summary in the same thread. The full step-by-step reasoning is linked to the web dashboard via a deep link to the investigation.

### 9.4.1 Ghost bot silent failure — mandatory try/except **[BUILD — non-negotiable]**

`BackgroundTasks` run entirely outside the request lifecycle. If the agent loop hits an unhandled exception (Appwrite down, DuckDB OOM, Gemini timeout, `chat.postMessage` itself failing), the exception is swallowed into server logs. The user sees *"Investigating..."* and the bot disappears forever — they assume the product is broken.

**Two distinct failure modes, one wrapper covers both:**
- Failures *inside* the agent loop (bad SQL, step budget exhausted) → already handled by graceful-partial (§5.5), which posts a result.
- Failures *outside* the loop (infra crash before the loop even starts, or `chat.postMessage` itself failing) → caught here.

```python
async def handle_slack_event(
    question: str, channel: str, thread_ts: str,
    workspace_id: str, connection_id: str, bot_token: str,
):
    try:
        # Post the "investigating" acknowledgement immediately
        await slack_post(bot_token, channel, thread_ts, "Investigating — this takes ~30s ⏳")

        # Run the full agent pipeline
        result = await run_investigation(
            question=question,
            workspace_id=workspace_id,
            connection_id=connection_id,
        )

        # Post the answer
        await slack_post(bot_token, channel, thread_ts, format_slack_result(result))

    except Exception as e:
        logger.error(f"Slack agent failure: {e}", exc_info=True)
        # Always post a fallback — never go silent
        try:
            await slack_post(
                bot_token, channel, thread_ts,
                "I ran into an infrastructure issue querying the data. "
                "Please check the dashboard for details."
            )
        except Exception:
            pass  # if even the fallback post fails, log and move on
```

The inner `try/except` on the fallback `slack_post` prevents an exception in error-reporting from crashing the background task silently.

### 9.5 OAuth setup

- A Slack App with `app_mentions:read`, `channels:history`, `chat:write` scopes.
- OAuth 2.0 install flow so any workspace can add the bot.
- `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` in backend env.

### 9.6 Outbound reports (unchanged)

Weekly board report + anomaly alerts still post to a configured channel via `chat.postMessage`. Triggered by `POST /reports/weekly/dispatch` (manual in MVP, scheduler is roadmap).

### 9.7 What is roadmap (not v1)

- Block Kit interactive buttons/menus
- Slash commands (`/Viriya`)
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
