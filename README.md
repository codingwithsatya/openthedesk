# OpenTheDesk

A full-stack AI trading intelligence platform built around the **Saty Mahajan 0DTE SPX/SPXW trading system**. Live market data, TradingView webhook integration, AI-assisted analysis, trade journal, 90-Day Challenge tracking, and a proactive trading coach — all in one personal desk.

**🔗 Frontend:** https://openthedesk.vercel.app  
**⚙️ Backend:** https://openthedesk-production.up.railway.app

![Claude API](https://img.shields.io/badge/Built%20with-Claude%20API-blue) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green) ![Next.js](https://img.shields.io/badge/Frontend-Next.js-black) ![Supabase](https://img.shields.io/badge/Database-Supabase-teal)

---

## What It Does

OpenTheDesk is a personal trading intelligence platform — not a generic app. Every feature is built around Satya's specific trading rules, playbook setups, account parameters, and risk protocols.

Say **"Open the Desk"** to begin each session. The system loads your full trading context, injects live market data, and runs every analysis against your actual rules.

**Human-in-the-loop always.** The system analyzes and presents. You approve or reject. Nothing executes autonomously.

---

## Pages

### 0DTE Desk
The live trading command center. Three-column terminal layout: ATR levels + internals on the left, chat in the center, signal stream on the right.

- All 14 trading shortcuts (PTR-FAST, PREMARKET, TRADE IDEA, IN TRADE, EOD, and more)
- Live SPX price, VIX, ATR ladder, 0DTE options chain
- TradingView alert cards with T1/T2/T3/SL — one-click "Took This Trade"
- Multi-chart upload + paste from clipboard for vision analysis
- Morning Brief — market tone, Mag7 alignment, economic calendar, volatility flags

### Analyzer
Watchlist + full analysis for Mag7 and context instruments.

- Live ribbon state, ATR levels, compression, PO value for 12 tickers
- Quick Read — Haiku 0DTE brief with Bull Above / Bear Below in one click
- Full Analysis — dual Claude verdict (Haiku for 0DTE plan, Sonnet for context)
- Live Screener — ribbon filter across all tickers in parallel

### Journal
Full trade journal with real performance analytics.

- Cumulative P&L curve, P&L by setup, win % by hour
- R-multiple per trade (computed from real stop_loss_premium)
- 5-factor AI process grade (setup quality, execution, risk management, trade management, mindset)
- Auto-generated process review on every trade close (Claude Haiku)
- Filter by setup, direction, tags, date range
- CSV export, duplicate trade, inline edit

### 90-Day Challenge
Track a structured 90-day trading challenge with full accountability.

- Calendar-first layout — P&L and grade badge per day
- Mountain hero progress visualization
- Day Detail Drawer — KPI grid, per-trade cards, process review, notes
- Stat cards with sparklines, donut grade chart, streaks, session stop tracking
- Account equity curve across the challenge

---

## The 14 Shortcuts

| Shortcut           | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| Open the Desk      | Full session opener — TD number, account, levels, scenarios |
| PTR-FAST           | 3-gate quick check — all must be YES or SKIP IT             |
| PTR-FULL           | 12-point full pre-trade audit                               |
| PREMARKET          | 5-step morning plan with live SPX + ATR levels              |
| TRADE IDEA         | 6-point analysis with chart vision                          |
| IN TRADE           | Real-time trade management guidance                         |
| TRADE REVIEW       | 4-dimension scorecard — Setup, Execution, Risk, Psychology  |
| EOD                | End of day session review                                   |
| PATTERN CHECK      | Mid-session psychology audit                                |
| MARKET REGIME      | Classify today's environment — Trending/Choppy/News         |
| CAPITAL PROTECTION | Emergency protocol — triggered on 3 losses or -$150         |
| BLUNT FEEDBACK     | Direct critique, zero softening                             |
| WEEKLY REVIEW      | Full weekly performance summary                             |
| WIRE OUT           | Calculate weekly wire-out amount                            |

---

## Tech Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js 16, TypeScript, CSS Modules                               |
| Backend      | Python 3.12, FastAPI, Uvicorn                                     |
| Database     | Supabase (Postgres + RLS)                                         |
| Auth         | Clerk (Google sign-in, JWT)                                       |
| AI           | Claude Sonnet 4.6 (analysis) + Claude Haiku (grading, quick read) |
| Market Data  | Tradier API (SPX quotes, 0DTE chain) + yfinance                   |
| Signals      | TradingView Pine Script webhooks                                   |
| Deployment   | Vercel (frontend) + Railway (backend)                             |
| Observability| LangSmith                                                         |

---

## Project Structure

```
openthedesk/
├── backend/
│   ├── main.py              # Entry point — registers routers, lifespan
│   └── app/
│       ├── core/            # auth, clients, config, state, utils, lifecycle
│       ├── models/          # Pydantic models (chat, journal, challenge, analyzer)
│       ├── services/        # Business logic (chat, journal, challenge, market)
│       └── routers/         # Route handlers (health, desk, analyzer, webhook, challenge, journal)
├── pine/
│   ├── openthedesk_manual_planner.pine   # Manual Planner v3.3.9
│   ├── openthedesk_atr_clean.pine        # ATR Levels v3.1 Clean Extended
│   └── otd_internals_heartbeat.pine      # OTD Internals Heartbeat v2.2
├── ui/
│   ├── app/                 # Next.js pages (thin orchestrators)
│   │   ├── page.tsx         # 0DTE Desk
│   │   ├── analyzer/        # Analyzer
│   │   ├── journal/         # Journal
│   │   └── challenge/       # 90-Day Challenge
│   ├── features/            # Feature modules (components + styles + lib)
│   │   ├── desk/
│   │   ├── analyzer/
│   │   ├── journal/
│   │   └── challenge/
│   └── public/
│       ├── ticker-logos/    # Mag7 + context instrument SVGs
│       └── openthedesk-mountain-hero.webp
├── railway.toml             # Railway deploy config
├── requirements.txt
└── .env                     # API keys (never commit)
```

---

## Running Locally

**Backend**

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Required .env vars:
# ANTHROPIC_API_KEY=
# TRADIER_TOKEN=
# CLERK_SECRET_KEY=
# CLERK_JWT_ISSUER=
# SUPABASE_URL=
# SUPABASE_SERVICE_KEY=
# TV_WEBHOOK_SECRET=
# GOOGLE_DOC_URL=

uvicorn backend.main:app --reload
# Runs on http://localhost:8000
```

**Frontend**

```bash
cd ui
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## TradingView Integration

Three Pine Script indicators send live alerts to the backend via a single unified webhook:

- **Manual Planner v3.3.9** — ENTRY/TARGET/TRAIL/STOP/EXIT alerts with T1/T2/T3/SL
- **ATR Levels v3.1 Clean Extended** — ATR target and stop alerts
- **OTD Internals Heartbeat v2.2** — TRIN/ADD/VOLD/PCC every 3m bar close

All three route through `POST /webhook/tv`. Internals go to cache only; trade alerts broadcast via SSE to the frontend signal stream and persist to Supabase.

---

## Deployment

**Backend → Railway**

- Set all env vars listed above in Railway Variables
- `railway.toml` handles the start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Auto-deploys on push to main

**Frontend → Vercel**

- Root Directory: `ui`
- Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`
- Auto-deploys on push to main

---

## Trading System

Built around Saty Mahajan's 0DTE SPX framework:

- **Indicators:** Pivot Ribbon (EMA 8/21/34), ATR Levels, Phase Oscillator
- **Setups:** Golden Gate, Bilbo GG, Flag Into Ribbon, VOMY, iVOMY, ORB, ORB Fade, ORB Retest, and more
- **Internals:** TRIN / VOLD / ADD / PCC — context not gate (never blocks a trade)
- **Edge:** 97% hit rate on clean 3m close above trigger; +37.3pp edge from invalidation filter
- **Human-in-the-loop always** — agent analyzes, you decide, nothing executes
