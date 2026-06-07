# OpenTheDesk — Architecture & Engineering Reference
**Last updated: June 7, 2026 — evening session**

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
| Analyzer — dark terminal theme redesign | ✅ Live |
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
| Journal UI — /journal page with 3 charts, trade table | ✅ Live |
| Journal persistence — Supabase trade_journal | ✅ Live |
| Alert persistence — Supabase tv_alerts | ✅ Live |
| Session persistence — Supabase user_sessions | ✅ Live |
| Clerk JWT middleware — user_id from verified token | ✅ Live |
| Chat → journal entry (natural language logging) | ✅ Live |
| 0DTE Watchlist — Mag7 + SPY/QQQ/XLK/XLF/SMH, ribbon + ATR levels | ✅ Live |
| Quick Read — card expand, Haiku 0DTE brief, Bull Above / Bear Below | ✅ Live |
| Morning Brief — full bias engine, Mag7, news, economic calendar | ✅ Live |
| Desk state machine — Open/Closed with localStorage persistence | ✅ Live |
| Market hours enforcement — desk locked outside 9:30–16:00 ET weekdays | ✅ Live |
| Auto-close desk at 16:15 ET | ✅ Live |
| User-specific greeting — Clerk firstName, time-aware | ✅ Live |
| Agent (LangGraph, tool use) | 🔲 Planned |
| Alert card → journal (Took This Trade button) | 🔲 Next |
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
    ├── app/
    │   ├── page.tsx              # 0DTE Desk — desk state machine, morning brief, chat
    │   ├── analyzer/page.tsx     # Analyzer — watchlist, quick read, full analysis
    │   ├── journal/page.tsx      # Journal (/journal)
    │   ├── layout.tsx            # ClerkProvider + auth
    │   └── globals.css           # Design tokens + shared styles + glassmorphism
    └── app/components/
        ├── Header.tsx            # Nav + desk open/closed indicator + session timer
        ├── AlertPanel.tsx        # useAlerts hook + AlertDrawer (SSE) + TradePlan card
        ├── InternalsWidget.tsx   # Live internals widget — polls /internals every 30s
        ├── LevelsPanel.tsx       # ATR levels + 0DTE options sidebar (mounts InternalsWidget)
        ├── ChatPanel.tsx         # Main chat interface + empty state + morning brief wiring
        ├── CommandPalette.tsx    # / commands modal
        ├── QuickActions.tsx      # Quick action buttons — state-aware (open vs closed)
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
| Fundamentals | yfinance | Mag7 + context instruments + India stocks |
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
TV_WEBHOOK_SECRET=       # TradingView webhook auth secret — ROTATED June 2026
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

### Pydantic models
```python
ChatRequest:           message, session_id, atr (optional)
RefreshRequest:        session_id
AnalyzeRequest:        ticker, trading_mode (day|multiday|swing|position)
QuickAnalyzeRequest:   ticker, price, ribbon_state, compression, po_value,
                       call_trigger, put_trigger, gg_open_call, gg_open_put,
                       atr_14, change_pct
JournalEntryPayload:   date, ticker, setup, direction,
                       entry_price, exit_price, contracts,
                       pnl (optional), grade, process_grade, notes (optional)
```

Note: TVAlertPayload and InternalsPayload Pydantic models were REMOVED.
/webhook/tv now uses raw Request body parsing — handles any TV payload format.

### Endpoints
```
GET  /health                  → status check
GET  /ping                    → keep-alive probe
GET  /me                      → auth probe
POST /chat                    → main chat (Clerk JWT required)
POST /analyze-chart           → chart vision — streaming
GET  /market-data             → SPX + VIX + ATR + 0DTE options + flow
POST /premarket               → PREMARKET command — streaming
POST /refresh-context         → reload Google Doc + clear session
DELETE /session/{id}          → clear chat history
POST /analyze                 → ticker analysis — Haiku + Sonnet parallel
GET  /screener                → ribbon screener — 15 tickers parallel
GET  /watchlist               → Mag7 + context instruments watchlist
POST /quick-analyze           → Haiku 0DTE quick read for watchlist card
POST /morning-brief           → full morning brief — news + Mag7 + bias (Clerk JWT required)
POST /webhook/tv              → TradingView unified webhook
GET  /internals               → latest internals snapshot
GET  /alerts                  → alert history (Supabase first, in-memory fallback)
GET  /alerts/stream           → SSE stream — pushes alerts to frontend
POST /journal/entry           → create journal entry (Clerk JWT required)
GET  /journal/entries         → fetch journal entries (Clerk JWT required)
GET  /journal/stats           → journal statistics (Clerk JWT required)
```

### Global state
```python
INTERNALS_CACHE: dict   # Latest internals snapshot from TV heartbeat (in-memory, intentional)
TV_ALERTS: list[dict]   # In-memory cache only — source of truth is Supabase tv_alerts
FLOW_CONTEXT: str       # Latest unusual flow — injected into /chat
LIVE_CONTEXT: str       # Google Doc content — loaded at startup
sessions: dict          # In-memory fallback only — source of truth is Supabase user_sessions
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
#             /journal/entry, /journal/entries, /journal/stats,
#             /morning-brief
# NOT applied to: /webhook/tv (TradingView has no user context)
#                 /watchlist, /quick-analyze (no user context needed)
```

### Model routing
```python
SONNET = "claude-sonnet-4-6"
HAIKU  = "claude-haiku-4-5-20251001"

_HAIKU_COMMANDS = {
    "PTR-FAST", "PTR-FULL", "GRADE", "PATTERN CHECK",
    "MARKET REGIME", "CAPITAL PROTECTION", "WIRE OUT",
    "TRADE REVIEW", "EOD",
}
_LONG_COMMANDS = {
    "PTR-FULL", "TRADE REVIEW", "EOD", "WEEKLY REVIEW",
    "PREMARKET", "BLUNT FEEDBACK", "OPEN THE DESK", "MORNING BRIEF",
}
# max_tokens: long commands = 4096, others = 2048
# /analyze: Haiku = 2048, Sonnet = 1536 — never lower
```

### Chat → journal intent detection
```python
# In /chat, before routing to Claude:
# 1. _is_command_message() — skip if known command prefix
# 2. _detect_journal_intent() — Haiku YES/NO, max_tokens=64
# 3. _extract_journal_fields() — Haiku JSON extraction, max_tokens=512
# 4. _save_journal_entry() — writes to Supabase + in-memory
# Returns "Logged ✓ GG Bear · Entry 7390 · Exit 7378 · +$1,200 · TRIN 1.62"
```

### Morning Brief — /morning-brief
```python
# Runs three parallel operations:
# 1. get_market_summary() — SPX/VIX/ATR levels
# 2. get_watchlist_data() × 9 tickers — Mag7 + SPY/QQQ (asyncio.gather)
# 3. _fetch_market_news() — 3 parallel Haiku web searches:
#    - Economic calendar today (HIGH/MED impact USD events)
#    - Premarket gap ups/downs
#    - Catalyst news

# Output format (rose.trading style):
# 📈 MARKET TONE
# 📊 MORNING BIAS
# 📈 GAP UPS / 📉 GAP DOWNS
# 📅 US ECONOMIC CALENDAR
# ⚠️ VOLATILITY FLAGS (FOMC/CPI/NFP rules hardcoded)
# 🔥 CATALYST NEWS
# MARKET BIAS scorecard (6 signals)
# MAG 7 ALIGNMENT table
# TODAY'S PLAN (instrument, direction, SPX levels)
# RISK LEVEL

# Hard rules in system prompt:
# FOMC today → RISK: EXTREME, no 0DTE
# CPI/PPI/NFP today → RISK: HIGH, wait 15 min post-release
# VIX > 30 → RISK: HIGH minimum
# VIX > 40 → RISK: EXTREME, no 0DTE
# News unavailable → brief still generates from market data
```

### 0DTE Watchlist — /watchlist
```python
_MAG7 = ["NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL"]
_CONTEXT_INSTRUMENTS = ["QQQ", "SPY", "XLK", "XLF", "SMH"]
_ZERO_DTE_ELIGIBLE = {all above}  # static — daily options available

# get_watchlist_data(ticker, zero_dte_eligible) in analyzer.py:
# Returns: price, change_pct, ribbon_state, ema8/21/34, atr_14,
#          call_trigger (0.236), put_trigger (0.236),
#          gg_open_call (0.382), gg_open_put (0.382),
#          compression (Bollinger), po_value, volume_ratio,
#          sector, zero_dte_eligible, error
# Sorted: BULLISH first → BEARISH → MIXED, within group by |change_pct|
```

### Quick Read — /quick-analyze
```python
# POST — accepts watchlist ticker data
# Haiku, max_tokens=512
# Returns structured 0DTE brief:
# BIAS: BULL/BEAR/WAIT
# BULL ABOVE: $trigger (label)
#   Entry: strike @ est premium
#   T1/T2/Stop
# BEAR BELOW: $trigger (label)
#   Entry: strike @ est premium
#   T1/T2/Stop
# IV NOTE + PREMIUM recommendation
```

---

## Frontend — Desk (ui/app/page.tsx)

### Desk state machine
```typescript
// States: CLOSED → OPEN → CLOSED
// Persisted in localStorage:
//   otd_desk_open: "true" | "false"
//   otd_desk_open_time: ISO string

// Auto-close: >12 hours old on load → reset to CLOSED
// Auto-close: 16:15 ET weekdays → EOD runs automatically

// Market hours gate:
getMarketStatus() → "weekend" | "premarket_early" | "premarket" | "open" | "closed"
canOpenDesk = marketStatus === "open"  // 9:30–16:00 ET weekdays only

// openDesk():
//   1. setDeskOpen(true) + localStorage
//   2. sendMessage("Open the Desk") → session opener streams

// closeDesk():
//   1. setDeskOpen(false) + clear localStorage
//   2. sendMessage("EOD") → EOD runs automatically
```

### Morning Brief flow
```typescript
// runMorningBrief():
//   1. setBriefLoading(true) → button shows "⏳ Preparing Brief..."
//   2. POST /morning-brief with Clerk token
//   3. setMessages([...prev, { role: "assistant", content: data.morning_brief }])
//   4. setBriefLoading(false)
// Available even when desk is CLOSED — pre-session prep
```

### Greeting
```typescript
const { user } = useUser();  // Clerk hook
const firstName = user?.firstName
  ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1)
  : "Satya";

getGreeting() → "Good morning" | "Good afternoon" | "Good evening"
// Based on ET hour: <12 morning, <17 afternoon, else evening
```

### QuickActions — state-aware
```
DESK CLOSED: [🌅 Morning Brief] [Open the Desk — disabled if market closed]
DESK OPEN:   [PTR-FAST] [PREMARKET] [/ Commands] [Close Desk]
```

### Hydration fix
```typescript
// Both Header.tsx and QuickActions.tsx use:
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

// All deskOpen-dependent rendering uses (mounted && deskOpen)
// suppressHydrationWarning on affected elements
// Prevents SSR/client mismatch on localStorage-based state
```

---

## Frontend — Analyzer (ui/app/analyzer/page.tsx)

### WatchlistPanel
```typescript
// Fetches GET /watchlist on mount
// Two sections: "Mag 7" and "Market Context"
// TickerCard — glassmorphism, ribbon glow, compression ring
// Click card → expands inline (card-expand CSS animation)
// Quick Read loads from /quick-analyze on first expand
// Cached per ticker — no re-fetch on re-expand
// "Full Analysis →" button → triggers existing analyze() flow
// Only one card expanded at a time
```

### TickerCard design
```
- glass-card class + glow-bull/glow-bear/glow-mixed
- Ribbon badge with glow
- 0DTE badge (cyan) if zero_dte_eligible
- Compression ring (orange pulsing) if compression=true
- BULL ABOVE / BEAR BELOW trigger levels
- PO bar: gradient fill, green→teal positive, red→orange negative
- Expanded: BIAS colored, prices cyan, IV/PREMIUM italic gray
- Full Analysis button: gradient blue→purple
```

### Full Analysis result card
```
Dark terminal theme (#0a0e17)
- Top ribbon glow line (green BULLISH / red BEARISH)
- Header: ticker, price, ribbon badge with glow, badges
- Levels strip: horizontal chips, near-price highlighted yellow
- Two panels side by side:
  Left (Haiku): blue accent, "0DTE · Options Trade Plan"
  Right (Sonnet): purple accent, "Stock Analysis · Long-Term"
- MarkdownText: LABEL: bold white, values colored green/red,
  ## headers as uppercase dividers, $prices cyan, **bold** white
- Fundamentals strip: dark, monospace values
- EMA strip: darkest, muted values
```

---

## Database — Supabase

### Tables
```sql
trade_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,          -- Clerk sub claim
  created_at timestamptz DEFAULT now(),
  date date,
  ticker text DEFAULT 'SPX',
  setup text,
  direction text,
  entry_price numeric,
  exit_price numeric,
  contracts int DEFAULT 1,
  pnl numeric,
  grade text DEFAULT 'A',
  process_grade text DEFAULT 'A',
  notes text,
  internals jsonb
)
-- RLS: user_id = auth.jwt()->>'sub'
-- Index: (user_id, created_at DESC)

tv_alerts (
  alert_id uuid PRIMARY KEY,
  ts timestamptz,
  ticker text, timeframe text, condition text,
  price numeric, signal text, display_type text,
  setup text, grade text, direction text,
  atr_level text,
  entry numeric, t1 numeric, t2 numeric, t3 numeric,
  sl numeric, trail_sl numeric,
  internals jsonb, internals_age_seconds int,
  trade_plan jsonb
)
-- No RLS — global (alerts have no user context from TradingView)
-- Dedup: upsert on_conflict="alert_id"

user_sessions (
  user_id text,
  session_id text,
  history jsonb,           -- full message array
  updated_at timestamptz,
  PRIMARY KEY (user_id, session_id)
)
-- RLS: user_id = auth.jwt()->>'sub'
```

### Data flow
```
tv_alerts:      TradingView → /webhook/tv → Supabase (no user context)
trade_journal:  /chat intent or /journal/entry → Supabase (Clerk user_id)
user_sessions:  /chat → Supabase upsert after every reply (Clerk user_id)

All three tables confirmed live and writing as of June 5, 2026.
INTERNALS_CACHE stays in-memory — heartbeat data is transient, not persisted
```

---

## TradingView Pipeline

### Signal sources (all fire on 3m bar close)
```
Manual Planner v3.3.6    → ENTRY/TARGET/TRAIL/STOP/EXIT alerts
                            Sends: ticker, timeframe, condition, price,
                                   entry, t1, t2, t3, sl, trail_sl,
                                   setup, grade, direction, signal,
                                   atr_level, secret
ATR Levels v3.1 Clean    → Optional backup target/stop alerts only
                            setup="ATR_TARGET" or "ATR_STOP"
Internals Heartbeat v2.2 → type="internals", TRIN/ADD/VOLD/PCC/bias
                            fires every 3m bar close, routes to cache only
```

### Webhook routing (/webhook/tv)
```python
if data.get("type") == "internals" or data.get("signal") == "INTERNALS":
    → _handle_internals()  # updates INTERNALS_CACHE only, no SSE broadcast
else:
    → _handle_trade_alert()  # builds alert dict, SSE broadcast, Supabase upsert
```

### Alert display types (frontend card accent)
```
"entry"  → ENTRY signal, direction BULL/BEAR
"update" → TRAIL or TARGET signal
"stop"   → EXIT, STOP, or REVERSAL condition
```

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
client        = Anthropic(timeout=60.0)   # /chat, /analyze, /morning-brief
stream_client = Anthropic(timeout=120.0)  # /analyze-chart, /premarket
```

### Railway keep-alive
```python
if now.weekday() < 5 and 9 <= now.hour < 16:
    await http.get(f"http://localhost:{port}/ping")
```

---

## Monday Morning Workflow

```
~9:00 ET  Open app → "Good morning, Satya."
           Click 🌅 Morning Brief
           → Market tone, gap ups/downs, economic calendar
           → Volatility flags (FOMC/CPI/NFP auto-detected)
           → Mag7 alignment, SPX levels, TODAY'S PLAN
           → RISK LEVEL

~9:25 ET  "Open the Desk →" becomes active (green)
           Click it → session opener runs automatically
           Header: ● DESK OPEN + session timer starts

9:30+ ET  TradingView alerts → alert drawer fills
           PTR-FAST before any entry
           Take trade
           "took GG Bear at 7390, exited 7378" → auto-journals
           Or: [Took This Trade] button on alert card (planned)

4:00 PM   Desk auto-closes at 4:15 ET
           EOD runs automatically
           Check /journal page
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
| 36 | Watchlist card grid stretching | alignSelf: "start" on TickerCard + align-items: start on grid |
| 37 | Hydration mismatch desk state | mounted flag + suppressHydrationWarning in Header + QuickActions |
| 38 | Morning Brief calling /chat | runMorningBrief() calls /morning-brief directly, reads data.morning_brief |
| 39 | Desk open on weekend refresh | localStorage auto-clears if >12h old on mount |

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
1. **Alert card → journal** — "Took This Trade" button on alert card, inline form for exit price + contracts, one-click journal entry
2. **Agent (LangGraph)** — 6 tools, /agent endpoint, proactive alerts
3. **WEEKLY REVIEW wired to Supabase** — fetch real trade_journal data instead of context-only

### After that
- Unusual Whales API v2 — auto-fetch live flow data
- RAG knowledge base — Voyage AI + pgvector
- Earnings scanner
- Mobile push notifications (PWA)
- Watchlist management
- GEX heat map overlay on PREMARKET

---

*Single source of truth. Update after every build session. Any Claude session must read this before touching any code.*
