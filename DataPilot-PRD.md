# DataPilot — Product Requirements Document

**Version:** 1.0 (Hackathon build)
**One-liner:** The AI Data Team. Connect your data where it already lives, ask anything in plain English, and get an autonomous analyst that investigates problems on its own, watches your numbers 24/7, and learns your business's private language over time.


---

## 1. The Problem

Every company sits on data it can't use without a human in the loop.

- Getting answers needs a **data analyst** ($60–90k) who knows SQL, builds dashboards, and writes the same reports every week.
- Predicting and modeling needs a **data scientist** ($120–180k).
- These people are expensive, take weeks to hire, quit, and become a single point of failure for "what does our business actually look like."

The deeper problem is **semantic ambiguity**: words like *revenue*, *churn*, and *profit* mean different things to different people in the same company. An AI that guesses a plausible-but-wrong definition produces answers that are mathematically correct and business-fatal — silently. This is the real reason existing tools (Looker, Tableau) require a data team and a multi-week setup, and why naive "chat with CSV" tools can't be trusted with money decisions.

---

## 2. The Solution

A product that replaces the analyst's role (and the data scientist's repeatable work over time) by doing four things no competitor does together:

1. **Connect** — read-only into the company's real data sources, not file upload.
2. **Clean** — make messy real-world data trustworthy without ever destroying it.
3. **Investigate** — an autonomous agent that answers *and* digs into "why," showing its reasoning.
4. **Learn** — captures the company's private metric definitions as a byproduct of use, building a permanent, non-portable "company brain."

---

## 3. Target Users

| User | Need |
|---|---|
| **Primary: Seed–Series A startup founders/ops** | Have data, can't afford a $70k analyst or Tableau seats. Need answers and weekly reports now. |
| Secondary: Growth / finance / product leads at mid-size companies | Want answers in Slack without waiting on the data team. |
| Buyer | Founder / Head of Ops / Head of Data |

**Wedge:** start where the pain is sharpest and budget exists — startups with data but no analyst.

---

## 4. Core Product — The Four Layers

### Layer 1: Connect (the way in)
- **Read-only** connection to live Postgres/MySQL, warehouses (Snowflake/BigQuery/Redshift), and SaaS sources (Stripe, Salesforce, GA4) via OAuth. CSV/Excel upload supported but is not the primary motion.
- One engine internally (DuckDB for the MVP). **The scale path is NOT "same SQL."** The agent never emits dialect-specific SQL — it targets the semantic/metric layer, which *compiles* to the physical engine (DuckDB now; Snowflake/BigQuery/Redshift later via a SQLGlot AST transpilation step). The dialect-agnostic asset is the semantic store, not the SQL string. This is why the semantic layer must be a compilation target, not just a dictionary.
- On connect: auto-crawl schema, relationships, existing views, and **dbt manifest** if present (inherits the company's existing metric work on day one).
- **Requirement:** the source is never mutated. Read-only role enforced at the connection layer.

### Layer 2: Clean (trust foundation)
- Source tables are **immutable**. Cleaning is a stack of declarative SQL transforms layered as views — fully reversible. Destruction is structurally impossible, not just logged.
- **Two tiers, never merged:**
  - **Safe fixes** — deterministic normalization (date formats, text→number, casing). Auto-applied, reversible.
  - **Review queue** — probabilistic entity resolution (duplicates, merges). **Tagged, never deleted.** Human-driven, row-level, never bulk, never part of ingestion.
- Worst case of a wrong dedup call = "a filter is off," never "revenue is silently wrong."

### Layer 3: Investigate (the wow / replaces the analyst)
- Plain-English questions → instant answer + chart, each carrying a **definition receipt** ("Revenue = SUM(order_total) excl. refunds, incl. shipping — not your definition? ✎").
- **Autonomous Analyst Agent** for "why" questions: a ReAct-style loop — plan → generate SQL → run → observe → reason → repeat → synthesize a narrative root-cause report with a recommended action.
- **Hardening (non-negotiable):**
  - Structured, Pydantic-validated `action`; free-text `reasoning` is display-only, streamed to the UI ("spectator" view), never parsed for control flow.
  - Every SQL is `EXPLAIN`-validated against the live schema **before** execution; DB errors fed back as observations (self-correction, capped retries).
  - Read-only sandbox, statement timeout, row cap.
  - Hard step budget → **graceful partial answer** ("confirmed the drop, couldn't conclusively attribute the cause") instead of a confident wrong one or a crash.

### Layer 4: Learn (the moat)
The semantic engine — builds the company's private dictionary, one tiny piece at a time, never via upfront setup:
1. **Harvest** — before guessing, mine existing DB views, query logs, and dbt models. (Strong for DB connections; weak for cold CSV — don't overclaim.)
2. **Just-in-time capture** — first time an **ambiguous + material + undefined** term is used, ask one fast question, save the answer to the semantic store, never ask again.
3. **Definition receipts** — every output states its assumptions; wrong guesses are visible and one-click correctable, never silent.
4. **Materiality gate** — only interrupt for big, company-making numbers (revenue, churn, profit). Trivia is answered silently.
- **Open requirement (vision, not MVP):** definitions have an owner + scope; cross-user conflicts surface ("Finance defined this differently — which applies?") instead of last-write-wins.

### Cross-cutting: Proactive Monitoring ("never sleeps")
- A **cheap deterministic detector** (stddev / moving average) runs incrementally on the ingested snapshot — never on the customer's production DB.
- Fires only past an **absolute materiality floor** (not just statistical significance) + debounced.
- Only then does the expensive agent wake to investigate the "why," cache it, and post to the **Signals feed** / Slack.

---

## 5. Integration Model (how it embeds in a company)

Not "people log into a dashboard." It embeds in three places the work already happens:

1. **The data** — connect read-only where data already lives. No upload, no export project.
2. **Slack/Teams** — a bot in the channel where data questions are already asked. Questions hit the bot before they reach a human. This is the primary interface and the distribution mechanism (spreads team-to-team on its own).
3. **The cadence** — owns the recurring weekly metrics email and monthly board deck, generated on schedule with zero human in the loop.

**Land-and-expand:** one team + one source → answers visible to others → more sources connected → more cross-team questions answerable → spreads sideways through the org.

**Stickiness / un-removable:** it owns the recurring reports, holds the accumulated definitions, and lives in the daily workflow. Removing it = re-hiring the role.

---

## 6. The Autonomy Ladder (what job, when)

| Level | Replaces | Status |
|---|---|---|
| L1 Answer | "pull me this number" | MVP |
| L2 Investigate | ad hoc deep dives | MVP |
| L3 Own reporting | the weekly/board grind | MVP |
| L4 Monitor | "keep an eye on it" | MVP |
| L5 Model | forecasting, cohorts, segmentation, A/B readouts | Roadmap |
| L6 Recommend | action tied to $ impact | Vision |

**Honest claim:** replaces the **analyst** (~90% of the role) now; replaces the **data scientist's repeatable modeling** over time. **Does not** replace a senior data scientist doing novel ML/causal research — stated explicitly for credibility.

---

## 7. Non-Goals

- Not a BI dashboard builder you operate manually (that's the thing we replace).
- Not a writable system — never mutates source data.
- Not novel ML research / custom model development (senior DS territory).
- Not bulk auto-dedup or any silent destructive operation.
- MVP does not build SOC2, SSO, multi-connector breadth, or the cross-user conflict resolver — these are architecture defended in Q&A, not built in the hackathon.

---

## 8. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind + Recharts + shadcn/ui |
| Backend | Python FastAPI (owns DuckDB + agent loop) |
| Data engine | DuckDB — per-session in-memory; read-only. Multi-dialect = SQLGlot transpilation (roadmap), not "same SQL" |
| Auth + metadata | Appwrite Cloud (auth, workspaces, saved connections, query history, reports, semantic store) |
| LLM | Gemini 2.0 Flash (agent reasoning + SQL gen) |
| Integration | Slack/Teams bot |
| Deploy | Frontend: Vercel · Backend: Render/Railway · public URL + QR for judges |

### 8.1 Hard engineering constraints (non-negotiable)

- **DuckDB concurrency:** never a persistent file under multiple workers (`database is locked` = dead demo). One `:memory:` connection **per investigation session** (source attached once, whole agent loop runs, destroyed at session end) — not per request. Single-process uvicorn + threadpool for the live-Postgres path (DuckDB releases the GIL).
- **Crash-proof demo path:** the seeded demo dataset ships as a **baked read-only `.duckdb` file** in the image. Multiple processes opening the same file read-only is safe → "many judges querying at once" cannot crash it. This path is separate from the live-connection path.
- **Dialect:** agent emits semantic/metric-layer queries → compiled per engine. SQLGlot transpilation is the multi-warehouse path. Do not let the agent learn raw DuckDB SQL as the moat interface.
- **Dual retry budget:** the `ValidationError` loop (malformed action) and the `EXPLAIN`-failure loop (valid action, bad SQL) share **one bounded retry budget per step**, each feeding the error back as a corrective observation. Independent budgets multiply and explode the loop.
- **Wire format (prevents the UI-crash trap by design):** the stream is split by type, never parsed as partial JSON. Free-text `reasoning` streams as raw append-only token text (never parsed, cannot break the UI). Structured state (`action`, `observation`, step boundaries) is emitted as **discrete SSE events — one event = one fully-valid JSON object per completed step.** The backend never yields a half-formed JSON object, so the frontend never defends against one. (Transport-layer application of the rigid-action / free-reasoning split.)
- **Build order:** hour-zero artifact is the **FE↔BE API contract** (FE streaming-UI and BE agent work deadlock without it). Then Pydantic `Action`/`Observation` schemas, then the validate→EXPLAIN→sandbox loop (P1/P2). Appwrite auth runs **in parallel** (P3/P4), not after — the loop is testable with zero auth (hardcoded workspace, local Postgres); nothing downstream is.

---

## 9. Business Model

**Market:** global BI/analytics ≈ $30B+; analyst/DS labor far larger.

**Pricing**
| Tier | Price | For |
|---|---|---|
| Starter | $49/mo | 1 source, chat + cleaning + receipts |
| Growth | $199/mo | DB/warehouse connectors, autonomous agent, Slack bot, alerts |
| Scale | $999/mo | Multi-workspace, scheduled investigations, SSO |

Anchored against Tableau ($900/user/yr) **+** an analyst ($60–80k/yr) — ~1/30th the cost.

**Moat:** (1) the per-tenant semantic graph that compounds with use and doesn't transfer to a competitor; (2) the enterprise trust gauntlet (SOC2/SSO/audit) a copycat must also clear. Both stack.

**The ask:** funding + design partners → 18-month plan: warehouse connectors, agent depth (L5), enterprise trust.

---

## 10. Hackathon Scope (the 20-hour build)

**The three things 20 hours go into (everything else serves these):**
1. Appwrite auth → workspace flow
2. React/Vite conversational UI — async state + **streaming the agent's reasoning** (the spectator moat)
3. Pydantic-enforced FastAPI reasoning loop (validated action → EXPLAIN → read-only sandbox → graceful partial answer)

**Must work (critical path):**
1. Appwrite auth → workspace
2. Connect to a live read-only Postgres (prove "no upload")
3. Tiered cleaning on a seeded messy dataset (safe auto-fixes + tagged review queue)
4. Chat → answer + chart + definition receipt
5. Autonomous agent investigation on the demo dataset (streamed reasoning UI)
6. Seeded semantic store (show "it used your definition + asked once")
7. One **pre-computed** anomaly in a Signals feed (no real scheduler built)
8. Deployed to a public URL + QR

**Slack — scoped, not cut:** keep **outbound-only** (Slack incoming webhook, ~20 min, no OAuth/listener) on the scheduled auto-report — a real message in a real channel. **Cut the inbound two-way listener** (Events API + OAuth + Block Kit = 4–6 h sinkhole); demo the two-way ask as the in-app chat.

**Cut order if behind:** live warehouse connectors → multi-dataset → outbound Slack → tiered cleaning down to safe-fixes only. **Never cut:** the streamed agent loop. It is the company.

**Demo principle:** fake the *scale and timing*, never the *architecture*. Have the hardened architecture (semantic-layer-as-compilation-target, DuckDB concurrency model, dual retry budget) ready to whiteboard in Q&A.

---

## 11. 3-Minute Demo Script

1. **0:00–0:30** — Problem: "$80k for someone to answer questions you should get in seconds." Show ugly data.
2. **0:30–0:55** — Connect read-only Postgres (no upload). Safe fixes auto-applied; dupes tagged not deleted.
3. **0:55–1:20** — Ask in chat → instant chart + definition receipt.
4. **1:20–1:40** — Ambiguous term → one JIT question → "it now knows our language."
5. **1:40–2:25** — Kill shot: "why did revenue drop?" → **paced cached replay** of a real investigation (~25s of streamed thought at ~2.5s/step) → root-cause report (incl. honest uncertainty). **Presenter narrates the whole stream, never goes silent:** *"Watch it work — it just isolated Mumbai, now it's writing a new query to check returning customers. An analyst gets you this Tuesday. We did it in 30 seconds."*
6. **2:25–2:50** — Switch to Slack (**outbound only — the feature actually built**): the weekly board report + overnight anomaly, already waiting. Line: *"Your analyst burns 6 hours on this every Monday. It wrote and delivered it while the team slept — every week, forever. That's the hire you stop making."*
7. **2:50–3:00** — "Live now — scan this." QR. "We replace the tool and the hire."

**Demo-engineering rules (read before building the demo):**
- Step 5 is a **paced replay of a real prior run**, not a live API call. Live LLM is an optional flex *only* if venue network is proven solid in rehearsal. Timing must never depend on Gemini latency.
- The fallback **preserves the streamed reasoning** — never cut to a static final report. The stream is the differentiator; skipping it demotes the demo to a commodity. If anything fails, the paced replay still plays.
- Step 6 is **outbound Slack only**. Do not type into Slack live (inbound listener was cut in §10).

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Agent emits valid-but-semantically-wrong SQL | `EXPLAIN` pre-flight + read-only sandbox + definition receipts make wrongness visible/correctable |
| Live LLM hang in pitch | Cache the demo Q&As + one full agent run; fallback serves instantly |
| Deploy fails at the end | Deploy empty app hour 0–1, redeploy continuously |
| Semantic cold-start (no homework to harvest) | JIT capture + receipts; don't overclaim harvesting on cold CSV |
| Cross-user definition conflict | Out of MVP scope; owner+scope model is the Q&A answer |
| Cost blowup on monitoring | Deterministic detector on snapshot + materiality floor + debounce before any LLM call |
| Team burnout (20+ hr) | Enforced rest rotation; 2 build / 2 rest, swap |
| `database is locked` crash during demo | Per-session in-memory DuckDB + baked read-only demo file; no multi-worker persistent file |
| Slack integration eats critical path | Outbound webhook only (~20 min); inbound listener cut, not built |
| Agent loop explodes via stacked retries | Single shared bounded retry budget across ValidationError + EXPLAIN loops |
| "Same SQL, no rewrite" challenged by technical judge | Reframe to semantic-layer-as-compilation-target + SQLGlot roadmap; concede transpilation honestly |

---

## 13. Success Metrics

**Hackathon:** working deployed URL; full demo runs end-to-end 5×; judges can use it via QR; Q&A answers land.

**Product (post):** time-to-first-answer < 2 min from signup; # definitions captured per workspace (moat depth); % questions answered without human; recurring reports owned per customer; logo retention.

---

*This PRD reflects the hardened architecture: immutable source, tiered non-destructive cleaning, sandboxed self-correcting agent, deterministic-gated monitoring, and a just-in-time semantic engine as the compounding moat.*
