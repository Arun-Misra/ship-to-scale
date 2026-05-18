# Viriya — The AI Data Team

> Connect your data, ask anything in plain English, get an autonomous analyst that investigates problems, watches your numbers 24/7, and learns your business's private language over time.

Viriya replaces the traditional data analyst's role by connecting directly to your company's live data sources to provide instant answers, deep-dive root-cause investigations, and automated data quality checks. It builds a permanent, non-portable "company brain" by learning your specific metric definitions over time.

---

## ✨ Core Features (The 4 Layers)

1. **🔌 Connect (Read-Only)**
Connects securely to Postgres, MySQL, Snowflake, Stripe, and more via OAuth or DSN. *Viriya is strictly read-only.* It never writes to, fixes, or mutates your source data.
2. **🧹 Clean (Trust Foundation)**
Performs a read-only data quality scan on a bounded in-memory sample. It flags issues like date format inconsistencies, text-as-number fields, unexpected nulls, and likely duplicates—showing you the problems without auto-fixing anything.
3. **🕵️‍♂️ Investigate (The Autonomous Agent)**
Ask plain-English questions ("Why did revenue drop?") to trigger a ReAct-style autonomous loop. Viriya plans, writes SQL, validates via `EXPLAIN`, executes in a read-only sandbox, reasons through the results, and synthesizes a narrative root-cause report with visual charts.
4. **🧠 Learn (The Semantic Moat)**
Harvests existing dbt manifests/views and captures definitions just-in-time when you ask about ambiguous metrics. Every answer carries a "definition receipt" (e.g., *Revenue = SUM(order_total) excl. refunds*).

---

## 🏗 Tech Stack

**Frontend**

* React 18 (Vite, TypeScript)
* Tailwind CSS + shadcn/ui for styling
* Recharts for data visualization
* Appwrite JS SDK for Authentication

**Backend**

* Python (FastAPI) deployed via Render/Railway
* **DuckDB:** The engine. Uses in-memory per-session connections for live DBs, and baked read-only files for demo environments.
* **Appwrite Cloud:** Auth, Workspaces, Connection Registry, and Semantic Store.
* **LLM:** Gemini 2.0 Flash (Streaming reasoning + JSON schema generation).
* **Integration:** Two-way Slack bot (Events API).

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in Appwrite, Gemini, and Slack secrets (see Environment Variables below)

pip install -r requirements.txt
# Run single-process (never use multi-workers with local DuckDB)
uvicorn app.main:app --reload --port 8000 

```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in VITE_API_URL and Appwrite config

npm install
npm run dev

```

---

## ⚙️ Environment Variables

**Backend (`backend/.env`)**

```ini
GEMINI_API_KEY=
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DB_ID=viriya_db
# Slack Config
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
# Demo Data
DEMO_DB_PATH=data/demo.duckdb

```

**Frontend (`frontend/.env`)**

```ini
VITE_API_URL=http://localhost:8000/api/v1
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=

```

---

## 📂 Project Structure

```text
viriya/
├── api-contract.json          ← The source-of-truth FE↔BE API contract
├── backend/                   
│   ├── app/
│   │   ├── agent/             ← ReAct loop, schemas, Server-Sent Events (SSE) logic
│   │   ├── api/               ← FastAPI REST/SSE endpoints
│   │   ├── appwrite/          ← Appwrite SDK wrappers (threaded)
│   │   ├── db/                ← DuckDB Session Manager & Sandbox
│   │   ├── quality/           ← Data quality scanners
│   │   ├── semantic/          ← Semantic engine & just-in-time capture
│   │   └── slack/             ← Slack webhook signature verification & bot logic
│   └── data/                  ← Baked read-only .duckdb demo files
└── frontend/                  
    ├── src/
    │   ├── api/               ← Typed fetch wrappers
    │   ├── components/        ← UI (ReasoningPanel, StepCard, FinalReport, etc.)
    │   ├── hooks/             ← useInvestigationStream.ts, useAppwrite.ts
    │   └── pages/             ← Routing (Investigate, Dashboard, Quality, Semantic)
    └── package.json           

```

---

## 🛑 Critical Engineering Rules (Non-Negotiable)

Read these before contributing. They prevent catastrophic failures in concurrency, UI rendering, and external integrations.

1. **DuckDB Concurrency:** **Never** open a persistent `.duckdb` file with write access under multiple workers.
* *Demo path:* Open files explicitly with `read_only=True`.
* *Live path:* Use `:memory:` per investigation session and `ATTACH ... READ_ONLY`.


2. **The SSE Wire Format:** The investigation streaming API prevents UI crashes by splitting the stream.
* `reasoning` events are raw, opaque text (streamed tokens). **Never** `JSON.parse` them on the frontend.
* `action`, `observation`, `step_end`, `final` events are fully-formed, rigid JSON objects. The backend only emits them once fully constructed.


3. **Frontend Stream Consumption:** The React frontend **must** use `fetch` + `ReadableStream` + `AbortController` stored in a `useRef`. **Never use `EventSource**`, as its auto-reconnect behavior duplicates the stream.
4. **Appwrite SDK Blocking:** The official Python Appwrite SDK is synchronous. Wrap **every** call in `anyio.to_thread.run_sync()` in the backend so it doesn't block the ASGI event loop and freeze SSE streams.
5. **Slack Webhook Verification:** When receiving Slack events, verify the HMAC signature against the **raw byte payload** first. Never call `await request.json()` before verification, as middleware mutates the bytes and breaks the hash.
6. **LLM Structured Output:** Gemini 2.0 Flash must be forced to output raw JSON without markdown formatting (````json` fences). Use Pydantic's `model_config = ConfigDict(extra="forbid")` to rigorously enforce schema bounds and fail safely.

---

## 🚢 Deployment

* **Frontend:** Deploy to **Vercel**. Connect GitHub, auto-deploys on push to `main`.
* **Backend:** Deploy to **Render** or **Railway**. Run as a single worker (`uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`).
