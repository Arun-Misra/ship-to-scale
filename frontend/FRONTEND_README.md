# Niriya â€” Frontend Guide

> Everything you need to build a world-class frontend for Niriya.
> Read this fully before touching any code.

---

## What is Niriya?

Niriya is **"The AI Data Team"** â€” it replaces a company's data analyst.

A user connects their database, asks a question in plain English like *"Why did revenue drop last week?"*, and Niriya:
1. **Thinks step by step** (streamed live, like watching an analyst work)
2. **Writes and runs SQL** against their data
3. **Produces a root-cause report** with a chart and confidence level
4. **Defines what "revenue" means** in their company and never forgets it

The **frontend is the product**. The streaming reasoning panel â€” watching the AI think in real time â€” is the single biggest differentiator. Make it feel alive.

---

## The Vibe / Design Direction

**Dark, data-forward, trustworthy.** Think Linear + Vercel dashboard + Notion AI sidebar.

- Dark background (`gray-950` base)
- Accent color: `sky-500` / `brand-500` â€” used sparingly for active states, CTAs, streaming indicators
- Monospace font for SQL, reasoning text, metric values
- Clean cards with `gray-900` bg + `gray-800` borders
- No gradients, no heavy animations â€” subtle transitions only
- The reasoning panel should feel like a terminal / live feed, not a chat bubble

**The kill-shot moment:** When a user asks "Why did revenue drop?" â€” the left panel lights up with the AI's thought process streaming in real time, steps appear on the right one by one, and 25 seconds later a chart pops up with a root cause. **This moment has to feel magical.** Prioritize this above everything else.

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
VITE_APPWRITE_PROJECT_ID=                   # get from BE person â€” they set up Appwrite
```

---

## File Structure

```
src/
â”œâ”€â”€ App.tsx                          â† Router + auth gate
â”œâ”€â”€ main.tsx                         â† Vite entry
â”œâ”€â”€ index.css                        â† Tailwind base styles
â”‚
â”œâ”€â”€ pages/                           â† One file per route
â”‚   â”œâ”€â”€ AuthPage.tsx                 â† Login screen
â”‚   â”œâ”€â”€ DashboardPage.tsx            â† Connected sources + key metrics + recent investigations
â”‚   â”œâ”€â”€ InvestigationPage.tsx        â† THE MAIN PAGE â€” chat + streaming agent
â”‚   â”œâ”€â”€ QualityPage.tsx              â† Data quality scan report (read-only, no fix buttons)
â”‚   â”œâ”€â”€ SignalsPage.tsx              â† Anomaly alerts feed
â”‚   â””â”€â”€ SemanticPage.tsx             â† Company "brain" â€” definitions the AI has learned
â”‚
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ layout/
â”‚   â”‚   â””â”€â”€ Sidebar.tsx              â† Nav sidebar
â”‚   â”œâ”€â”€ investigation/               â† THE MOST IMPORTANT COMPONENTS
â”‚   â”‚   â”œâ”€â”€ ChatInput.tsx            â† Question input box
â”‚   â”‚   â”œâ”€â”€ ReasoningPanel.tsx       â† Left panel â€” streaming AI thought process
â”‚   â”‚   â”œâ”€â”€ StepCard.tsx             â† Each agent step (SQL + result table)
â”‚   â”‚   â”œâ”€â”€ FinalReport.tsx          â† Root cause report + chart + definitions
â”‚   â”‚   â”œâ”€â”€ ChartRenderer.tsx        â† Recharts chart (binds ChartConfig + data)
â”‚   â”‚   â””â”€â”€ DefinitionReceipt.tsx    â† "Revenue = SUM(order_total) excl. refunds"
â”‚   â”œâ”€â”€ quality/
â”‚   â”‚   â”œâ”€â”€ QualityReport.tsx        â† List of issues with severity summary
â”‚   â”‚   â””â”€â”€ IssueCard.tsx            â† Individual issue card
â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â”œâ”€â”€ SourceCard.tsx           â† Connected sources count
â”‚   â”‚   â””â”€â”€ MetricSnapshot.tsx       â† Key metric card
â”‚   â””â”€â”€ shared/
â”‚       â”œâ”€â”€ LoadingSpinner.tsx
â”‚       â””â”€â”€ ErrorBanner.tsx
â”‚
â”œâ”€â”€ hooks/
â”‚   â”œâ”€â”€ useInvestigationStream.ts    â† THE CRITICAL HOOK â€” SSE stream consumer
â”‚   â””â”€â”€ useAppwrite.ts               â† Auth session management
â”‚
â”œâ”€â”€ api/
â”‚   â””â”€â”€ client.ts                    â† Typed fetch wrappers for every backend endpoint
â”‚
â”œâ”€â”€ types/
â”‚   â””â”€â”€ index.ts                     â† All TypeScript types (mirrors backend Pydantic schemas)
â”‚
â””â”€â”€ lib/
    â””â”€â”€ utils.ts                     â† cn() for Tailwind, formatCurrency, formatDate
```

---

## Pages â€” What Each One Does

### `/dashboard` â€” DashboardPage
**What the user sees:** Number of connected databases, key metric cards (Revenue, Churn, etc.), recent investigation history with verdict badges.

**Design goal:** Clean overview. Should feel like a command center, not a settings page. Show numbers big.

**Status:** API call is wired. Just needs the backend to be running and returning data.

---

### `/investigate` â€” InvestigationPage â† THE MAIN PAGE
**What the user sees:**
- Top: question input box
- Left panel: streaming reasoning text (the AI "thinking out loud")
- Right panel: step cards (SQL + preview table per step), then the final report

**This is the product. Spend 60% of your time here.**

The layout when streaming should be a 2-column split:
- Left `~320px` fixed: `ReasoningPanel` â€” dark terminal feel, monospace, streaming text with a blinking cursor
- Right flex: step cards appear one by one as the agent works, then `FinalReport` pops in at the end with the chart

**Status:** Stub exists, wiring is partially done. Main thing to implement is the layout feel and the step-by-step reveal animation.

---

### `/quality/:connectionId` â€” QualityPage
**What the user sees:** A report of data problems (bad date formats, duplicates, missing values, etc.) with severity tags.

**IMPORTANT:** No "Fix" buttons. No auto-apply. This is read-only. We show problems, the customer decides what to do. If you add a fix button the BE will reject it.

**Status:** Fully stubbed, just needs styling polish.

---

### `/signals` â€” SignalsPage
**What the user sees:** A feed of anomalies detected by monitoring. E.g. "Revenue dropped 18% vs last week â€” Mumbai region."

**Status:** Simple list, stub is mostly complete.

---

### `/semantic` â€” SemanticPage
**What the user sees:** Every business term the AI has learned. "Revenue = SUM(order_total) excluding refunds, including shipping." Shows the source (harvested / jit_capture / dbt) and when it was learned.

**Tagline for the page:** *"Niriya never asks the same question twice."*

**Status:** Simple list, stub is mostly complete.

---

## The Most Important Thing: The SSE Stream

The agent streams its work in real time via **Server-Sent Events (SSE)**.

The hook that handles this is `src/hooks/useInvestigationStream.ts`.

### How it works:

The backend emits two kinds of SSE events:

| Event type | Data format | What to do with it |
|-----------|-------------|-------------------|
| `reasoning` | **Plain text** â€” never JSON | Append to the reasoning panel text buffer. Never `JSON.parse`. |
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
data: {"verdict":"confirmed","root_cause":"Revenue dropped 28% in week 14 â€” Mumbai region...","chart":{...},"data":[...]}
```

### Rules you must not break:

1. **Use `fetch` + `ReadableStream` â€” never `EventSource`.**
   The native `EventSource` API auto-reconnects on any dropped packet. For a streamed investigation, this restarts the whole stream from step 1, flooding the UI with duplicate steps. The hook uses `fetch` deliberately.

2. **`AbortController` lives in `useRef` â€” never a local variable.**
   If you store it locally, double-clicking "Ask" creates an orphan controller that can't abort the old stream. The `useRef` means both the cleanup function and the new submit handler share the same controller instance.

3. **`reasoning` is never `JSON.parse`d.**
   It's raw text. The backend intentionally makes it unstructured so it can never crash the UI.

4. **`AbortError` = silent clean exit.**
   When the user navigates away or submits a new question, the old stream is aborted. `AbortError` is caught silently â€” don't show an error message for it.

The hook is already implemented correctly. Don't simplify it.

---

## State Flow for an Investigation

```
User types question â†’ clicks "Ask"
  â†“
POST /api/v1/investigations â†’ get investigation_id back
  â†“
Call startStream(investigation_id, jwt, question)
  â†“
  fetch GET /api/v1/investigations/{id}/stream
  â†“
  reasoning events â†’ append to ReasoningPanel
  step_start events â†’ create new StepCard
  action events â†’ populate StepCard with SQL + intent
  observation events â†’ populate StepCard with result table
  step_end events â†’ mark step complete
  final event â†’ render FinalReport with chart + root cause
```

---

## API Client

All backend calls are in `src/api/client.ts`. Import from there â€” don't write raw `fetch` calls in components.

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

The `final` event also includes `data` â€” an array of row arrays (â‰¤50 rows). `ChartRenderer` binds them:
- `data` â†’ the Recharts `data` prop (converted to `{wk: "...", revenue: 184320}` objects)
- `chart.x_axis` / `chart.y_axis` â†’ axis keys
- `chart.series_label` â†’ legend label

The chart types you need to support: `line`, `bar`, `area`, `scatter`, `pie`. All are implemented in `ChartRenderer.tsx` already.

---

## Definition Receipts

Every investigation result includes `definition_receipts` â€” an array of terms the AI used with their definitions:

```json
[
  {"term": "revenue", "definition": "SUM(order_total) excl. refunds, incl. shipping", "source": "jit_capture"},
  {"term": "churn", "definition": "customers with no order in last 90 days", "source": "harvested"}
]
```

These are shown at the bottom of `FinalReport` via `DefinitionReceipt.tsx`. They build trust â€” the user can see exactly what assumptions were made.

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

`App.tsx` already gates all routes behind auth â€” if `session` is null, `AuthPage` is shown instead.

For the demo, credentials will be: `demo@Niriya.ai` / `demo1234` (BE team sets this up in Appwrite).

---

## What the Backend Gives You (and When)

| What | When | Notes |
|------|------|-------|
| `/health` endpoint | Hour 0 | Already up â€” check `demo_db_present: true` |
| Agent stream (demo mode) | P2 complete | The full investigation stream with demo data |
| Auth (Appwrite) | P3 complete | JWT needed for all other calls |
| Quality scan | P5 complete | Real issues from demo dataset |
| Semantic definitions | P5 complete | Pre-seeded definitions |
| Dashboard summary | P5 complete | Connected sources, key metrics |
| Slack bot | P6 | Not your concern |
| Replay fixture | P7 | A JSON file they capture â€” tells you the stream works |

**Talk to BE when:** You want to test the stream and they haven't done P2 yet â€” ask them to give you the replay fixture early (a captured SSE stream saved as JSON) so you can build the UI against static data without waiting.

---

## Priority Order (what to do first)

1. **Auth works** â€” login with demo credentials, session persists
2. **InvestigationPage layout** â€” even before the stream works, get the 2-column layout right with hardcoded mock data
3. **ReasoningPanel feel** â€” streaming terminal effect with blinking cursor, monospace text
4. **StepCard** â€” SQL block + result table, appears with a subtle slide-in
5. **FinalReport** â€” verdict badge (confirmed = red, refuted = green, inconclusive = gray), root cause text, chart, receipts
6. **Dashboard** â€” numbers, recent investigations list
7. **QualityPage** â€” issue cards with severity colors
8. **SemanticPage** â€” simple list
9. **Polish** â€” transitions, empty states, loading states

---

## Mock Data for Testing Without Backend

While BE is finishing their work, you can test with this:

```typescript
// Paste into InvestigationPage.tsx temporarily
const MOCK_FINAL = {
  investigation_id: "test-123",
  verdict: "confirmed" as const,
  root_cause: "Revenue dropped 28% in week 14, driven entirely by a 71% drop in the Mumbai region. All other regions were flat or positive. Mumbai's decline correlates with the payment gateway outage reported on April 4â€“6.",
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
| `JSON.parse`-ing the `reasoning` event | It's plain text, not JSON â€” will crash |
| Adding a "Fix" button on QualityPage | Product decision: read-only only, always |
| Showing `AbortError` as an error to the user | It's a clean exit, not an error |
| Moving `AbortController` out of `useRef` into local state | Double-click creates orphan streams |
| Feeding `data` (5000 rows) into the chart directly | The `preview` (â‰¤50 rows) is what the backend sends â€” don't fetch more |

---

## Good References

- [Recharts docs](https://recharts.org/en-US/) â€” for the chart component
- [Tailwind docs](https://tailwindcss.com/docs) â€” for styling
- [Appwrite Web SDK](https://appwrite.io/docs/references/cloud/client-web/account) â€” for auth methods

---

*If something is unclear, look at the types in `src/types/index.ts` first â€” they mirror exactly what the backend sends. If you're still stuck, ask the backend person to show you the `api-contract.json` file at the project root â€” it's the full spec.*

