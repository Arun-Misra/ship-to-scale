# Niriya â€” The AI Data Team

> Connect your data, ask anything in plain English, get an autonomous analyst that investigates problems, watches your numbers 24/7, and learns your business's private language over time.

---

## Team Assignments (build order â†’ Â§12 TRD)

| Phase | Owner | What to build | Gate |
|-------|-------|---------------|------|
| **H0** | All | Freeze API contract, deploy empty app to Vercel + Render | `api-contract.json` committed; `/health` 200 in prod |
| **P1** | BE | Pydantic schemas + DuckDB SessionManager + Sandbox | Unit tests pass: schemas reject malformed, demo file opens read-only under 10 concurrent handles |
| **P2** | BE | Agent ReAct loop (validateâ†’EXPLAINâ†’sandbox, retry budget, graceful partial) | Full "why did revenue drop" run completes and emits `final` event |
| **P3** âˆ¥ | BE | Appwrite auth + connection registration + schema crawl | JWT enforced; writable role rejected |
| **P4** âˆ¥ | FE | Streaming UI: SSE client, reasoning panel, charts, definition receipts | Renders P2 captured stream correctly |
| **P5** | BE+FE | Data quality scan + semantic engine + web dashboard | Quality report shows real issues; semantic defs visible |
| **P6** | BE | Two-way Slack bot + Signals feed (pre-computed anomaly) | Bot answers in Slack; `/signals` returns anomaly |
| **P7** | All | Capture replay fixture, rehearse 5Ã— end-to-end | Full demo runs 5Ã— clean; QR works off-network |

**P3 and P4 run IN PARALLEL with P1/P2 â€” never after.**

---

## Project Structure

```
Niriya/
â”œâ”€â”€ api-contract.json          â† H0: FEâ†”BE contract, frozen at hour 0
â”œâ”€â”€ backend/                   â† FastAPI (Python) â†’ Render/Railway
â””â”€â”€ frontend/                  â† React/Vite (TypeScript) â†’ Vercel
```

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env          # fill in secrets
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env          # fill in VITE_API_URL + Appwrite config
npm install
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)
```
GEMINI_API_KEY=
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
DEMO_DB_PATH=data/demo.duckdb
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=
```

---

## Critical Engineering Rules (read before touching code)

1. **DuckDB**: Never a persistent writable `.duckdb` file under multiple workers. Demo path = `read_only=True`. Live path = `:memory:` per investigation session. See `backend/app/db/session.py`.

2. **SSE wire format**: `reasoning` events = opaque text (never `JSON.parse`). All other events = one complete JSON object per event, emitted only through `sse_struct()`. See `backend/app/agent/sse.py`.

3. **Slack**: Read raw bytes FIRST, verify HMAC signature, THEN `json.loads`. Never `await request.json()` before verification. See `backend/app/slack/signature.py`.

4. **Appwrite SDK is synchronous** â€” wrap every call in `anyio.to_thread.run_sync()`. Never `await appwrite_method()` directly. See `backend/app/appwrite/store.py`.

5. **Frontend stream**: Use `fetch` + `ReadableStream` + `AbortController` in `useRef`. Never `EventSource` (auto-reconnect breaks the stream). See `frontend/src/hooks/useInvestigationStream.ts`.

6. **Pydantic models**: All `Action` models must have `model_config = ConfigDict(extra="forbid")`. Without it, Pydantic v2 silently drops unknown fields. See `backend/app/agent/schemas.py`.

7. **Never emit dialect SQL** â€” the agent targets the semantic/metric layer. `compile(ast, dialect)` is the seam. See `backend/app/db/sandbox.py`.

---

## Deploy

- **Frontend â†’ Vercel**: connect GitHub, auto-deploy on push to `main`.
- **Backend â†’ Render**: connect GitHub, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, **single worker** (`--workers 1`).
- Deploy the empty app at **H0** (hour 0â€“1). Redeploy continuously on every push.

