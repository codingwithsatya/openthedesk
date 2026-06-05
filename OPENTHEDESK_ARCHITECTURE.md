# OpenTheDesk — Architecture & Engineering Reference
**Last updated: June 5, 2026 — evening session**

This document is the single source of truth for OpenTheDesk. Any Claude session working on this project must read this before touching any code.

---

## What Is OpenTheDesk

OpenTheDesk is a live trading intelligence platform built for Satya Pramod. It is a full-stack AI application purpose-built around the **Saty Mahajan trading system** for 0DTE SPX/SPXW options trading.

The name comes from the session trigger phrase: "Open the Desk" — spoken at the start of every trading session.

**It is not a generic trading app.** Every feature is built around Satya's specific trading rules, playbook setups, account parameters, and risk management protocols.

**Human-in-the-loop always.** The system analyzes and presents. Satya approves or rejects. Nothing executes autonomously.

---

## What's Live Today

| Feature | Status |
|---------|--------|
| 0DTE Desk — chat, all commands, PREMARKET, chart vision | ✅ Live |
| Analyzer — real options chain, greeks, dual Claude verdicts | ✅ Live |
| Screener — 15 tickers parallel, ribbon filter | ✅ Live |
| Auth (Clerk), observability (LangSmith) | ✅ Live |
| Reliability — retry backoff, keep-alive, timeouts | ✅ Live |
| TradingView webhook — unified /webhook/tv handles all 3 feeds | ✅ Live |
| Alert cards — colored by setup/direction, trade plan, internals row | ✅ Live |
| Trade Plan card — Pine-computed T1/T2/T3/SL from Manual Planner | ✅ Live |
| Internals snapshot — TRIN/ADD/VOLD attached to every trade alert | ✅ Live |
| Internals heartbeat — USI:TRIN/ADD/VOLD/PCC via TV every 3m | ✅ Live |
| Manual Planner v3.3.6 — Full Saty Runner Manager | ✅ Live |
| ATR Levels v3.1 Clean Extended — full Saty ladder, Day/Multiday mode | ✅ Live |
| OTD Internals Heartbeat v2.2 — market internals data feed | ✅ Live |
| Internals live widget — TRIN/ADD/VOLD/PCC/bias sidebar widget | ✅ Live |
| Multi-chart upload + drag-drop + paste from clipboard | ✅ Live |
| Chart context selector (TRADE IDEA / IN TRADE / PREMARKET / PTR-FAST) | ✅ Live |
| Live data injection for trade commands | ✅ Live |
| Dynamic max_tokens — long commands 4096, fast commands 2048 | ✅ Live |
| Market internals rule — context not gate (never blocks trades) | ✅ Live |
| Target levels rule — flags when within 1pt of T1/T2/T3 | ✅ Live |
| Unusual Whales — manual text input v1 | ✅ Live |
| Journal UI — /journal page with 3 charts, trade table | ✅ Built (in-memory) |
| Journal persistence — Supabase trade_journal | ✅ Live |
| Alert persistence — Supabase tv_alerts | ✅ Live |
| Session persistence — Supabase user_sessions | ✅ Live |
| Clerk JWT middleware — user_id from verified token | ✅ Live |
| Chat → journal entry (natural language logging) | ✅ Live |
| Agent (LangGraph, tool use, morning brief) | 🔲 Planned |
| Unusual Whales API v2 — auto-fetch live flow data | 🔲 Planned |
| RAG knowledge base — Voyage AI + pgvector for Saty playbook | 🔲 Planned |
| Earnings scanner | 🔲 Planned |
| Mobile push notifications | 🔲 Planned |

---

## Repository

```
GitHub: github.com/codingwithsatya/openthedesk
Branch: main (auto-deploys to Railway + Vercel on push)
```

### Folder structure
```
openthedesk/
├── main.py              # FastAPI backend — all endpoints
├── analyzer.py          # Ticker analysis engine (EMAs, ATR, options chain)
├── tradier.py           # Tradier API integration (SPX quotes, 0DTE chain)
├── market_data.py       # SPX market summary + ATR-14 Wilder calculation
├── context.py           # Google Doc fetcher — live trading rules
├── requirements.txt     # Python dependencies
├── nixpacks.toml        # Railway deployment config
├── .env                 # API keys (never commit)
├── pine/
│   ├── openthedesk_manual_planner.pine    # Manual Planner v3.3.6 (Full Saty Runner Manager)
│   ├── openthedesk_atr_clean.pine         # ATR Levels v3.1 Clean Extended (full ladder)
│   └── otd_internals_heartbeat.pine       # OTD Internals Heartbeat v2.2
└── ui/
    ├── src/app/
    │   ├── page.tsx              # 0DTE Desk
    │   ├── analyzer/page.tsx     # Analyzer (/analyzer)
    │   ├── journal/page.tsx      # Journal (/journal)
    │   ├── layout.tsx            # ClerkProvider + auth
    │   └── globals.css           # Design tokens + shared styles
    └── src/app/components/
        ├── Header.tsx            # Nav + bell icon + alert drawer
        ├── AlertPanel.tsx        # useAlerts hook + AlertDrawer (SSE) + TradePlan card
        ├── InternalsWidget.tsx   # Live internals widget — polls /internals every 30s
        ├── LevelsPanel.tsx       # ATR levels + 0DTE options sidebar (mounts InternalsWidget)
        ├── ChatPanel.tsx         # Main chat interface
        ├── CommandPalette.tsx    # / commands modal
        ├── QuickActions.tsx      # Quick action buttons
        └── MobileSheet.tsx       # Mobile bottom sheet for levels
```

---

## Infrastructure

| Service | Platform | URL / Notes |
|---------|----------|-------------|
| Frontend | Vercel | https://openthedesk.vercel.app |
| Backend | Railway | https://openthedesk-production.up.railway.app |
| Auth | Clerk | Google sign-in, single user (Satya) |
| LLM | Anthropic API | claude-sonnet-4-6 + claude-haiku-4-5-20251001 |
| Market data | Tradier | api.tradier.com/v1 (production brokerage) |
| Fundamentals | yfinance | India stocks + supplemental |
| Trading rules | Google Doc | Fetched via context.py on startup |
| Observability | LangSmith | wrap_anthropic() at startup |
| Database | Supabase | https://xxxx.supabase.co — live, 3 tables |

### Environment variables — backend (Railway + .env)
```
ANTHROPIC_API_KEY=
TRADIER_TOKEN=           # Production brokerage token (Level 6 options)
CLERK_SECRET_KEY=
LANGSMITH_API_KEY=       # Optional — LangSmith tracing
GOOGLE_DOC_URL=          # Public Google Doc with live trading rules
TV_WEBHOOK_SECRET=       # TradingView webhook auth secret — ROTATE BEFORE LIVE
SUPABASE_URL=            # Live — Supabase project URL
SUPABASE_SERVICE_KEY=    # Live — service role key (bypasses RLS, backend only)
CLERK_JWT_ISSUER=        # Live — https://ready-elephant-42.clerk.accounts.dev
PORT=8000                # Railway sets automatically
```

### Environment variables — frontend (Vercel)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=     # Railway backend URL
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL (safe for frontend)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (safe for frontend, RLS enforced)
```

---

## Backend — main.py

### Pydantic models (remaining)
```python
ChatRequest:          message, session_id, atr (optional)
RefreshRequest:       session_id
AnalyzeRequest:       ticker, trading_mode (day|multiday|swing|position)
JournalEntryPayload:  date, ticker, setup, direction,
                      entry_price, exit_price, contracts,
                      pnl (optional), grade, process_grade, notes (optional)
```

Note: TVAlertPayload and InternalsPayload Pydantic models were REMOVED.
/webhook/tv now uses raw Request body parsing — handles any TV payload format.

### Global state
```python
INTERNALS_CACHE: dict   # Latest internals snapshot from TV heartbeat (in-memory, intentional)
TV_ALERTS: list[dict]   # In-memory cache only — source of truth is Supabase tv_alerts
FLOW_CONTEXT: str        # Latest unusual flow — injected into /chat
LIVE_CONTEXT: str        # Google Doc content — loaded at startup
sessions: dict           # In-memory fallback only — source of truth is Supabase user_sessions
```

### Supabase client
```python
from supabase import create_client, Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
# Service role key — bypasses RLS for all backend writes
# Initialized at startup with graceful fallback to in-memory if env vars missing
```

### Clerk JWT middleware
```python
async def get_current_user(authorization: str = Header(...)) -> str:
    token = authorization.replace("Bearer ", "")
    payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["RS256"])
    user_id = payload.get("sub")  # Clerk user ID — always from token, never request body
    return user_id

# Applied to: /chat, /refresh-context, DELETE /session,
#             /journal/entry, /journal/entries, /journal/stats
# NOT applied to: /webhook/tv (TradingView has no user context)
```

### Model routing
```python
SONNET = "claude-sonnet-4-6"
HAIKU  = "claude-haiku-4-5-20251001"

_HAIKU_COMMANDS = {
    "PTR-FAST", "PTR-FULL", "GRADE", "PATTERN CHECK",
    "MARKET REGIME", "CAPITAL PROTECTION", "WIRE OUT",
    "TRADE REVIEW", "EOD"
}
# Everything else → Sonnet
```

### All endpoints

#### GET /health
`{"status": "ok", "context_loaded": bool}`

#### GET /ping
Keep-alive. Called by `_keep_alive()` every 10min on weekdays 9am–4pm ET.

#### POST /chat
Multi-turn conversation. Sessions stored in memory.
- Injects LIVE_CONTEXT + FLOW_CONTEXT into system prompt
- Routes to Haiku or Sonnet per command
- Returns: `{reply, model, session_id, turns}`

#### POST /analyze-chart
Vision endpoint — image upload → chart analysis. Streams response.

#### GET /market-data
Live SPX + VIX + ATR levels + 0DTE options + unusual flow.

#### POST /premarket
PREMARKET command with live data injected. Streams Sonnet response.

#### POST /refresh-context
Fresh Google Doc fetch + clear session history.

#### DELETE /session/{session_id}
Clears conversation history.

#### POST /analyze
Dual Claude verdict on any ticker.
- Haiku (short-term options) + Sonnet (long-term stock) in parallel
- **max_tokens: Haiku=2048, Sonnet=1536 — do not lower**

#### GET /screener
15 tickers parallel, MIXED ribbon filtered, sorted by |change_pct|.

#### POST /webhook/tv  ← REFACTORED June 2
Unified webhook — handles all three TradingView feeds.
- Auth: X-TV-Secret header OR secret body field (raw Request, no Pydantic)
- Routes on `type=="internals"` or `signal=="INTERNALS"` → _handle_internals()
- All other payloads → _handle_trade_alert()

**_handle_internals(data):**
- Updates INTERNALS_CACHE with trin/add/vold/pcc/**bias** + received_at + source
- Does NOT broadcast to SSE — cache only, no alert drawer card
- Does NOT insert into TV_ALERTS list
- Returns: `{"status": "ok", "cached": INTERNALS_CACHE}`

**_handle_trade_alert(data):**
- Accepts Manual Planner v3.3.2 and ATR Clean backup payloads
- Uses Pine-computed entry/t1/t2/t3/sl/trail_sl directly — no backend recalculation
- Attaches INTERNALS_CACHE snapshot + internals_age_seconds to every alert
- Generates trade_plan ONLY for signal=ENTRY + direction in (BULL, BEAR)
- ATR_TARGET and ATR_STOP setups never generate trade_plan
- Inserts into TV_ALERTS (max 50), broadcasts to SSE subscribers
- Returns: `{"status": "received", "id": uuid}`

**Alert object stored fields:**
```python
{
    "id": uuid,
    "ts": ISO timestamp,
    "ticker": str,
    "timeframe": str,
    "condition": str,          # e.g. "VOMY BEAR", "T1 HIT", "REVERSAL EXIT", "RUNNER AFTER T3"
    "price": str,
    "signal": str,             # ENTRY / TARGET / TRAIL / STOP / EXIT
    "display_type": str|None,  # "entry" | "update" | "stop" | null — frontend card accent hint
    "setup": str,              # GG / VOMY / FLAG_INTO_RIBBON / BT / ORB_RETEST / ATR_TARGET / ATR_STOP
    "grade": str,              # A+ / A
    "direction": str,          # BULL / BEAR
    "atr_level": str,
    "entry": float,            # Pine-computed
    "t1": float,               # Pine-computed
    "t2": float,               # Pine-computed
    "t3": float,               # Pine-computed
    "sl": float,               # Pine-computed
    "trail_sl": float,         # Pine-computed — updates on TRAIL signals
    "internals": dict | None,  # INTERNALS_CACHE snapshot at alert time
    "internals_age_seconds": int | None,
    "trade_plan": dict | None  # Only on ENTRY alerts
}
```

**trade_plan dict (ENTRY only):**
```python
{
    "entry": float,
    "direction": str,
    "t1": float, "t1_pts": float, "t1_label": "GG Open — Scale 50%",
    "t2": float, "t2_pts": float, "t2_label": "GG Complete — Scale 25%",
    "t3": float, "t3_pts": float, "t3_label": "Full Extension — Exit All",
    "sl": float, "sl_pts": float,
    "trail_sl": float
}
```

#### GET /alerts
Stored TV_ALERTS. `?limit=` param (max 50).

#### GET /alerts/stream
SSE — instant push on trade alerts. 1s heartbeat ping.
Internals updates do NOT appear here (cache only).

#### GET /internals
Returns current INTERNALS_CACHE.

#### POST /journal/entry
Creates journal entry. Auto-calculates P&L if missing.

#### GET /journal/entries
Returns JOURNAL_ENTRIES list.

#### GET /journal/stats
Win rate, avg winner/loser, P&L by setup, equity curve.

---

## TradingView Pine Scripts — 3 Scripts

### Architecture decision
- **Manual Planner v3.3.2** = source of truth for trade signals
- **ATR Clean v3** = levels and context only
- **Internals Heartbeat v2.2** = market internals data feed only

Do not let ATR Clean or Internals Heartbeat create new trade ideas.

---

### 1. Manual Planner v3.3.2 — Main alert source

**File:** `pine/openthedesk_manual_planner.pine`

**TradingView alert setup:**
- Condition: `OpenTheDesk Manual Planner v3.3.2`
- Alert type: `Any alert() function call`
- Webhook: ON — `https://openthedesk-production.up.railway.app/webhook/tv`
- Message: blank (Pine generates JSON dynamically)
- Frequency: handled by `alert.freq_once_per_bar_close`

**Setups detected:**
- GG BULL / GG BEAR — 38.2% GG Open toward 61.8% GG Complete
- FLAG INTO RIBBON BULL / BEAR — pullback into 13/21 EMA zone
- iVOMY BULL — bearish ribbon transitions bullish, price reclaims ribbon, hold confirms
- VOMY BEAR — bullish ribbon transitions bearish, price loses ribbon, rejection confirms
- BT BULL / BEAR — call/put trigger backtest
- ORB RETEST BULL / BEAR — 10m opening range break + retest

**Signals sent:**
- ENTRY — new setup with full trade plan
- TARGET — T1 HIT, T2 HIT, T3 HIT
- TRAIL — trailing SL updated; condition examples: "TRAILING SL UPDATED", "RUNNER AFTER T3"
- STOP — stop hit; condition: "STOP HIT"
- EXIT — bias invalidated or reversal exit; condition: "REVERSAL EXIT"

**Example ENTRY payload:**
```json
{
  "ticker": "SPX",
  "timeframe": "3",
  "condition": "VOMY BEAR",
  "price": "7599.50",
  "entry": "7599.50",
  "t1": "7563.81",
  "t2": "7553.76",
  "t3": "7545.64",
  "sl": "7608.25",
  "trail_sl": "7585.52",
  "atr_level": "put_trigger",
  "setup": "VOMY",
  "grade": "A+",
  "direction": "BEAR",
  "signal": "ENTRY",
  "secret": "..."
}
```

**Secret:** entered as Pine Script input `tvSecret` — never hardcoded.

---

### 2. ATR Levels v3 Clean — Levels only

**File:** `pine/openthedesk_atr_clean.pine`

**Purpose:** ATR level lines, right-side labels, info table. No setup shapes.

**Live settings:**
- Show Target/Stop Shapes: OFF
- Enable ATR Target/Stop Alerts: OFF
- Show Right-Side Level Labels: ON
- Show Info Table: ON

**Optional backup alertconditions (OFF by default):**
- 🎯 OTD ATR T1/T2/T3 [3m] — setup=ATR_TARGET, signal=TARGET
- ⚠️ OTD ATR STOP [3m] — setup=ATR_STOP, signal=STOP

Backend treats ATR_TARGET and ATR_STOP as backup context — never generates trade_plan.

---

### 3. OTD Internals Heartbeat v2.2 — Market context

**File:** `pine/otd_internals_heartbeat.pine`

**TradingView alert setup:**
- Condition: `OTD Internals Heartbeat v2.2`
- Alert type: `Any alert() function call`
- Webhook: ON — `https://openthedesk-production.up.railway.app/webhook/tv`
- Message: blank (Pine generates JSON)

**Symbols:** USI:TRIN · USI:ADD · USI:VOLD · USI:PCC

**Payload:**
```json
{
  "type": "internals",
  "signal": "INTERNALS",
  "ticker": "SPX",
  "timeframe": "3",
  "trin": 0.82,
  "add": 1200,
  "vold": 150000000,
  "pcc": 0.72,
  "bias": "BULLISH",
  "secret": "..."
}
```

**Backend behavior:**
- Updates INTERNALS_CACHE silently — no alert card, no SSE broadcast
- Stores trin/add/vold/pcc/**bias**/received_at/source
- Internals attach to next trade alert automatically via snapshot

**Secret:** entered as Pine Script input `tvSecret`.

---

## Alert Card System (AlertPanel.tsx)

### TVAlert interface
```typescript
interface TVAlert {
  id: string;
  ts: string;
  ticker: string;
  timeframe: string;
  condition: string;
  price: string;
  atr_level: string;
  setup?: string;
  grade?: string;
  direction?: string;
  signal?: string;          // ENTRY / TARGET / TRAIL / STOP / EXIT
  display_type?: string | null; // "entry" | "update" | "stop" | null — card accent hint
  type?: string;            // "internals" — filtered out of drawer
  trail_sl?: number | null;
  internals?: {
    trin: number | null;
    add: number | null;
    vold: number | null;
    pcc: number | null;
    received_at: string;
    source?: string;
  } | null;
  internals_age_seconds?: number | null;
  trade_plan?: {
    entry: number;
    direction: string;
    t1: number | null; t1_pts: number | null; t1_label: string;
    t2: number | null; t2_pts: number | null; t2_label: string;
    t3: number | null; t3_pts: number | null; t3_label: string;
    sl: number; sl_pts: number; trail_sl?: number | null;
  };
}
```

### SSE guard (critical)
```typescript
es.onmessage = (e) => {
  if (e.data === "ping") return;
  try {
    const alert: TVAlert = JSON.parse(e.data);
    if (alert.type === "internals") return;  // filter internals from drawer
    setAlerts(prev => {
      if (prev.some(a => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  } catch {}
};
```

### Visual rules
```
Accent bar: 4px alignSelf:stretch
  BEAR/STOP → #ef4444  |  BULL → #22c55e  |  TARGET → #475569  |  Other → #334155

Setup badge:
  BEAR: bg #3d0f0f · text #f87171 · border #7f1d1d
  BULL: bg #0f2d1a · text #4ade80 · border #14532d
  Other: bg #1e293b · text #94a3b8 · border #334155

Grade: A+ → blue  |  A → transparent/gray

Trade Plan (unread ENTRY alerts only):
  ENTRY gray | T1/T2 green | T3 yellow | SL red | points shown

Internals row (unread alerts with internals snapshot):
  TRIN: <1.0 green | >1.2 red | else gray
  ADD: >+200 green | <-200 red | else gray
  VOLD: positive green | negative red (shown in billions e.g. +0.15B)
  Age: right-aligned, "Xs ago" or "Xm ago"

Unread: full card + tinted bg + trade plan + internals
Read: compact single line

display_type → card accent mapping (when frontend consumes it):
  "stop"  → red border (#ef4444) — REVERSAL EXIT, STOP HIT
  "entry" → bull/bear color per direction — ENTRY signals
  "update"→ gray — TRAIL, TARGET signals
  null    → default gray
```

---

## InternalsWidget (InternalsWidget.tsx)

Self-polling sidebar widget — always visible in LevelsPanel above ATR levels.

```
Poll: GET /internals every 30s
Age tick: every 10s (no extra fetch)

States:
  No data / age >5m  → "Internals Offline" (gray dot)
  Age 3–5m           → amber border warning (missed heartbeat)
  Live               → dark card with TRIN / ADD / VOLD / PCC + bias badge

Color rules (match AlertPanel.tsx internals row):
  TRIN: <1.0 → green | >1.2 → red | else → gray
  ADD:  >+200 → green | <-200 → red | else → gray
  VOLD: >0 → green | <0 → red (shown as ±X.XXB, value/1e9)
  PCC:  <0.80 → green | >1.20 → red | else → gray

Bias badge:
  BULLISH → green (#4ade80) on dark green bg
  BEARISH → red (#f87171) on dark red bg
  MIXED   → amber (#fbbf24) on dark amber bg
  null    → not shown
```

---

## Database — Supabase

### Connection
- Backend uses `service_role` key — bypasses RLS, full access
- Frontend uses `anon` key — RLS enforced, users see only their own rows
- Clerk JWT `sub` claim = `user_id` in all per-user tables

### Table: trade_journal (per-user, RLS)
```sql
create table trade_journal (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  created_at    timestamptz not null default now(),
  date          date not null,
  ticker        text not null default 'SPX',
  setup         text not null,
  direction     text not null,
  entry_price   numeric not null,
  exit_price    numeric not null,
  contracts     int not null default 1,
  pnl           numeric,
  grade         text not null default 'A',
  process_grade text not null default 'A',
  notes         text,
  internals     jsonb
);
create index trade_journal_user_idx on trade_journal (user_id, created_at desc);
alter table trade_journal enable row level security;
create policy "user owns journal" on trade_journal
  for all using (auth.jwt() ->> 'sub' = user_id);
```

### Table: tv_alerts (global, no RLS)
```sql
create table tv_alerts (
  id                    bigserial primary key,
  alert_id              text unique not null,  -- Pine UUID, dedup key
  ts                    timestamptz not null,
  ticker                text,
  timeframe             text,
  condition             text,
  price                 text,
  signal                text,
  display_type          text,
  setup                 text,
  grade                 text,
  direction             text,
  atr_level             text,
  entry                 numeric,
  t1                    numeric,
  t2                    numeric,
  t3                    numeric,
  sl                    numeric,
  trail_sl              numeric,
  internals             jsonb,
  internals_age_seconds int,
  trade_plan            jsonb
);
-- No RLS — webhook has no user context, service role writes only
```

### Table: user_sessions (per-user, RLS)
```sql
create table user_sessions (
  user_id    text not null,
  session_id text not null,
  history    jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table user_sessions enable row level security;
create policy "user owns sessions" on user_sessions
  for all using (auth.jwt() ->> 'sub' = user_id);
```

### Key rules
```
- service_role key → Railway only, never Vercel, never frontend
- anon key → Vercel env vars (NEXT_PUBLIC_SUPABASE_ANON_KEY), RLS protects data
- user_id always from Clerk JWT sub claim — never trusted from request body
- tv_alerts: global table, no user_id — webhook auth via TV_WEBHOOK_SECRET only
- INTERNALS_CACHE stays in-memory — heartbeat data is transient, not persisted
```

---

## Agent System (planned — after Supabase journal)

### Build order
1. Supabase live → enables search_journal()
2. LangGraph agent loop + 6 tools
3. New /agent endpoint
4. "Morning Brief" button in Desk UI

---

## Reliability Patterns

### with_retry()
```python
def with_retry(fn, max_attempts=3):
    for attempt in range(max_attempts):
        try: return fn()
        except (anthropic.OverloadedError, anthropic.APIStatusError):
            if attempt < max_attempts - 1: time.sleep(2 ** attempt)
            else: raise
```

### Two Anthropic clients
```python
client        = Anthropic(timeout=60.0)   # /chat, /analyze
stream_client = Anthropic(timeout=120.0)  # /analyze-chart, /premarket
```

### Railway keep-alive
```python
if now.weekday() < 5 and 9 <= now.hour < 16:
    await http.get(f"http://localhost:{port}/ping")
```

---

## Known Bugs Fixed — Do Not Repeat

| # | Bug | Fix |
|---|-----|-----|
| 1 | Tradier /options/ → 302 | Always /markets/options/ prefix |
| 2 | yfinance NaN → json crash | sanitize() before every return |
| 3 | Ribbon wrong EMAs | 8/21/34 not 8/21/48 |
| 4 | options_chain always null | Call get_options_chain_for_analysis() in US block |
| 5 | Analyzer response cut off | max_tokens Haiku=2048, Sonnet=1536 |
| 6 | Railway port not bound | nixpacks.toml + read PORT from env |
| 7 | Git submodule in ui/ | Delete ui/.git before git add |
| 8 | System env overrides .env | unset ANTHROPIC_API_KEY in terminal |
| 9 | 0DTE picking deep ITM | Delta filter → budget → ATR target cascade |
| 10 | TV webhook header blocked | Accept secret from body OR header |
| 11 | Alert badge auto-clearing | Remove markAllRead() from bell onClick |
| 12 | No Anthropic timeouts | Two clients: 60s + 120s |
| 13 | Railway cold starts | _keep_alive() background task |
| 14 | Missing retry on 529 | with_retry() on all Claude calls |
| 15 | setup/grade/direction missing | Added to alert dict from raw payload |
| 16 | markRead marking all above | Set<string> readIds replaces lastSeenId |
| 17 | Accent bar not visible | alignSelf:stretch child div |
| 18 | ATR not passing to snapshot | Pass atr param through all callers |
| 19 | Pine Script plot limit | hex const colors = 48 plots total |
| 20 | V▼ firing in green cloud | cloud_bull = ema8≥ema21 AND ema21≥ema34 |
| 21 | GG not firing at open | Two-tier cloud gate + PO bypass |
| 22 | Wrong ATR key names | gg_complete_call/put confirmed |
| 23 | TV webhook 422 Pydantic | Raw Request body — no Pydantic model |
| 24 | Internals NaN card in drawer | SSE guard: if alert.type==="internals" return |
| 25 | Internals 422 from TV | Raw Request body in _handle_internals |
| 26 | Backend recalculating levels | Pine sends T1/T2/T3/SL — use directly |
| 27 | yfinance $^TRIN broken | get_market_internals() returns None — TV heartbeat is source |
| 28 | /webhook/internals separate | Consolidated into /webhook/tv router |
| 29 | Internals bias field dropped | _handle_internals() stores bias from v2.2 payload |
| 30 | REVERSAL EXIT no accent color | display_type="stop" covers EXIT+REVERSAL conditions |
| 31 | InternalsWidget always offline | ts vs received_at key mismatch — backend stores received_at |
| 32 | Header PDC crash on load | marketData!.atr_levels → optional chaining + ?? '—' |
| 33 | Supabase init crash Python 3.13 | supabase==2.7.4 + httpx==0.27.0 + gotrue==2.7.0 |
| 34 | TS Authorization header type error | Record<string, string> + imperative if(token) assignment |
| 35 | Chat journal intent false negative | Two-step: YES/NO Haiku check → extraction → _save_journal_entry() |

---

## Saty Trading System Reference

### Account — Phase 2
```
~$1,625 · Max 1 contract · Max $3–4 premium
A/A+ setups only · Max loss -$150/session · Max 3 trades/day
```

### Internals — context not gate
```
Internals inform, never block (confirmed by Saty).
TRIN >1.2 bearish pressure | TRIN <0.8 bullish pressure
ADD >+200 buying | ADD <-200 selling
VOLD positive = call volume dominance | negative = put volume dominance
PCC >1.2 bearish | <0.8 bullish
```

### Ribbon cloud reading
```
Read the CLOUD (filled area) — not the candle color
Green/teal = BULLISH = calls eligible
Red/orange = BEARISH = puts eligible
Thin/white = MIXED = no trade
Gray candles INSIDE green cloud = compression — NOT bearish
```

### ATR levels (v3.1 Clean Extended — full Saty ladder)
```
Trigger:     PDC ± ATR × 0.236
GG Open:     PDC ± ATR × 0.382   → T1 (first target)
50% Mid:     PDC ± ATR × 0.500   → key mean reversion zone
GG Complete: PDC ± ATR × 0.618   → T2 (golden ratio exit)
78.6%:       PDC ± ATR × 0.786
Full ATR:    PDC ± ATR × 1.000   → T3 full day target
123.6%:      PDC ± ATR × 1.236   } Extension levels —
138.2%:      PDC ± ATR × 1.382   } show_extensions=false
150%:        PDC ± ATR × 1.500   } by default,
161.8%:      PDC ± ATR × 1.618   } togglable in
178.6%:      PDC ± ATR × 1.786   } TradingView
200%:        PDC ± ATR × 2.000   }

ATR mode: Day (Daily PDC/ATR) or Multiday (Weekly PDC/ATR)
session.extended used for accurate overnight PDC
```

### Trade execution timeframe
```
1H  → Bias read only
15m → Setup confirmation context
3m  → Entry execution — all Manual Planner alerts fire here
      Pine computes T1/T2/T3/SL and sends in payload
      Backend attaches internals snapshot
```

### Setup definitions (Manual Planner v3.3.6)
```
GG          = 38.2% GG Open toward 61.8% GG Complete
FLAG        = pullback into 13/21 EMA zone while ribbon stacked ≥5 bars
iVOMY BULL  = bearish ribbon transitions bullish → price reclaims → hold confirms
VOMY BEAR   = bullish ribbon transitions bearish → price loses ribbon → rejection confirms
BT          = call/put trigger backtest
ORB RETEST  = 10m opening range break + retest (CST 08:30–08:40)

ORB Visual Box (v3.3.3+):
- CST-aware ORB range: 08:30–08:40 (orbSession input, orbTimezone="America/Chicago")
- ORB High / Low lines drawn green/red, extend right
- ORB Mid line optional (dashed yellow)
- Labels placed after ORB window closes
- orbBullBroken / orbBearBroken flags gate ORB Retest setup
- oneORBTradePerDirection = true — one retest per direction per day
- Daily reset on isNewDay

Runner Manager (v3.3.6):
- Full Saty ladder target engine: f_bullNextAfter() / f_bearNextAfter()
  walk complete ATR ladder (PDC ±0.236 through ±2.0 ATR) to find T1/T2/T3
- iVOMY/VOMY full-ladder fix: targets found from any position on ladder
- f_targetsValid() blocks plans where targets point wrong direction
- Fallback: Points or R/R if Saty ladder exhausted
- Runner after T3: runnerActive flag, progressive NEXT target manager
- SL trails: BE after T1 → T1 after T2 → T3 after T3 → NEXT after each runner
- atr_level field in ENTRY alert JSON: f_atrLevelName() maps price to level name
- Mobile display profile: smaller lines/labels
```

---

## Prioritized Feature Backlog

### Do next — in order
1. **0DTE ticker expansion** — Mag7 watchlist (NVDA/TSLA/META/AMZN/AAPL/MSFT), ribbon state per ticker, 0DTE eligibility panel
2. **Agent (LangGraph)** — morning brief, 6 tools, /agent endpoint, UI button

### After that
- Unusual Whales API v2 — auto-fetch live flow data
- RAG knowledge base — Voyage AI + pgvector
- Earnings scanner
- Mobile push notifications (PWA)
- Watchlist management
- GEX heat map overlay on PREMARKET

---

*Single source of truth. Update after every build session. Any Claude session must read this before touching any code.*
