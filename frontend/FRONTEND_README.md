# DataPilot — Frontend Guide

> Everything you need to build a world-class frontend for DataPilot.
> Read this fully before touching any code.

---

## What is DataPilot?

DataPilot is **"The AI Data Team"** — it replaces a company's data analyst.

A user connects their database, asks a question in plain English like *"Why did revenue drop last week?"*, and DataPilot:
1. **Thinks step by step** (streamed live, like watching an analyst work)
2. **Writes and runs SQL** against their data
3. **Produces a root-cause report** with a chart and confidence level
4. **Defines what "revenue" means** in their company and never forgets it

The **frontend is the product**. The streaming reasoning panel — watching the AI think in real time — is the single biggest differentiator. Make it feel alive.

---

## The Vibe / Design Direction

**Dark, data-forward, trustworthy.** Think Linear + Vercel dashboard + Notion AI sidebar.

- Dark background (`gray-950` base)
- Accent color: `sky-500` / `brand-500` — used sparingly for active states, CTAs, streaming indicators
- Monospace font for SQL, reasoning text, metric values
- Clean cards with `gray-900` bg + `gray-800` borders
- No gradients, no heavy animations — subtle transitions only
- The reasoning panel should feel like a terminal / live feed, not a chat bubble

**The kill-shot moment:** When a user asks "Why did revenue drop?" — the left panel lights up with the AI's thought process streaming in real time, steps appear on the right one by one, and 25 seconds later a chart pops up with a root cause. **This moment has to feel magical.** Prioritize this above everything else.

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18 | UI |
| Vite | 5 | Build tool |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Styling |
| Recharts | 2 | Charts in the final investigation report |
| React Router | 6 | Page routing |
| Appwrite JS SDK | 16 | Auth (login, session, JWT) |

All dependencies are in `package.json`. Run `npm install`.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values (get from the BE person)
cp .env.example .env

# 3. Start dev server
npm run dev
```

### `.env` values you need:
```
VITE_API_URL=http://localhost:8000/api/v1   # BE server (change to prod URL when deployed)
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=                   # get from BE person — they set up Appwrite
```

---

## File Structure

```
src/
├── App.tsx                          ← Router + auth gate
├── main.tsx                         ← Vite entry
├── index.css                        ← Tailwind base styles
│
├── pages/                           ← One file per route
│   ├── AuthPage.tsx                 ← Login screen
│   ├── DashboardPage.tsx            ← Connected sources + key metrics + recent investigations
│   ├── InvestigationPage.tsx        ← THE MAIN PAGE — chat + streaming agent
│   ├── QualityPage.tsx              ← Data quality scan report (read-only, no fix buttons)
│   ├── SignalsPage.tsx              ← Anomaly alerts feed
│   └── SemanticPage.tsx             ← Company "brain" — definitions the AI has learned
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx              ← Nav sidebar
│   ├── investigation/               ← THE MOST IMPORTANT COMPONENTS
│   │   ├── ChatInput.tsx            ← Question input box
│   │   ├── ReasoningPanel.tsx       ← Left panel — streaming AI thought process
│   │   ├── StepCard.tsx             ← Each agent step (SQL + result table)
│   │   ├── FinalReport.tsx          ← Root cause report + chart + definitions
│   │   ├── ChartRenderer.tsx        ← Recharts chart (binds ChartConfig + data)
│   │   └── DefinitionReceipt.tsx    ← "Revenue = SUM(order_total) excl. refunds"
│   ├── quality/
│   │   ├── QualityReport.tsx        ← List of issues with severity summary
│   │   └── IssueCard.tsx            ← Individual issue card
│   ├── dashboard/
│   │   ├── SourceCard.tsx           ← Connected sources count
│   │   └── MetricSnapshot.tsx       ← Key metric card
│   └── shared/
│       ├── LoadingSpinner.tsx
│       └── ErrorBanner.tsx
│
├── hooks/
│   ├── useInvestigationStream.ts    ← THE CRITICAL HOOK — SSE stream consumer
│   └── useAppwrite.ts               ← Auth session management
│
├── api/
│   └── client.ts                    ← Typed fetch wrappers for every backend endpoint
│
├── types/
│   └── index.ts                     ← All TypeScript types (mirrors backend Pydantic schemas)
│
└── lib/
    └── utils.ts                     ← cn() for Tailwind, formatCurrency, formatDate
```

---

## Pages — What Each One Does

### `/dashboard` — DashboardPage
**What the user sees:** Number of connected databases, key metric cards (Revenue, Churn, etc.), recent investigation history with verdict badges.

**Design goal:** Clean overview. Should feel like a command center, not a settings page. Show numbers big.

**Status:** API call is wired. Just needs the backend to be running and returning data.

---

### `/investigate` — InvestigationPage ← THE MAIN PAGE
**What the user sees:**
- Top: question input box
- Left panel: streaming reasoning text (the AI "thinking out loud")
- Right panel: step cards (SQL + preview table per step), then the final report

**This is the product. Spend 60% of your time here.**

The layout when streaming should be a 2-column split:
- Left `~320px` fixed: `ReasoningPanel` — dark terminal feel, monospace, streaming text with a blinking cursor
- Right flex: step cards appear one by one as the agent works, then `FinalReport` pops in at the end with the chart

**Status:** Stub exists, wiring is partially done. Main thing to implement is the layout feel and the step-by-step reveal animation.

---

### `/quality/:connectionId` — QualityPage
**What the user sees:** A report of data problems (bad date formats, duplicates, missing values, etc.) with severity tags.

**IMPORTANT:** No "Fix" buttons. No auto-apply. This is read-only. We show problems, the customer decides what to do. If you add a fix button the BE will reject it.

**Status:** Fully stubbed, just needs styling polish.

---

### `/signals` — SignalsPage
**What the user sees:** A feed of anomalies detected by monitoring. E.g. "Revenue dropped 18% vs last week — Mumbai region."

**Status:** Simple list, stub is mostly complete.

---

### `/semantic` — SemanticPage
**What the user sees:** Every business term the AI has learned. "Revenue = SUM(order_total) excluding refunds, including shipping." Shows the source (harvested / jit_capture / dbt) and when it was learned.

**Tagline for the page:** *"DataPilot never asks the same question twice."*

**Status:** Simple list, stub is mostly complete.

---

## The Most Important Thing: The SSE Stream

The agent streams its work in real time via **Server-Sent Events (SSE)**.

The hook that handles this is `src/hooks/useInvestigationStream.ts`.

### How it works:

The backend emits two kinds of SSE events:

| Event type | Data format | What to do with it |
|-----------|-------------|-------------------|
| `reasoning` | **Plain text** — never JSON | Append to the reasoning panel text buffer. Never `JSON.parse`. |
| `step_start`, `action`, `observation`, `step_end`, `final`, `error` | **Complete JSON object** | `JSON.parse` and update the step/final state |

```
event: step_start
data: {"step": 1, "budget_remaining": 8}

event: reasoning
data: I should first check if the revenue drop is real by aggregating by week.

event: action
data: {"step":1,"type":"sql_query","sql":"SELECT ...","intent":"Aggregate weekly revenue"}

event: observation
data: {"step":1,"status":"ok","row_count":13,"columns":["wk","revenue"],"preview":[...]}

event: step_end
data: {"step": 1}

event: final
data: {"verdict":"confirmed","root_cause":"Revenue dropped 28% in week 14 — Mumbai region...","chart":{...},"data":[...]}
```

### Rules you must not break:

1. **Use `fetch` + `ReadableStream` — never `EventSource`.**
   The native `EventSource` API auto-reconnects on any dropped packet. For a streamed investigation, this restarts the whole stream from step 1, flooding the UI with duplicate steps. The hook uses `fetch` deliberately.

2. **`AbortController` lives in `useRef` — never a local variable.**
   If you store it locally, double-clicking "Ask" creates an orphan controller that can't abort the old stream. The `useRef` means both the cleanup function and the new submit handler share the same controller instance.

3. **`reasoning` is never `JSON.parse`d.**
   It's raw text. The backend intentionally makes it unstructured so it can never crash the UI.

4. **`AbortError` = silent clean exit.**
   When the user navigates away or submits a new question, the old stream is aborted. `AbortError` is caught silently — don't show an error message for it.

The hook is already implemented correctly. Don't simplify it.

---

## State Flow for an Investigation

```
User types question → clicks "Ask"
  ↓
POST /api/v1/investigations → get investigation_id back
  ↓
Call startStream(investigation_id, jwt, question)
  ↓
  fetch GET /api/v1/investigations/{id}/stream
  ↓
  reasoning events → append to ReasoningPanel
  step_start events → create new StepCard
  action events → populate StepCard with SQL + intent
  observation events → populate StepCard with result table
  step_end events → mark step complete
  final event → render FinalReport with chart + root cause
```

---

## API Client

All backend calls are in `src/api/client.ts`. Import from there — don't write raw `fetch` calls in components.

```typescript
import { startInvestigation, getDashboard, getQualityReport } from '@/api/client'

// All functions take jwt as first arg (get it from useAppwrite)
const { session } = useAppwrite()
const data = await getDashboard(session.jwt)
```

---

## Charts

Charts are rendered by `ChartRenderer.tsx` using Recharts.

The backend never sends chart data to the LLM. The LLM only emits a `ChartConfig`:
```json
{
  "chart_type": "line",
  "x_axis": "wk",
  "y_axis": "revenue",
  "series_label": "Revenue"
}
```

The `final` event also includes `data` — an array of row arrays (≤50 rows). `ChartRenderer` binds them:
- `data` → the Recharts `data` prop (converted to `{wk: "...", revenue: 184320}` objects)
- `chart.x_axis` / `chart.y_axis` → axis keys
- `chart.series_label` → legend label

The chart types you need to support: `line`, `bar`, `area`, `scatter`, `pie`. All are implemented in `ChartRenderer.tsx` already.

---

## Definition Receipts

Every investigation result includes `definition_receipts` — an array of terms the AI used with their definitions:

```json
[
  {"term": "revenue", "definition": "SUM(order_total) excl. refunds, incl. shipping", "source": "jit_capture"},
  {"term": "churn", "definition": "customers with no order in last 90 days", "source": "harvested"}
]
```

These are shown at the bottom of `FinalReport` via `DefinitionReceipt.tsx`. They build trust — the user can see exactly what assumptions were made.

The UI should make these scannable and non-intrusive. Small text, not prominent, but visible. The term should be monospace and the brand color.

---

## Auth Flow

Auth is handled by `useAppwrite.ts`. It wraps Appwrite's JS SDK.

```typescript
const { session, loading, login, logout } = useAppwrite()

// session is null if not logged in
// session.jwt is what you pass to all API calls
// session.workspaceId is the user's workspace
```

`App.tsx` already gates all routes behind auth — if `session` is null, `AuthPage` is shown instead.

For the demo, credentials will be: `demo@datapilot.ai` / `demo1234` (BE team sets this up in Appwrite).

---

## What the Backend Gives You (and When)

| What | When | Notes |
|------|------|-------|
| `/health` endpoint | Hour 0 | Already up — check `demo_db_present: true` |
| Agent stream (demo mode) | P2 complete | The full investigation stream with demo data |
| Auth (Appwrite) | P3 complete | JWT needed for all other calls |
| Quality scan | P5 complete | Real issues from demo dataset |
| Semantic definitions | P5 complete | Pre-seeded definitions |
| Dashboard summary | P5 complete | Connected sources, key metrics |
| Slack bot | P6 | Not your concern |
| Replay fixture | P7 | A JSON file they capture — tells you the stream works |

**Talk to BE when:** You want to test the stream and they haven't done P2 yet — ask them to give you the replay fixture early (a captured SSE stream saved as JSON) so you can build the UI against static data without waiting.

---

## Priority Order (what to do first)

1. **Auth works** — login with demo credentials, session persists
2. **InvestigationPage layout** — even before the stream works, get the 2-column layout right with hardcoded mock data
3. **ReasoningPanel feel** — streaming terminal effect with blinking cursor, monospace text
4. **StepCard** — SQL block + result table, appears with a subtle slide-in
5. **FinalReport** — verdict badge (confirmed = red, refuted = green, inconclusive = gray), root cause text, chart, receipts
6. **Dashboard** — numbers, recent investigations list
7. **QualityPage** — issue cards with severity colors
8. **SemanticPage** — simple list
9. **Polish** — transitions, empty states, loading states

---

## Mock Data for Testing Without Backend

While BE is finishing their work, you can test with this:

```typescript
// Paste into InvestigationPage.tsx temporarily
const MOCK_FINAL = {
  investigation_id: "test-123",
  verdict: "confirmed" as const,
  root_cause: "Revenue dropped 28% in week 14, driven entirely by a 71% drop in the Mumbai region. All other regions were flat or positive. Mumbai's decline correlates with the payment gateway outage reported on April 4–6.",
  confidence: "high" as const,
  recommended_action: "Confirm with the Mumbai ops team that the payment gateway issue is resolved. Consider a make-good offer to affected customers.",
  chart: { chart_type: "line" as const, x_axis: "wk", y_axis: "revenue", series_label: "Weekly Revenue" },
  data: [["2025-W10", 184320], ["2025-W11", 192100], ["2025-W12", 188400], ["2025-W13", 190200], ["2025-W14", 136800], ["2025-W15", 187900]],
  definition_receipts: [
    { term: "revenue", definition: "SUM(order_total) excl. refunds, incl. shipping", source: "jit_capture" }
  ]
}
```

---

## Questions to Ask the Backend Person

- What's the Appwrite Project ID? (needed in `.env`)
- What's the demo user email + password for Appwrite?
- What connection ID should I use in `InvestigationPage.tsx`? (currently hardcoded `"demo"`)
- When will the replay fixture be ready? (so I can test the stream)
- What's the production API URL when deployed to Render?

---

## Common Mistakes to Avoid

| Mistake | Why it's wrong |
|---------|---------------|
| Using `EventSource` instead of `fetch` for the stream | Auto-reconnect = duplicate steps in the UI |
| `JSON.parse`-ing the `reasoning` event | It's plain text, not JSON — will crash |
| Adding a "Fix" button on QualityPage | Product decision: read-only only, always |
| Showing `AbortError` as an error to the user | It's a clean exit, not an error |
| Moving `AbortController` out of `useRef` into local state | Double-click creates orphan streams |
| Feeding `data` (5000 rows) into the chart directly | The `preview` (≤50 rows) is what the backend sends — don't fetch more |

---

## Good References

- [Recharts docs](https://recharts.org/en-US/) — for the chart component
- [Tailwind docs](https://tailwindcss.com/docs) — for styling
- [Appwrite Web SDK](https://appwrite.io/docs/references/cloud/client-web/account) — for auth methods

---

*If something is unclear, look at the types in `src/types/index.ts` first — they mirror exactly what the backend sends. If you're still stuck, ask the backend person to show you the `api-contract.json` file at the project root — it's the full spec.*
