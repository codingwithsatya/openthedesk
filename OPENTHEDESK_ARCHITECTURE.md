# OpenTheDesk — Architecture & Engineering Reference

**Last updated: June 24, 2026 — Backend fully modularised (monolithic main.py deleted, replaced by backend/app/ routers+services+models+core); Analyzer, Journal, Desk refactored into feature modules; AppIconRail added; ticker-logo SVGs added; PR #1 raised (feature/challenge-page-redesign → main)**

This document is the single source of truth for OpenTheDesk. Any Claude session working on this project must read this before touching any code.

---

## What Is OpenTheDesk

OpenTheDesk is a live trading intelligence platform built for Satya Pramod. It is a full-stack AI application purpose-built around the **Saty Mahajan trading system** for 0DTE SPX/SPXW options trading.

The name comes from the session trigger phrase: "Open the Desk" — spoken at the start of every trading session.

**It is not a generic trading app.** Every feature is built around Satya's specific trading rules, playbook setups, account parameters, and risk management protocols.

**Human-in-the-loop always.** The system analyzes and presents. Satya approves or rejects. Nothing executes autonomously.

---

## What's Live Today

| Feature                                                                                                                        | Status                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0DTE Desk — chat, all commands, PREMARKET, chart vision                                                                        | ✅ Live                                                                                                                                                    |
| Analyzer — real options chain, greeks, dual Claude verdicts                                                                    | ✅ Live                                                                                                                                                    |
| Analyzer — dark terminal theme redesign                                                                                        | ✅ Live                                                                                                                                                    |
| Screener — 15 tickers parallel, ribbon filter                                                                                  | ✅ Live                                                                                                                                                    |
| Auth (Clerk), observability (LangSmith)                                                                                        | ✅ Live                                                                                                                                                    |
| Reliability — retry backoff, keep-alive, timeouts                                                                              | ✅ Live                                                                                                                                                    |
| TradingView webhook — unified /webhook/tv handles all 3 feeds                                                                  | ✅ Live                                                                                                                                                    |
| Alert cards — colored by setup/direction, trade plan, internals row                                                            | ✅ Live                                                                                                                                                    |
| Trade Plan card — Pine-computed T1/T2/T3/SL from Manual Planner                                                                | ✅ Live                                                                                                                                                    |
| Internals snapshot — TRIN/ADD/VOLD attached to every trade alert                                                               | ✅ Live                                                                                                                                                    |
| Internals heartbeat — USI:TRIN/ADD/VOLD/PCC via TV every 3m                                                                    | ✅ Live                                                                                                                                                    |
| Manual Planner v3.3.9 — Saty Probability + Quality Engine                                                                      | ✅ Live                                                                                                                                                    |
| ATR Levels v3.1 Clean Extended — full Saty ladder, Day/Multiday mode                                                           | ✅ Live                                                                                                                                                    |
| OTD Internals Heartbeat v2.2 — market internals data feed                                                                      | ✅ Live                                                                                                                                                    |
| Internals live widget — TRIN/ADD/VOLD/PCC/bias sidebar widget                                                                  | ✅ Live                                                                                                                                                    |
| Multi-chart upload + drag-drop + paste from clipboard                                                                          | ✅ Live                                                                                                                                                    |
| Chart context selector (TRADE IDEA / IN TRADE / PREMARKET / PTR-FAST)                                                          | ✅ Live                                                                                                                                                    |
| Live data injection for trade commands                                                                                         | ✅ Live                                                                                                                                                    |
| Dynamic max_tokens — long commands 4096, fast commands 2048                                                                    | ✅ Live                                                                                                                                                    |
| Market internals rule — context not gate (never blocks trades)                                                                 | ✅ Live                                                                                                                                                    |
| Target levels rule — flags when within 1pt of T1/T2/T3                                                                         | ✅ Live                                                                                                                                                    |
| Unusual Whales — manual text input v1                                                                                          | ✅ Live                                                                                                                                                    |
| Journal UI — /journal page with 3 charts, trade table                                                                          | ✅ Live                                                                                                                                                    |
| Journal persistence — Supabase trade_journal                                                                                   | ✅ Live                                                                                                                                                    |
| Alert persistence — Supabase tv_alerts                                                                                         | ✅ Live                                                                                                                                                    |
| Session persistence — Supabase user_sessions                                                                                   | ✅ Live                                                                                                                                                    |
| Clerk JWT middleware — user_id from verified token                                                                             | ✅ Live                                                                                                                                                    |
| Chat → journal entry (natural language logging)                                                                                | ✅ Live                                                                                                                                                    |
| 0DTE Watchlist — Mag7 + SPY/QQQ/XLK/XLF/SMH, ribbon + ATR levels                                                               | ✅ Live                                                                                                                                                    |
| Quick Read — card expand, Haiku 0DTE brief, Bull Above / Bear Below                                                            | ✅ Live                                                                                                                                                    |
| Morning Brief — full bias engine, Mag7, news, economic calendar                                                                | ✅ Live                                                                                                                                                    |
| Desk state machine — Open/Closed with localStorage persistence                                                                 | ✅ Live                                                                                                                                                    |
| Market hours enforcement — desk locked outside 9:30-16:00 ET weekdays                                                          | ✅ Live                                                                                                                                                    |
| Auto-close desk at 16:15 ET                                                                                                    | ✅ Live                                                                                                                                                    |
| User-specific greeting — Clerk firstName, time-aware                                                                           | ✅ Live                                                                                                                                                    |
| Three-column terminal layout — Levels / Chat / Signal Stream                                                                   | ✅ Live                                                                                                                                                    |
| Morning Brief banner — pinned strip showing bias + Mag7 + warning                                                              | ✅ Live                                                                                                                                                    |
| Session stats bar — TD number, trades, P&L, budget used                                                                        | ✅ Live                                                                                                                                                    |
| Chart strip — timeframe pills + Open Chart button                                                                              | ✅ Live                                                                                                                                                    |
| Signal Stream — permanent right panel, alert cards with Took/Skip                                                              | ✅ Live                                                                                                                                                    |
| Header SPX price + VIX + ATR strip                                                                                             | ✅ Live                                                                                                                                                    |
| Signal Stream → "Took This Trade" — entry premium, open trade saved                                                            | ✅ Live                                                                                                                                                    |
| Journal → Close Trade — exit premium, P&L = (exit-entry premium)x100                                                           | ✅ Live                                                                                                                                                    |
| Journal → Edit trade — exit price, grade, notes inline edit                                                                    | ✅ Live                                                                                                                                                    |
| trade_journal schema — status, entry_premium, exit_premium columns                                                             | ✅ Live                                                                                                                                                    |
| Journal stats — only closed trades with real pnl counted                                                                       | ✅ Live                                                                                                                                                    |
| Signal card logged/skipped state — persisted in localStorage                                                                   | ✅ Live                                                                                                                                                    |
| Signal stream cleanup — mobile capped at 5 (priority for today's ENTRY)                                                        | ✅ Live                                                                                                                                                    |
| Mobile Signals tab — bottom sheet, Took/Skip, same-day actionability gate                                                      | ✅ Live                                                                                                                                                    |
| 90-Day Challenge — calendar-first layout, ChallengeDayDrawer, mountain hero art, process grades                                | ✅ Live                                                                                                                                                    |
| Challenge pre-start page (!isActive) — hero, 6-card rules, journey/philosophy, build cards, checklist, past challenges | ✅ Live — design locked June 22; QA/spacing/bug fixes only going forward                                                         |
| Challenge tracking — challenge_entries links to trade_journal via source_entry_id                                              | ✅ Live                                                                                                                                                    |
| Challenge parallel write — all journal paths write to challenge_entries when active                                            | ✅ Live                                                                                                                                                    |
| Chat journal P&L — uses entry/exit premium not SPX price points                                                                | ✅ Live                                                                                                                                                    |
| Session history restore — chat persists across navigation via /session/{id}/history                                            | ✅ Live                                                                                                                                                    |
| Alert read-state sync — alert_reads table syncs read/unread across devices                                                     | ✅ Live                                                                                                                                                    |
| Challenge real-data day-spread fix — calendar/streak now anchored to challenge start_date consistently across hero/streak/dock | ✅ Live                                                                                                                                                    |
| Challenge real equity chart — \_challenge_build_equity() + equity field on /challenge/stats                                    | ✅ Live                                                                                                                                                    |
| Challenge per-day trade detail endpoint — GET /challenge/day/{date}
| GET /challenge/all — all challenges + stats for Past Challenges section                                          | ✅ Live                                                                                                                                                    |
| GET /journal/entries, POST /journal/review/{entry_id} — new journal endpoints                                    | ✅ Live                                                                                                                                                    |                                                            | ✅ Live                                                                                                                                                    |
| R-multiple per trade — computed from real stop_loss_premium, not flat assumed risk                                             | ✅ Live — SQL columns confirmed added; null for the 5 pre-existing test trades logged before the column existed                                            |
| 5-factor AI process grade (grade_factors jsonb) — Haiku-scored on trade close                                                  | ✅ Live (SQL column added; write-path on an actual new trade close not yet independently re-confirmed)                                                     |
| TradingView Charting Library — application submitted, awaiting approval                                                        | ⏳ Pending                                                                                                                                                 |
| Embedded SPX chart (Lightweight Charts)                                                                                        | ❌ Abandoned — yfinance unreliable                                                                                                                         |
| Challenge page calendar-first redesign — full implementation in real ui/app/challenge/page.tsx                                 | ✅ Live                                                                                                                                                    |
| Mountain hero → ui/public/openthedesk-mountain-hero.webp (WebP, replaces deleted SVG — commit 11369c5) | ✅ Live                                                                                                                                                    |
| Day Detail Drawer (ChallengeDayDrawer.tsx) — KPI grid, per-trade cards, notes, sticky footer                                   | ✅ Live                                                                                                                                                    |
| /challenge/stats: avg_process_grade, streaks, grade_breakdown additions                                                        | ✅ Live                                                                                                                                                    |
| /challenge/day/{date}: win_rate, avg_r_multiple additions                                                                      | ✅ Live                                                                                                                                                    |
| USE_MOCK_CHALLENGE_DATA flag fully removed from challenge page
| StartChallengeModal.tsx moved → ui/features/challenge/components/ (was ui/app/components/)                          | ✅ Live                                                                                                                                                    |                                                                 | ✅ Live                                                                                                                                                    |
| Grade Breakdown popup (5-factor radar + 10-day history bar chart)                                                              | 🔲 Planned — grade_factors column exists now; blocked on the popup itself not being designed/built, and on having enough real graded trades to populate it |
| Intraday/hourly equity price tracking                                                                                          | 🔲 Planned — separate, larger project; deliberately not bundled with Challenge redesign                                                                    |
| Claude process review — auto-analysis on trade close                                                                           | ✅ Live, consumed in the Day Detail Drawer (free-text process_review card) — auto-trigger pipeline itself still not independently re-verified this session |
| Full SPX chart with indicators (TradingView Charting Library)                                                                  | ⏳ Pending approval                                                                                                                                        |
| Agent (LangGraph, tool use)                                                                                                    | 🔲 Planned                                                                                                                                                 |
| Unusual Whales API v2 — auto-fetch live flow data                                                                              | 🔲 Planned                                                                                                                                                 |
| RAG knowledge base — Voyage AI + pgvector for Saty playbook                                                                    | 🔲 Planned                                                                                                                                                 |
| Earnings scanner                                                                                                               | 🔲 Planned                                                                                                                                                 |
| Mobile push notifications                                                                                                      | 🔲 Planned                                                                                                                                                 |
| Backend modularisation — monolithic main.py deleted; replaced by backend/app/ (routers/services/models/core) + backend/main.py entry-point | ✅ Live                                                                                                                          |
| Analyzer refactored into ui/features/analyzer/ feature module                                                                  | ✅ Live                                                                                                                                                    |
| Journal refactored into ui/features/journal/ feature module                                                                    | ✅ Live                                                                                                                                                    |
| Desk refactored into ui/features/desk/ feature module (DeskShell + DeskWorkspace)                                              | ✅ Live                                                                                                                                                    |
| AppIconRail — shared left nav rail component (ui/app/components/AppIconRail.tsx)                                               | ✅ Live                                                                                                                                                    |
| Ticker-logo SVGs — Mag7 + SPY/QQQ/XLK/XLF/SMH/TSLA in ui/public/ticker-logos/                                                | ✅ Live                                                                                                                                                    |
| Header.tsx / Desk / Analyzer / Journal shell redesign (top-nav + icon-rail)                                                    | ✅ Live — shipped in this PR via AppIconRail + feature module refactors                                                                                    |
---

## PR #1 — feature/challenge-page-redesign → main (107 files, June 2026)

This PR represents the full branch work. **Not merged yet** — review only until all pages verified.

### What changed

**Backend — full modularisation:**
- `main.py` (2356 lines) deleted. Replaced by `backend/main.py` (35 lines) + `backend/app/` module tree.
- `backend/app/core/`: auth (Clerk JWT), clients (Anthropic + Supabase singletons), config (env vars), lifecycle (startup/keep-alive), state (global caches), utils (sanitize, with_retry).
- `backend/app/models/`: domain Pydantic models split across analyzer.py, challenge.py, chat.py, journal.py.
- `backend/app/routers/`: analyzer (304 lines), challenge (188), desk (639), health (23), journal (434), webhook (251).
- `backend/app/services/`: challenge_service (221), chat_service (175), journal_service (285), market_service (50).
- `nixpacks.toml` updated: startCommand now `python backend/main.py` (via venv path).

**Frontend — feature module refactors:**
- `ui/app/analyzer/page.tsx` gutted (1237 → ~150 lines orchestrator). All Analyzer UI moved to `ui/features/analyzer/` (6 components, 2 lib files, 2 CSS modules).
- `ui/app/challenge/page.tsx` gutted (693 → ~75 lines orchestrator). Challenge feature module already existed; page.tsx now just routes to it.
- `ui/app/journal/page.tsx` gutted (1752 → ~150 lines orchestrator). All Journal UI moved to `ui/features/journal/` (5 components, 2 lib files, 6 CSS modules).
- `ui/app/page.tsx` (Desk) refactored. Desk shell moved to `ui/features/desk/` (DeskShell + DeskWorkspace).
- `AppIconRail.tsx` + `AppIconRail.module.css` added to `ui/app/components/` — shared nav rail across all pages.
- `StartChallengeModal.tsx` removed from `ui/app/components/` (now lives only in `ui/features/challenge/components/`).
- `ui/app/globals.css` significantly updated (1960 lines total after changes).

**Shared components updated:**
- `AlertPanel.tsx`, `ChatPanel.tsx`, `FlowPanel.tsx`, `Header.tsx`, `LevelsPanel.tsx`, `QuickActions.tsx`, `SignalStream.tsx` — all updated as part of the shell redesign work.

**Assets added:**
- `ui/public/ticker-logos/` — 13 SVG/PNG ticker logos (Mag7 + context instruments).
- `ui/public/openthedesk-mountain-hero-mobile.svg` (168 lines) — mobile hero variant.
- `ui/public/openthedesk-mountain-hero.webp` — confirmed present (118KB).
- `ui/public/openthedesk_mountain_hero.png` + `.svg` — additional hero variants.

**Pre-merge checklist (from backlog):**
- [ ] Confirm 3 ALTER TABLE statements run in prod Supabase (process_review, stop_loss_premium, grade_factors)
- [ ] Verify R-multiple and grade_factors flowing with a real new trade close
- [ ] Signal stream cap at 5 cards confirmed working
- [ ] SessionBar reading real data from /journal/stats
- [ ] `USE_MOCK_CHALLENGE_DATA` flag confirmed removed (grep: zero hits)
- [ ] Challenge status reset to 'active' for 75e1e69c
- [ ] challenge_entries backfill SQL run for test trades
- [ ] End-to-end smoke test on branch before merge

---

## Repository

```
GitHub: github.com/codingwithsatya/openthedesk
Branch: main (auto-deploys to Railway + Vercel on push)
Active feature branch: feature/challenge-page-redesign
  Carries all page redesigns — Challenge, Journal, Analyzer, Desk shell.
  PR #1 raised (feature/challenge-page-redesign → main) — review only,
  NOT merged until all pages verified on branch.
```

### Folder structure

```
openthedesk/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI entry-point — registers all routers, lifespan
│   └── app/
│       ├── __init__.py
│       ├── core/
│       │   ├── auth.py      # Clerk JWT middleware (get_current_user)
│       │   ├── clients.py   # Anthropic + Supabase client singletons
│       │   ├── config.py    # Env var loading (ANTHROPIC_API_KEY, TRADIER_TOKEN, …)
│       │   ├── lifecycle.py # FastAPI lifespan (startup: load context, keep-alive)
│       │   ├── state.py     # Global state (INTERNALS_CACHE, TV_ALERTS, sessions, …)
│       │   └── utils.py     # sanitize(), with_retry(), helpers
│       ├── models/
│       │   ├── analyzer.py  # AnalyzeRequest, QuickAnalyzeRequest
│       │   ├── challenge.py # Challenge Pydantic models
│       │   ├── chat.py      # ChatRequest, RefreshRequest
│       │   └── journal.py   # JournalEntryPayload, JournalUpdatePayload
│       ├── routers/
│       │   ├── analyzer.py  # /analyze, /screener, /watchlist, /quick-analyze
│       │   ├── challenge.py # /challenge/*
│       │   ├── desk.py      # /chat, /premarket, /analyze-chart, /market-data,
│       │   │                #   /morning-brief, /refresh-context, /session/*
│       │   ├── health.py    # /health, /ping, /me
│       │   ├── journal.py   # /journal/*
│       │   └── webhook.py   # /webhook/tv, /internals, /alerts, /alerts/stream,
│       │                    #   /alerts/read-state, /alerts/read
│       └── services/
│           ├── challenge_service.py  # _challenge_build_*, _fetch_challenge_trades
│           ├── chat_service.py       # _detect_journal_intent, _extract_journal_fields,
│           │                         # _save_journal_entry, session history helpers
│           ├── journal_service.py    # journal entry CRUD, process review, R-multiple
│           └── market_service.py     # get_market_summary, get_watchlist_data wrappers
├── main.py              # DELETED — was monolithic 2356-line file; replaced by backend/
├── nixpacks.toml        # Railway: startCommand = /opt/venv/bin/python backend/main.py
├── requirements.txt     # Python dependencies
├── .env                 # API keys (never commit)
├── pine/
│   ├── openthedesk_manual_planner.pine    # Manual Planner v3.3.9
│   ├── openthedesk_atr_clean.pine         # ATR Levels v3.1 Clean Extended
│   └── otd_internals_heartbeat.pine       # OTD Internals Heartbeat v2.2
└── ui/
    └── app/
        ├── page.tsx              # 0DTE Desk — thin orchestrator → DeskShell
        ├── analyzer/page.tsx     # Analyzer — thin orchestrator → feature module
        ├── journal/page.tsx      # Journal — thin orchestrator → feature module
        ├── challenge/page.tsx    # Challenge — thin orchestrator → ChallengeLanding or ChallengeDashboard
        ├── globals.css           # Design tokens + shared styles + glassmorphism
        ├── layout.tsx            # ClerkProvider + auth
        └── components/
            ├── AppIconRail.tsx           # NEW — shared left nav icon rail (all pages)
            ├── AppIconRail.module.css    # NEW — 101 lines
            ├── Header.tsx               # Nav + desk open/closed indicator + SPX price strip
            ├── AlertPanel.tsx           # useAlerts hook + AlertDrawer (SSE) + TradePlan card
            ├── InternalsWidget.tsx      # Live internals widget — polls /internals every 30s
            ├── LevelsPanel.tsx          # ATR levels + 0DTE options sidebar
            ├── ChatPanel.tsx            # Main chat interface + empty state + morning brief
            ├── CommandPalette.tsx       # / commands modal
            ├── QuickActions.tsx         # Quick action buttons — state-aware
            ├── MobileSheet.tsx          # Mobile bottom sheet for levels
            ├── MorningBriefBanner.tsx   # Pinned brief strip
            ├── ChartStrip.tsx           # Timeframe pills + Open Chart button
            ├── SessionBar.tsx           # TD number, trades, P&L, budget used bar
            ├── MobileSignalStream.tsx   # Mobile bottom sheet — signal cards
            ├── SignalStream.tsx         # Permanent right panel — alert cards
            └── StartChallengeModal.tsx  # REMOVED from here — moved to ui/features/challenge/
    └── features/
        ├── desk/
        │   ├── components/
        │   │   ├── DeskShell.tsx        # Main desk layout shell (191 lines)
        │   │   └── DeskWorkspace.tsx    # Desk content area (92 lines)
        │   ├── lib/
        │   │   └── types.ts             # Desk TypeScript interfaces (83 lines)
        │   └── styles/
        │       ├── deskShell.module.css    # 84 lines
        │       └── deskWorkspace.module.css # 15 lines
        ├── analyzer/
        │   ├── components/
        │   │   ├── AnalyzerRightRail.tsx   # 152 lines
        │   │   ├── AnalyzerTickerCard.tsx  # 147 lines
        │   │   ├── FullAnalysisPanel.tsx   # 542 lines
        │   │   ├── QuickAnalysisPanel.tsx  # 249 lines
        │   │   ├── ScreenerColumn.tsx      # 72 lines
        │   │   └── WatchlistPanel.tsx      # 213 lines
        │   ├── lib/
        │   │   ├── helpers.ts              # 153 lines
        │   │   └── types.ts                # 123 lines
        │   └── styles/
        │       ├── AnalyzerDashboard.module.css  # 1105 lines
        │       └── FullAnalysisPanel.module.css  # 661 lines
        ├── journal/
        │   ├── components/
        │   │   ├── JournalCharts.tsx       # 71 lines
        │   │   ├── JournalFilterBar.tsx    # 70 lines
        │   │   ├── JournalSidebar.tsx      # 223 lines
        │   │   ├── JournalStatsCards.tsx   # 72 lines
        │   │   └── JournalTradeTable.tsx   # 428 lines
        │   ├── lib/
        │   │   ├── helpers.ts              # 20 lines
        │   │   └── types.ts                # 54 lines
        │   └── styles/
        │       ├── journalCharts.module.css     # 107 lines
        │       ├── journalFilterBar.module.css  # 99 lines
        │       ├── journalPage.module.css       # 142 lines
        │       ├── journalSidebar.module.css    # 361 lines
        │       ├── journalStats.module.css      # 131 lines
        │       └── journalTradeTable.module.css # 496 lines
        └── challenge/
            ├── components/
            │   ├── ChallengeLanding.tsx        # Pre-start page
            │   ├── ChallengeDashboard.tsx      # Active dashboard — calendar, stats, drawer
            │   ├── ChallengeDayDrawer.tsx      # Day detail slide-in drawer
            │   ├── ChallengeMountainHero.tsx   # Thin wrapper — renders desktop + mobile image
            │   ├── ChallengeRuleCards.tsx      # 6-card rules grid (pre-start)
            │   ├── ChallengeJourney.tsx        # Day 1/30/60/90 timeline (pre-start)
            │   ├── ChallengeBuildCards.tsx     # What You'll Build 4-cards (pre-start)
            │   ├── ChallengeChecklist.tsx      # Before You Start checklist (pre-start)
            │   └── StartChallengeModal.tsx     # Moved from ui/app/components/
            ├── lib/
            │   ├── types.ts                    # All shared TypeScript interfaces
            │   └── helpers.ts                  # gradeClass, gradeColor, fmtPnl, fmtDate,
            │                                   # addWeekdays, buildMonthGrid, MONTH_NAMES
            └── styles/
                ├── challengePage.module.css    # Page shell only
                ├── challengeLanding.module.css # Pre-start page styles
                ├── challengeDashboard.module.css # Active dashboard styles
                ├── mountainHero.module.css     # Desktop/mobile image switching
                └── StartChallengeModal.module.css
```


---

## Infrastructure

| Service       | Platform      | URL / Notes                                                                                          |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend      | Vercel        | https://openthedesk.vercel.app                                                                       |
| Backend       | Railway       | https://openthedesk-production.up.railway.app                                                        |
| Auth          | Clerk         | Google sign-in, single user (Satya)                                                                  |
| LLM           | Anthropic API | claude-sonnet-4-6 + claude-haiku-4-5-20251001                                                        |
| Market data   | Tradier       | api.tradier.com/v1 (production brokerage)                                                            |
| Fundamentals  | yfinance      | Mag7 + context instruments + ^SPX intraday (^SPX symbol works)                                       |
| Trading rules | Google Doc    | Fetched via context.py on startup                                                                    |
| Observability | LangSmith     | wrap_anthropic() at startup                                                                          |
| Database      | Supabase      | live, 5 tables (trade_journal, tv_alerts, user_sessions, challenges, challenge_entries, alert_reads) |

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
CLERK_JWT_ISSUER=        # Live
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

## Backend — backend/app/ (modular structure)

**The monolithic `main.py` (2356 lines) has been deleted.** The backend is now structured as:

- `backend/main.py` — FastAPI entry-point, registers all routers, lifespan
- `backend/app/core/` — auth, clients, config, lifecycle, state, utils
- `backend/app/models/` — Pydantic models per domain
- `backend/app/routers/` — endpoint handlers per domain
- `backend/app/services/` — business logic per domain

**Run command (local):** `uvicorn backend.main:app --reload` from project root
**Railway deploy:** `railway.toml` (replaces nixpacks.toml — railpack v0.30.0 ignores nixpacks.toml):
```toml
[deploy]
startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
```
Note: `python backend/main.py` fails on Railway because `/app/backend/` is the working directory, making `backend` unresolvable as a package. Uvicorn runs from `/app` (project root) so the import path resolves correctly.

### Pydantic models

```python
ChatRequest:           message, session_id, atr (optional)
RefreshRequest:        session_id
AnalyzeRequest:        ticker, trading_mode (day|multiday|swing|position)
QuickAnalyzeRequest:   ticker, price, ribbon_state, compression, po_value,
                       call_trigger, put_trigger, gg_open_call, gg_open_put,
                       atr_14, change_pct
JournalEntryPayload:   date, ticker, setup, direction,
                       entry_price, entry_premium (optional),
                       exit_price (optional), exit_premium (optional),
                       contracts, pnl (optional), grade (optional),
                       process_grade (optional), notes (optional),
                       status ("open"|"closed", default "open"),
                       stop_loss_premium (optional, numeric) — NEW, captured
                       from originating tv_alerts.sl at trade-open time,
                       enables real R-multiple calculation
JournalUpdatePayload:  exit_price, exit_premium, entry_premium,
                       pnl, grade, process_grade, notes, status (all optional)
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
GET  /journal/entries         → fetch journal entries (Clerk JWT required) — NOW post-processes r_multiple on every row (null if stop_loss_premium absent)
GET  /journal/stats           → journal statistics (Clerk JWT required)
PATCH /journal/entry/{id}  → update journal entry (Clerk JWT required)
POST /challenge/start         → create active challenge (Clerk JWT required)
GET  /challenge/status        → active challenge + day_number (Clerk JWT required)
GET  /challenge/stats         → full stats: calendar, grades, lessons, equity (Clerk JWT required) — equity field added this session, additive
GET  /challenge/all           → all challenges with stats (Clerk JWT required)
GET  /challenge/day/{date}    → NEW this session — real per-day trade detail: setup, direction, entry/exit premium, contracts, pnl, grade, process_grade, notes, stop_loss_premium, r_multiple, grade_factors, day total P&L, balance after (Clerk JWT required; 400 if date < start_date, 404 if no active challenge)
GET  /session/{id}/history    → session chat history for frontend restore (Clerk JWT required)
GET  /alerts/read-state       → fetch read IDs for user (Clerk JWT required)
POST /alerts/read             → upsert read IDs (Clerk JWT required)
POST /journal/review/{id}     → manual re-run process review (Clerk JWT required) — STATUS UNCERTAIN, see Known Bugs #54
```

### Global state (backend/app/core/state.py)

```python
INTERNALS_CACHE: dict   # Latest internals snapshot from TV heartbeat (in-memory, intentional)
TV_ALERTS: list[dict]   # In-memory cache only — source of truth is Supabase tv_alerts
FLOW_CONTEXT: str       # Latest unusual flow — injected into /chat
LIVE_CONTEXT: str       # Google Doc content — loaded at startup
sessions: dict          # In-memory fallback only — source of truth is Supabase user_sessions
```

### Supabase client (backend/app/core/clients.py)

```python
from supabase import create_client, Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
# Service role key — bypasses RLS for all backend writes
# Initialized at startup with graceful fallback to in-memory if env vars missing
```

### Clerk JWT middleware (backend/app/core/auth.py)

```python
async def get_current_user(authorization: str = Header(...)) -> str:
    token = authorization.replace("Bearer ", "")
    payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["RS256"])
    user_id = payload.get("sub")  # Clerk user ID — always from token, never request body
    return user_id

# Applied to: /chat, /refresh-context, DELETE /session,
#             /journal/entry, /journal/entries, /journal/stats,
#             /morning-brief, /challenge/*
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
# 5-factor grade_factors Haiku call: use same project-wide floor as
# _extract_journal_fields() (512) — do not go lower
```

### Chat → journal intent detection

```python
# In /chat, before routing to Claude:
# 1. _is_command_message() — skip if known command prefix
# 2. _detect_journal_intent() — Haiku YES/NO, max_tokens=64
# 3. _extract_journal_fields() — Haiku JSON extraction, max_tokens=512
# 4. _save_journal_entry() — writes to Supabase + in-memory
# Returns "Logged - GG Bear - Entry 7390 - Exit 7378 - +$1,200 - TRIN 1.62"
```

### Morning Brief — /morning-brief

```python
# Runs three parallel operations:
# 1. get_market_summary() — SPX/VIX/ATR levels
# 2. get_watchlist_data() x 9 tickers — Mag7 + SPY/QQQ (asyncio.gather)
# 3. _fetch_market_news() — 3 parallel Haiku web searches:
#    - Economic calendar today (HIGH/MED impact USD events)
#    - Premarket gap ups/downs
#    - Catalyst news

# Output format (rose.trading style):
# MARKET TONE
# MORNING BIAS
# GAP UPS / GAP DOWNS
# US ECONOMIC CALENDAR
# VOLATILITY FLAGS (FOMC/CPI/NFP rules hardcoded)
# CATALYST NEWS
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

# Frontend: runMorningBrief() calls POST /morning-brief directly
# Reads data.morning_brief from JSON response
# Sets briefLoading state — button shows "Preparing Brief..."
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

### Challenge per-day calendar/equity helpers (backend/app/services/challenge_service.py)

```python
# _challenge_build_calendar(trades, start_date) — main.py
# Builds the per-day calendar/streak view. FIXED this session: now
# anchored consistently to challenges.start_date as the single source of
# truth for "day number" everywhere (hero banner, streak grid, dock
# panel TD labels). A trade dated BEFORE start_date does NOT get a
# numbered day in this view — it can still count toward lifetime
# aggregate stats (total P&L, trade count) if that's the existing
# pattern, but never appears as a streak-grid cell or calendar tile.
# This was a deliberate product decision (Day 1 = official start_date,
# always) — NOT a bug if older linked trades disappear from the
# per-day view after this fix.

# _challenge_build_equity(trades, start_balance) — main.py, NEW
# Groups trades by date (all dates, no weekday filter), sorts
# chronologically, returns [{date, pnl, balance}] with running balance.
# Powers the real equity chart in /challenge/stats response (equity field).

# _compute_r_multiple(entry_premium, exit_premium, stop_loss_premium) — NEW
# risk = entry_premium - stop_loss_premium
# r_multiple = (exit_premium - entry_premium) / risk
# Returns null if stop_loss_premium is null or risk <= 0 (handles
# zero-risk / missing-data edge cases explicitly, does not raise)
```

---

## Frontend — Desk (ui/features/desk/ + ui/app/page.tsx)

`ui/app/page.tsx` is now a thin orchestrator — it manages desk state and delegates rendering to `DeskShell` and `DeskWorkspace` from `ui/features/desk/`.

### Three-column terminal layout

```
+-------------+----------------------+--------------+
|  LEFT       |  CENTER              |  RIGHT       |
|  180px      |  flex: 1             |  260px       |
|             |                      |              |
|  LevelsPanel|  ChartStrip (36px)   |  SignalStream|
|  (ATR +     |  SessionBar (32px)   |  (permanent  |
|   Internals |  ChatPanel (flex)    |   alert      |
|   + Options)|  QuickActions        |   cards)     |
|             |  ChatInput           |              |
+-------------+----------------------+--------------+

CSS classes:
.otd-layout   → height:100dvh, flex column
.otd-columns  → grid 180px 1fr 260px
.otd-center   → flex column, min-height:0
.otd-left     → bg-card, border-right, overflow-y:auto
.signal-stream → bg-card, border-left, flex column
```

**Note: this layout and Header.tsx are deliberately NOT part of the
Challenge page redesign work. Desk is the live trading view — high risk
to touch casually. Header.tsx/Desk shell redesign is a planned, separate,
later task once the new shell pattern is proven stable on Challenge.**

### Morning Brief Banner

```
Pinned strip below header — visible after brief is run
Shows: bias badge | Mag7 alignment | warning | Bull/Bear levels | Full Brief link
Parsed from last assistant message containing "MARKET BIAS:"
CSS: .brief-banner, .brief-bias-badge, .brief-mag7, .brief-warning-pill
```

### ChartStrip

```
Always-visible 36px strip at top of center column
- Timeframe pills: 1m 3m 5m 15m 1H
- "Open Xm Chart" button → opens TradingView saved layout
  URL: https://www.tradingview.com/chart/4sntynIK/?interval={tf}
- NO iframe embed — TradingView blocks SP:SPX in iframes

NOTE: TradingView Charting Library application submitted.
When approved, replace button with full embedded chart.
Chart layout ID: 4sntynIK (Satya's saved SPX layout)
```

### AppIconRail (ui/app/components/AppIconRail.tsx)

```
Shared left nav icon rail — used across Desk, Analyzer, Journal, Challenge pages.
84 lines. CSS module: AppIconRail.module.css (101 lines).
Replaces per-page icon rails (ChallengeIconRail is now superseded by this).
Icons link to /desk, /analyzer, /journal, /challenge.
Active page highlighted. Collapse toggle pinned at bottom.
```

### SessionBar

```
32px bar showing: TD{number} | Trades 0/3 | P&L +$0 | W/L | Loss limit bar
Data: currently defaults (0) — real data from /journal/stats planned next session
```

### SignalStream

```
Permanent right panel — 260px wide
Uses same useAlerts hook as AlertPanel (same SSE connection, not duplicated)
Shows: last 8 alerts newest first
Each SignalCard:
- Setup pill (colored by direction)
- Grade pill
- Time
- Price (large monospace)
- T1/T2/T3/SL 2x2 grid
- Internals pills (TRIN/ADD colored)
- [Took] [Skip] for ENTRY signals from TODAY only (isActionable gate — older un-actioned ENTRY alerts show as info-only cards, no buttons)
- Older alerts fade to 50% opacity
Footer: Today's P&L and trades count
```

### MobileSignalStream

```
Mobile-only bottom sheet, triggered by 4th bottom-nav tab "Signals"
(alongside Chat / Levels / Commands)
Receives same alerts/isUnread/markRead props from page.tsx — reuses the
existing useAlerts SSE connection, no duplicate subscription
Capped at 5 cards (vs desktop's 8)
Priority: any active (unlogged, unskipped) ENTRY alert from TODAY is
always included in the 5, even if newer non-ENTRY alerts from other
tickers would otherwise push it out
Same-day actionability gate (shared concept with desktop SignalCard):
- isActionable = isEntry && isFromToday(alert.ts)
- Took/Skip and entry-premium form only render if isActionable
- Older ENTRY alerts (not from today) show as informational cards only
  (price, T1/T2/T3/SL, internals) — no buttons, since logging them now
  would create a journal entry with a misleading date
- "today" = browser-local date (fine for CST; would need ET-based check
  if used heavily from other timezones)
formatRelative rolls over to days ("3d") past 24h, on both mobile and
desktop SignalStream
```

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
//   1. setBriefLoading(true) → button shows "Preparing Brief..."
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
DESK CLOSED: [Morning Brief] [Open the Desk — disabled if market closed]
DESK OPEN:   [PTR-FAST] [PREMARKET] [/ Commands] [Close Desk]
```

### Hydration fix

```typescript
// Both Header.tsx and QuickActions.tsx use:
const [mounted, setMounted] = useState(false);
useEffect(() => {
  setMounted(true);
}, []);

// All deskOpen-dependent rendering uses (mounted && deskOpen)
// suppressHydrationWarning on affected elements
// Prevents SSR/client mismatch on localStorage-based state
```

---

## Frontend — Analyzer (ui/features/analyzer/ + ui/app/analyzer/page.tsx)

`ui/app/analyzer/page.tsx` is now a thin orchestrator. All Analyzer components, types, helpers, and styles live in `ui/features/analyzer/`.

### WatchlistPanel (ui/features/analyzer/components/WatchlistPanel.tsx)

```typescript
// Fetches GET /watchlist on mount
// Two sections: "Mag 7" and "Market Context"
// TickerCard — glassmorphism, ribbon glow, compression ring
// Click card → expands inline (card-expand CSS animation, max-height: 1200px)
// Quick Read loads from /quick-analyze on first expand
// Cached per ticker — no re-fetch on re-expand
// "Full Analysis" button → triggers existing analyze() flow
// Only one card expanded at a time
// alignSelf: "start" on each card — prevents grid stretching
```

### Full Analysis result card

```
Dark terminal theme (#0a0e17)
- Top ribbon glow line (green BULLISH / red BEARISH)
- Header: ticker, price, ribbon badge with glow, badges
- Levels strip: horizontal chips, near-price highlighted yellow
- Two panels side by side:
  Left (Haiku): blue accent, "0DTE - Options Trade Plan"
  Right (Sonnet): purple accent, "Stock Analysis - Long-Term"
- MarkdownText: LABEL: bold white, values colored green/red,
  ## headers as uppercase dividers, $prices cyan, **bold** white
- Fundamentals strip: dark, monospace values
- EMA strip: darkest, muted values
```

---

## Challenge Page — COMPLETED this session

### Design lock — June 22, 2026

**The default Challenge page (pre-start and active dashboard) is design-locked.**
Allowed future work: real-device QA, spacing cleanup, mobile overflow fixes,
SVG loading/path fixes, minor responsive adjustments, font-size or padding polish, bug fixes only.
Not allowed without explicit request: new layout concepts, new section redesign,
major visual changes, replacing the current hero approach, adding large SVG text labels,
changing the overall page structure.

Desktop: done. Mobile: ships as-is; QA on real iPhone/Android is the next step.

### What shipped this session

**Architecture — feature module refactor (June 22):**
- Challenge code moved from monolithic `ui/app/challenge/page.tsx` into a
  proper feature module at `ui/features/challenge/`. page.tsx is now a thin
  orchestrator (~75 lines): fetches /challenge/stats + /challenge/all, then
  renders ChallengeLanding (if !active) or ChallengeDashboard (if active).
- CSS moved from globals.css into scoped CSS modules per component. This is
  the pattern going forward for all Challenge work.
- All shared TypeScript interfaces centralized in `lib/types.ts`.
- All shared utility functions centralized in `lib/helpers.ts`.

**ChallengeDashboard (active state) — ui/features/challenge/components/ChallengeDashboard.tsx:**
- Full-width 7-column calendar; P&L + grade badge per cell; colored borders
  for win/loss days; muted no-trade days.
- Stat panels, equity sparkline (SparkLine component), donut grade chart
  (DonutChart component), streaks, session stop tracking.
- Day click opens ChallengeDayDrawer.

**Day Detail Drawer (ChallengeDayDrawer.tsx) — replaces the old docked panel AND
the inline expansion that was built earlier this same session, which it superseded:**
- 2-row KPI grid: Day P&L / Process Grade / Trades (row 1), Win Rate / Avg R /
  Session Stop (row 2).
- Per-trade cards (not a table): setup, direction, entry→exit premium, R-multiple,
  P&L, grade.
- Notes section uses actionable empty states ("+ Add what went well" /
  "+ Add one improvement" / "+ Add journal note") — NOT AI-categorized lists;
  AI categorization is still unbuilt (see Still Open below).
- Sticky footer: View Full Journal / Edit Notes.

**Hero art — mountain asset (confirmed, latest):**
- **Active asset:** `ui/public/openthedesk-mountain-hero.webp` — converted from SVG to WebP for performance.
- **Deleted:** `ui/public/openthedesk-mountain-hero.svg` — removed in commit 11369c5.
- **Still on disk (unused):** `ui/public/openthedesk-mountain-hero-mobile.svg`, `ui/public/openthedesk_mountain_hero.svg` (underscore legacy), `ui/public/openthedesk_mountain_hero.png`.
- `ChallengeMountainHero.tsx` (~20 lines, simplified): single `<Image>` with `fill` + `sizes="100vw"`.
  No props, no dayNumber, no dynamic overlay. Fully static.
- `mountainHero.module.css` handles all responsive behaviour via `object-position` at breakpoints:
  - Default: `center center`, opacity 0.95
  - ≤1180px: `62% center`, opacity 0.88
  - ≤900px (tablet): `64% center`, opacity 0.82
  - ≤540px (mobile): `62% bottom`, opacity 0.38, scale(1.02) — intentionally faint on mobile
- Mobile mountain intentionally subtle at opacity 0.38 — design decision, not a bug.
  Remove from "Still Open" — resolved.

**ChallengeDashboard (active state) — ui/features/challenge/components/ChallengeDashboard.tsx (821 lines):**
- Full-width 7-column calendar; P&L + grade badge per cell; colored borders for win/loss days; muted no-trade days.
- Stat cards with inline sparklines (`SparkLine` sub-component), donut grade chart (`DonutChart` sub-component), streaks, session stop tracking.
- Day cell click fetches `/challenge/day/{date}` and opens `ChallengeDayDrawer`.
- ChallengeMountainHero import is commented out on this component — mountain only shown on landing page.

**ChallengeLanding (pre-start) — ui/features/challenge/components/ChallengeLanding.tsx (132 lines):**
- Hero: trophy badge + title + subtitle + Start CTA + Saty quote (left); ChallengeMountainHero (right).
- Sections: ChallengeRuleCards, ChallengeJourney, ChallengeBuildCards, ChallengeChecklist, Past Challenges list.
- Calls `onStart()` prop → page.tsx shows StartChallengeModal.

**ChallengeDayDrawer — ui/features/challenge/components/ChallengeDayDrawer.tsx (720 lines):**
- Slide-in drawer for selected calendar day.
- KPI grid: Day P&L, Process Grade, Trades, Win Rate, Avg R, Session Stop.
- Per-trade cards with process_review text. Notes saved via PATCH `/journal/entry/{id}`.
- NOTE: defines local interfaces (DrawerTrade, DrawerDayDetail, CalendarDay) that partially
  duplicate lib/types.ts — not a bug, worth consolidating in a future cleanup.

**Sub-components (pre-start sections):**
- `ChallengeRuleCards.tsx` (135 lines) — 6-card rules grid
- `ChallengeJourney.tsx` (84 lines) — Day 1/30/60/90 vertical timeline
- `ChallengeBuildCards.tsx` (106 lines) — What You'll Build 4-card grid
- `ChallengeChecklist.tsx` (90 lines) — Before You Start commitments
- `ChallengeIconRail.tsx` (79 lines) — Left nav rail, 7 items
- `StartChallengeModal.tsx` (235 lines) — moved from ui/app/components/ to ui/features/challenge/components/.
  **Redesigned in commit a8da097.** Form fields: challenge name (text), starting
  balance (number, default $500), monthly target (number, default $1000).
  Commit box: "You are committing to 90 trading days." POSTs to `/challenge/start`
  with `{ name, start_balance, monthly_target }`. CSS module: 447 lines
  (StartChallengeModal.module.css) — full glassmorphism modal with blur backdrop.
- Dynamic overlay (`ChallengeMountainHero.tsx`) samples the same path via
  3-segment polybezier evaluated with de Casteljau interpolation: 4 fixed
  milestones at t=0/⅓/⅔/1 (segment endpoints), "today" marker at
  t = day_number / target_days. No flag drawn in overlay — background has it.
- CSS: `.cmh-bg { object-fit: cover; object-position: right top }` matches the
  static SVG's `xMaxYMin slice`; overlay SVG uses the same `preserveAspectRatio`.

**Backend additions to /challenge/stats (additive, non-breaking):**
- `avg_process_grade` — nullable float via `_PROCESS_GRADE_SCORES` /
  `_GRADE_RANK` + `_best_grade_of()`.
- `streaks` — via `_challenge_build_streaks()`.
- `grade_breakdown` — via `_challenge_build_grade_breakdown()`.

**Backend additions to /challenge/day/{date} (additive):**
- `win_rate` — day-level win percentage.
- `avg_r_multiple` — null-safe (null when trades lack `stop_loss_premium`).

**New endpoint — GET /challenge/all:**
- Returns all challenges for the user with computed stats per challenge.
- Calls `_fetch_challenge_trades(challenge_id, user_id)` for each: queries
  `challenge_entries` for source_entry_ids, then JOINs `trade_journal`.
- If `challenge_entries` has no rows → source_ids empty → trades [] → $0/0 stats.
  This is the confirmed root cause of Past Challenges showing +$0/0.
- Used by `page.tsx` on mount (Promise.all with /challenge/stats).
- Client-side filter: `status !== "active"` to populate Past Challenges list.

**New endpoint — POST /journal/review/{entry_id}:**
- Triggers Haiku process review; writes to `trade_journal.process_review`.

**New endpoint — GET /journal/entries:**
- Returns all closed journal entries for the user.

**`_fetch_challenge_trades(challenge_id, user_id)` — confirmed join logic:**
```python
# 1. SELECT source_entry_id FROM challenge_entries WHERE challenge_id = X
# 2. If source_ids empty → return []   ← root cause of $0/0 bug
# 3. SELECT * FROM trade_journal WHERE id IN (source_ids)
#    AND user_id = Y AND status = 'closed'
```

**USE_MOCK_CHALLENGE_DATA** — confirmed fully removed (grep: zero hits). Was a
developer-only testing flag; never part of any feature.

**Previously shipped (prior session — preserved here for continuity):**
- Shell components scoped to Challenge ONLY: ChallengeIconRail.tsx, ChallengeMountainHero.tsx.
  NOTE: ChallengeTopNav.tsx was documented in the arch doc but never existed
  in the codebase — the active state uses the global Header.tsx instead.
- Day-numbering single source of truth: **Day 1 = challenges.start_date**,
  computed once, used everywhere. Trades before start_date are excluded from
  the per-day view.
- Equity chart: `_challenge_build_equity()` + equity field on /challenge/stats.
- Per-day trade detail endpoint: GET /challenge/day/{date}.
- R-multiple + 5-factor AI grading: SQL columns confirmed added this session
  (process_review, stop_loss_premium, grade_factors) — no longer inert. The
  5 pre-existing test trades still return null for these fields since they
  predate the columns; new trades going forward will populate them.
  ```sql
  ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS process_review text;
  ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS stop_loss_premium numeric;
  ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS grade_factors jsonb;
  ```
- Real test data in production Supabase (NOT mock): 5 trades,
  user_id = 'user_3Dj1ZD4C2zOR6HMltK34mSMAE6m',
  challenge_id = '75e1e69c-3576-404f-84b2-54f77976fc80',
  dates: June 11 (Thu), 12 (Fri), 15 (Mon), 16 (Tue, 2 trades), 17 (Wed).
  Ground truth: Total P&L +$250, 60% win rate (3W/2L),
  equity curve 500→600→550→500→700→750.

### Still open — NOT done

- **challenge_entries backfill for test data** — 5 real trades exist in trade_journal but
  no rows in challenge_entries link them to challenge 75e1e69c. Past Challenges shows +$0/0.
  DO NOT backfill yet — test data only. SQL ready when needed:
  ```sql
  INSERT INTO challenge_entries (challenge_id, source_entry_id, user_id, day_number)
  SELECT '75e1e69c-3576-404f-84b2-54f77976fc80', tj.id, tj.user_id,
    ROW_NUMBER() OVER (ORDER BY tj.date, tj.created_at)
  FROM trade_journal tj
  WHERE tj.user_id = 'user_3Dj1ZD4C2zOR6HMltK34mSMAE6m'
    AND tj.date >= '2026-06-11'
  ORDER BY tj.date, tj.created_at;
  ```
- **Challenge status must be reset to active before next session:**
  ```sql
  UPDATE challenges SET status = 'active'
  WHERE id = '75e1e69c-3576-404f-84b2-54f77976fc80';
  ```
- **ChallengeDayDrawer local types duplicate lib/types.ts** — DrawerTrade, DrawerDayDetail,
  CalendarDay defined locally. Minor cleanup, not a bug.
- **ChallengeMountainHero dayNumber prop unused** — prop exists but `_: Props` ignores it.
  No dynamic overlay is drawn. Hook here if progress tracking on the mountain is ever wanted.
- **Intraday equity curve in the drawer** — no real per-minute price data
  exists; still not built. Requires a separate, larger project for granular
  price history storage.
- **AI-categorized process review** ("went well"/"improve" as Haiku-generated
  lists) — replaced with manual empty-state entry for now; the AI
  categorization itself is still not built.
- **Whether the notes empty-state buttons actually save to the backend** — confirm
  explicitly before claiming live; don't assume from UI appearance.
- **Tags** — still not built; per-trade vs. per-day still undecided.
- - **Mobile mountain** — intentionally at opacity 0.38 on mobile (design decision in mountainHero.module.css, commit a8da097). Resolved.
- **Past Challenges showing +$0 / 0 trades** — data linkage bug. The pre-start page shows the test challenge with zero stats despite real trades existing. Diagnose with:
  ```sql
  SELECT * FROM challenge_entries WHERE challenge_id = '75e1e69c-3576-404f-84b2-54f77976fc80';
  ```
  If rows exist → stats query is filtering wrong. If no rows → entries were never linked to this challenge_id.
- **Grade Breakdown popup** (5-factor radar + 10-day grade history bar chart)
  — the grade_factors column now exists; blocked on the popup itself not
  being designed/built, and on having enough real graded trades to populate
  a meaningful radar.
- **`--ch-green`/`--ch-red`/`--ch-blue`/`--ch-warning`** — whether these
  duplicate pre-existing color tokens not confirmed either way.

### Asset convention — confirmed followed

**Standing rule: all image/SVG/PNG assets belong in ui/public/, referenced by
path — never inlined as markup in component code.**

The mountain hero migration is now confirmed complete (verified via file listing
and grep). This was attempted once before and falsely reported as done; the
confirmation pattern that works: show actual grep/file-listing output before
claiming completion.

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
-- June 10 additions:
-- status text DEFAULT 'closed'        ("open" | "closed")
-- entry_premium numeric               (options premium paid)
-- exit_premium numeric                (options premium sold)
-- exit_price, pnl, grade made NULLABLE for open trades
-- P&L formula: (exit_premium - entry_premium) x contracts x 100
-- June 17 additions (code complete, columns NOT YET added — run manually):
-- process_review text                 (free-text Haiku-generated review)
-- stop_loss_premium numeric           (captured from tv_alerts.sl at trade-open; enables real R-multiple)
-- grade_factors jsonb                 ({"setup_quality":4.5,"execution":4.0,"risk_management":4.0,"trade_management":4.5,"mindset_discipline":4.0}) — Haiku-scored 5-factor breakdown, 0-5 each
-- ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS process_review text;
-- ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS stop_loss_premium numeric;
-- ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS grade_factors jsonb;
-- All three nullable/additive — existing rows unaffected, code already handles null gracefully at every read site

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
-- sl field is the source for trade_journal.stop_loss_premium capture

user_sessions (
  user_id text,
  session_id text,
  history jsonb,           -- full message array
  updated_at timestamptz,
  PRIMARY KEY (user_id, session_id)
)
-- RLS: user_id = auth.jwt()->>'sub'

challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  start_date date NOT NULL,
  start_balance numeric NOT NULL DEFAULT 500,
  target_days int NOT NULL DEFAULT 90,
  status text NOT NULL DEFAULT 'active',
  name text DEFAULT '90-Day Challenge',
  monthly_target float DEFAULT 1000,
  created_at timestamptz DEFAULT now()
)
-- RLS: user_id = auth.jwt()->>'sub'
-- start_date is now the SINGLE SOURCE OF TRUTH for "day number" across
-- the entire Challenge page (hero banner, streak grid, dock panel TD
-- labels) — fixed this session, was previously inconsistent across files
-- No "end/cancel challenge" endpoint exists yet. For testing, status can
-- be hand-edited in Supabase Table Editor. A real "End Challenge" /
-- STATUS NOTE (June 22): challenge 75e1e69c was set to "paused" during
-- pre-start page testing. Reset to "active" before next trading session:
--   UPDATE challenges SET status = 'active'
--   WHERE id = '75e1e69c-3576-404f-84b2-54f77976fc80';
-- "Finish Challenge" button (status change, NOT row deletion — history
-- must be preserved for future reference) is a deliberately deferred
-- real feature, not yet built, not urgent for current testing phase.

challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  source_entry_id uuid NOT NULL,  -- FK to trade_journal.id
  user_id text NOT NULL,
  day_number int NOT NULL,
  created_at timestamptz DEFAULT now()
)
-- RLS: user_id = auth.jwt()->>'sub'
-- Reference-only linking table — NO duplicated trade fields
-- All trade data queried via JOIN on source_entry_id → trade_journal.id

alert_reads (
  user_id text PRIMARY KEY,
  read_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
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
Manual Planner v3.3.9    → ENTRY/TARGET/TRAIL/STOP/EXIT alerts
                            Sends: ticker, timeframe, condition, price,
                                   entry, t1, t2, t3, sl, trail_sl,
                                   setup, grade, direction, signal,
                                   atr_level, secret
                            atr_level included on ENTRY, T1 HIT, T2 HIT,
                            T3 HIT, and RUNNER NEXT HIT (v3.3.9) — other
                            alert types (STOP, INVALIDATED, REVERSAL EXIT,
                            RUNNER AFTER T3, RUNNER MAX TARGET, TRAILING SL
                            UPDATED) do not carry atr_level
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

### Chart integration status

```
TradingView embed: BLOCKED — SP:SPX not available in any free widget
  - advanced-chart widget: blocked
  - widgetembed iframe: blocked
  - saved layout iframe: blocked (X-Frame-Options)

Workaround in place: ChartStrip "Open Chart" button
  → opens https://www.tradingview.com/chart/4sntynIK/?interval={tf}
  → loads Satya's saved SPX layout with Manual Planner + ATR levels

TradingView Charting Library: APPLICATION SUBMITTED June 8, 2026
  → awaiting approval (2-5 business days)
  → will enable full SP:SPX embed with Cboe real-time data
  → Satya has: Premium plan + Cboe Global Indices Feed + CME Group

yfinance SPX data: ^SPX symbol works (NOT ^GSPC)
  → hist = yf.Ticker("^SPX").history(interval="5m", start=..., end=...)
  → returns 78 bars for a trading day
  → available for Lightweight Charts bridge build when ready
  → NOTE: this is still just daily/intraday bar history for SPX, not a
    per-trade granular tick feed — the Challenge page's planned intraday
    equity curve (Day Detail popup) would need something more granular
    than this and is scoped as a separate future project
```

### Ticker logo assets

```
ui/public/ticker-logos/
  aapl.svg, amzn.svg, googl.svg, meta.svg, msft.svg,
  nvda.svg, qqq.svg, smh.svg, spy.svg, tsla.svg (+ tsla.png),
  xlf.svg, xlk.svg

Used by AnalyzerTickerCard and WatchlistPanel.
Referenced as /ticker-logos/{ticker.toLowerCase()}.svg.
TSLA has both SVG and PNG — SVG preferred; PNG fallback.
```

**nixpacks.toml** — updated `startCommand` to `/opt/venv/bin/python backend/main.py` (was `python main.py`).

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
           Click Morning Brief
           → Market tone, gap ups/downs, economic calendar
           → Volatility flags (FOMC/CPI/NFP auto-detected)
           → Mag7 alignment, SPX levels, TODAY'S PLAN
           → RISK LEVEL

~9:25 ET  "Open the Desk" becomes active (green)
           Click it → session opener runs automatically
           Header: DESK OPEN + session timer starts

9:30+ ET  TradingView alerts → Signal Stream right panel fills
           Click "Open Chart" → TradingView opens in new tab
           PTR-FAST before any entry
           Take trade
           "took GG Bear at 7390, exited 7378" → auto-journals
           Take trade → [Took] on signal card → enter entry premium → saves as OPEN
           Exit trade → /journal → Close Trade → enter exit premium → P&L computed

4:00 PM   Desk auto-closes at 4:15 ET
           EOD runs automatically
           Check /journal page
```

---

## Known Bugs Fixed — Do Not Repeat

| #   | Bug                                                                                                                                                                                                                                                                               | Fix                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tradier /options/ → 302                                                                                                                                                                                                                                                           | Always /markets/options/ prefix                                                                                                                                                                                                                                                                        |
| 2   | yfinance NaN → json crash                                                                                                                                                                                                                                                         | sanitize() before every return                                                                                                                                                                                                                                                                         |
| 3   | Ribbon wrong EMAs                                                                                                                                                                                                                                                                 | 8/21/34 not 8/21/48                                                                                                                                                                                                                                                                                    |
| 4   | options_chain always null                                                                                                                                                                                                                                                         | Call get_options_chain_for_analysis() in US block                                                                                                                                                                                                                                                      |
| 5   | Analyzer response cut off                                                                                                                                                                                                                                                         | max_tokens Haiku=2048, Sonnet=1536                                                                                                                                                                                                                                                                     |
| 6   | Railway port not bound                                                                                                                                                                                                                                                            | nixpacks.toml + read PORT from env                                                                                                                                                                                                                                                                     |
| 7   | Git submodule in ui/                                                                                                                                                                                                                                                              | Delete ui/.git before git add                                                                                                                                                                                                                                                                          |
| 8   | System env overrides .env                                                                                                                                                                                                                                                         | unset ANTHROPIC_API_KEY in terminal                                                                                                                                                                                                                                                                    |
| 9   | 0DTE picking deep ITM                                                                                                                                                                                                                                                             | Delta filter → budget → ATR target cascade                                                                                                                                                                                                                                                             |
| 10  | TV webhook header blocked                                                                                                                                                                                                                                                         | Accept secret from body OR header                                                                                                                                                                                                                                                                      |
| 11  | Alert badge auto-clearing                                                                                                                                                                                                                                                         | Remove markAllRead() from bell onClick                                                                                                                                                                                                                                                                 |
| 12  | No Anthropic timeouts                                                                                                                                                                                                                                                             | Two clients: 60s + 120s                                                                                                                                                                                                                                                                                |
| 13  | Railway cold starts                                                                                                                                                                                                                                                               | \_keep_alive() background task                                                                                                                                                                                                                                                                         |
| 14  | Missing retry on 529                                                                                                                                                                                                                                                              | with_retry() on all Claude calls                                                                                                                                                                                                                                                                       |
| 15  | setup/grade/direction missing                                                                                                                                                                                                                                                     | Added to alert dict from raw payload                                                                                                                                                                                                                                                                   |
| 16  | markRead marking all above                                                                                                                                                                                                                                                        | Set<string> readIds replaces lastSeenId                                                                                                                                                                                                                                                                |
| 17  | Accent bar not visible                                                                                                                                                                                                                                                            | alignSelf:stretch child div                                                                                                                                                                                                                                                                            |
| 18  | ATR not passing to snapshot                                                                                                                                                                                                                                                       | Pass atr param through all callers                                                                                                                                                                                                                                                                     |
| 19  | Pine Script plot limit                                                                                                                                                                                                                                                            | hex const colors = 48 plots total                                                                                                                                                                                                                                                                      |
| 20  | V triangle firing in green cloud                                                                                                                                                                                                                                                  | cloud_bull = ema8>=ema21 AND ema21>=ema34                                                                                                                                                                                                                                                              |
| 21  | GG not firing at open                                                                                                                                                                                                                                                             | Two-tier cloud gate + PO bypass                                                                                                                                                                                                                                                                        |
| 22  | Wrong ATR key names                                                                                                                                                                                                                                                               | gg_complete_call/put confirmed                                                                                                                                                                                                                                                                         |
| 23  | TV webhook 422 Pydantic                                                                                                                                                                                                                                                           | Raw Request body — no Pydantic model                                                                                                                                                                                                                                                                   |
| 24  | Internals NaN card in drawer                                                                                                                                                                                                                                                      | SSE guard: if alert.type==="internals" return                                                                                                                                                                                                                                                          |
| 25  | Internals 422 from TV                                                                                                                                                                                                                                                             | Raw Request body in \_handle_internals                                                                                                                                                                                                                                                                 |
| 26  | Backend recalculating levels                                                                                                                                                                                                                                                      | Pine sends T1/T2/T3/SL — use directly                                                                                                                                                                                                                                                                  |
| 27  | yfinance TRIN broken                                                                                                                                                                                                                                                              | get_market_internals() returns None — TV heartbeat is source                                                                                                                                                                                                                                           |
| 28  | /webhook/internals separate                                                                                                                                                                                                                                                       | Consolidated into /webhook/tv router                                                                                                                                                                                                                                                                   |
| 29  | Internals bias field dropped                                                                                                                                                                                                                                                      | \_handle_internals() stores bias from v2.2 payload                                                                                                                                                                                                                                                     |
| 30  | REVERSAL EXIT no accent color                                                                                                                                                                                                                                                     | display_type="stop" covers EXIT+REVERSAL conditions                                                                                                                                                                                                                                                    |
| 31  | InternalsWidget always offline                                                                                                                                                                                                                                                    | ts vs received_at key mismatch — backend stores received_at                                                                                                                                                                                                                                            |
| 32  | Header PDC crash on load                                                                                                                                                                                                                                                          | marketData!.atr_levels → optional chaining + ?? '—'                                                                                                                                                                                                                                                    |
| 33  | Supabase init crash Python 3.13                                                                                                                                                                                                                                                   | supabase==2.7.4 + httpx==0.27.0 + gotrue==2.7.0                                                                                                                                                                                                                                                        |
| 34  | TS Authorization header type error                                                                                                                                                                                                                                                | Record<string, string> + imperative if(token) assignment                                                                                                                                                                                                                                               |
| 35  | Chat journal intent false negative                                                                                                                                                                                                                                                | Two-step: YES/NO Haiku check → extraction → \_save_journal_entry()                                                                                                                                                                                                                                     |
| 36  | Watchlist card grid stretching                                                                                                                                                                                                                                                    | alignSelf: "start" on TickerCard + align-items: start on grid                                                                                                                                                                                                                                          |
| 37  | Hydration mismatch desk state                                                                                                                                                                                                                                                     | mounted flag + suppressHydrationWarning in Header + QuickActions                                                                                                                                                                                                                                       |
| 38  | Morning Brief calling /chat                                                                                                                                                                                                                                                       | runMorningBrief() calls /morning-brief directly, reads data.morning_brief                                                                                                                                                                                                                              |
| 39  | Desk open on weekend refresh                                                                                                                                                                                                                                                      | localStorage auto-clears if >12h old on mount                                                                                                                                                                                                                                                          |
| 40  | CSS variables outside :root                                                                                                                                                                                                                                                       | New design tokens must be inside existing :root block in globals.css                                                                                                                                                                                                                                   |
| 41  | otd-columns not rendering grid                                                                                                                                                                                                                                                    | height: 100% required on .otd-columns alongside flex: 1                                                                                                                                                                                                                                                |
| 42  | SP:SPX iframe blocked                                                                                                                                                                                                                                                             | TradingView blocks all index embedding — use Open Chart button                                                                                                                                                                                                                                         |
| 43  | ^GSPC yfinance broken                                                                                                                                                                                                                                                             | Use ^SPX symbol instead — returns 78 bars per trading day                                                                                                                                                                                                                                              |
| 44  | supabase not installed in venv                                                                                                                                                                                                                                                    | pip install supabase==2.7.4 httpx==0.27.0 gotrue==2.7.0                                                                                                                                                                                                                                                |
| 45  | exit_price NOT NULL blocks open trades                                                                                                                                                                                                                                            | ALTER COLUMN exit_price/pnl/grade DROP NOT NULL                                                                                                                                                                                                                                                        |
| 46  | Signal card state resets on SSE update                                                                                                                                                                                                                                            | loggedIds/skippedIds lifted to parent + localStorage                                                                                                                                                                                                                                                   |
| 47  | P&L computed from SPX points not premium                                                                                                                                                                                                                                          | P&L = (exit_premium - entry_premium) x contracts x 100                                                                                                                                                                                                                                                 |
| 48  | Mobile had no Signal Stream — bell-icon AlertDrawer only, no Took/Skip                                                                                                                                                                                                            | Added 4th bottom-nav tab "Signals" → MobileSignalStream bottom sheet                                                                                                                                                                                                                                   |
| 49  | Old ENTRY alerts (days-old) still showed Took/Skip on refresh, both desktop and mobile                                                                                                                                                                                            | isActionable = isEntry && isFromToday(alert.ts) gate added to both SignalCard and MobileSignalCard                                                                                                                                                                                                     |
| 50  | formatRelative capped at hours ("75h") for old alerts                                                                                                                                                                                                                             | Added day rollover — "3d" past 24h, both desktop and mobile                                                                                                                                                                                                                                            |
| 51  | @import "tailwindcss" in globals.css broke custom CSS classes in dev                                                                                                                                                                                                              | Removed the import line                                                                                                                                                                                                                                                                                |
| 52  | challenge_entries UUID mismatch — locally-generated UUID didn't match Supabase-assigned UUID                                                                                                                                                                                      | Capture result.data[0]["id"] after insert in both POST /journal/entry and \_save_journal_entry()                                                                                                                                                                                                       |
| 53  | \_extract_journal_fields didn't extract entry_premium/exit_premium — dumped to notes                                                                                                                                                                                              | Added both fields to \_JOURNAL_EXTRACT_SYSTEM JSON template with explicit extraction rules                                                                                                                                                                                                             |
| 54  | Architecture doc had conflicting signals on whether AI process review on trade close exists — one section marked "Next", another documented POST /journal/review/{id} as already live                                                                                             | Resolved by having Claude Code read the real main.py code directly rather than trusting either doc section — always verify against real code when docs disagree with themselves                                                                                                                        |
| 55  | Challenge "Day X of 90" hero banner and 90-Day Process Streak grid computed day-number from two different sources (challenge.start_date vs. earliest-linked-trade-date) — direct on-screen contradiction (banner said "Day 1", streak grid showed 3 filled cells)                 | Consolidated to ONE rule: day_number always derives from challenges.start_date, computed once, read everywhere. Trades before start_date are correctly excluded from the per-day view (not a bug)                                                                                                      |
| 56  | \_challenge_build_calendar only iterated forward from challenge.start_date, never backward — trades linked to days before the challenge's official start date were invisible in the calendar/streak view despite counting in aggregate stats                                      | First attempted fix: extend start to min(start_date, earliest_trade_date) — this was LATER REVERSED once the product decision was made that start_date must be the single fixed anchor (see #55); trades before start_date are now deliberately excluded, not back-filled                              |
| 57  | Equity chart and day-detail dock panel each had their OWN separate, disconnected mock dataset during testing — calendar mock showed real colored days but streak grid/equity chart/stat cards stayed at zero, reading from a different/no mock source                             | Unified into one shared mergedCalendar-derived dataset so all sections (calendar, streak, equity, stat cards, dock panel) read from the same 5 mock days consistently                                                                                                                                  |
| 58  | Test SQL insert used current_date - interval for 5 "different" trade dates — all 5 collapsed onto the same single date due to ambiguous date handling; separately, the same insert script was accidentally run twice, creating 10 duplicate rows (day_number 1,1,2,2,3,3,4,4,5,5) | Switched to explicit literal dates (date '2026-06-13' etc.) instead of relative interval math; added a scoped DELETE before re-insert; always run full multi-statement SQL blocks together (not "Run selected" on a partial highlight, which caused a separate "syntax error at end of input" earlier) |
| 59  | Mountain hero SVG move-to-ui/public/ task was reported/assumed complete but was NOT actually done — SVG remained inline in component code                                                                                                                                         | Re-issued the task with a mandatory Step 0 (run and show real grep/file-listing output before any change) and a rule that "should work now" is not an acceptable completion statement — must show real proof                                                                                           |
| 60  | Mountain SVG still inline after two attempts — never actually migrated to ui/public/                                                                                                                                                                                              | Migrated this session: `ui/public/openthedesk_mountain_hero.svg` (900×240, xMaxYMin slice). `ChallengeMountainHero.tsx` now `<img src="/openthedesk_mountain_hero.svg">` + overlay SVG with matching preserveAspectRatio. Confirmed via ls + grep.                                                   |
| 61  | Day P&L on top stat card and Today card disagreed on the same day's P&L value                                                                                                                                                                                                     | Fixed: both now derive from the same /challenge/stats `calendar` day entry; no separate computation path.                                                                                                                                                                                             |
| 62  | Day Streak placeholder showed hard-coded value instead of real streak count                                                                                                                                                                                                        | Fixed: `_challenge_build_streaks()` added to /challenge/stats; frontend reads `streaks` field.                                                                                                                                                                                                        |
| 63  | Grade Breakdown donut showed unmerged A/A+ as separate arc segments (A+ rendered as tiny sliver next to A)                                                                                                                                                                         | Fixed: `_challenge_build_grade_breakdown()` merges A and A+ into a single "A/A+" bucket before returning; frontend renders single arc per canonical grade tier.                                                                                                                                       |
| 64  | Flag and "Day 90 · Scale Up" milestone chip collided / chip was clipped at hero right edge                                                                                                                                                                                         | Fixed: switched background to 900×240 xMaxYMin slice; overlay matches same viewBox and preserveAspectRatio; background SVG owns the flag (overlay's own flag code removed); all chips clamped to vw=900 coordinate space so right-edge chip can't clip.                                               |
| 65  | Day Detail Drawer fetch hung on "Loading..." indefinitely, even for days with confirmed real data, no visible error state                                                                                                                                                          | Resolved (drawer now shows real KPI/trades/notes across multiple days) — exact root cause among the candidates flagged (auth header, base URL, missing error handling) was never reported back; fill in here if it resurfaces                                                                          |

---

## Saty Trading System Reference

### Account — Phase 2

```
~$1,625 - Max 1 contract - Max $3-4 premium
A/A+ setups only - Max loss -$150/session - Max 3 trades/day
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
Trigger:     PDC +/- ATR x 0.236
GG Open:     PDC +/- ATR x 0.382   → T1 (first target)
50% Mid:     PDC +/- ATR x 0.500   → key mean reversion zone
GG Complete: PDC +/- ATR x 0.618   → T2 (golden ratio exit)
78.6%:       PDC +/- ATR x 0.786
Full ATR:    PDC +/- ATR x 1.000   → T3 full day target
123.6%-200%: Extension levels, show_extensions=false by default

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

### Setup definitions (Manual Planner v3.3.9)

```
GG          = 38.2% GG Open toward 61.8% GG Complete
FLAG        = pullback into 13/21 EMA zone while ribbon stacked >=5 bars
iVOMY BULL  = bearish ribbon transitions bullish → price reclaims → hold confirms
VOMY BEAR   = bullish ribbon transitions bearish → price loses ribbon → rejection confirms
BT          = call/put trigger backtest
ORB RETEST  = 10m opening range break + retest (CST 08:30-08:40)

ORB Visual Box (v3.3.3+):
- CST-aware: 08:30-08:40 America/Chicago
- orbBullBroken / orbBearBroken gate ORB Retest
- oneORBTradePerDirection = true
- Daily reset on isNewDay

Runner Manager (v3.3.6):
- f_bullNextAfter() / f_bearNextAfter() walk full ATR ladder
- f_targetsValid() blocks wrong-direction plans
- Fallback: Points or R/R if ladder exhausted
- Runner after T3: progressive NEXT target manager
- SL trails: BE → T1 → T3 → NEXT
- atr_level field in ENTRY JSON: f_atrLevelName()
- Mobile display profile

v3.3.7 additions:
- Risk quality engine: Stop Mode (Manual Only / Technical / Capped
  Technical), min T1 reward points, max stop distance, min T1 R multiple
- Invalid Risk/Target blocker

v3.3.8 additions:
- Saty probability classification for T1 (f_satyProbClass)
- Context classification: Aligned / Ribbon OK / Mixed / Counter HTF / Weak
- Final setup grade: A+ / A / B / B- / C / BLOCK, plan type label

v3.3.9 additions:
- atr_level (via f_atrLevelName) now included in T1 HIT, T2 HIT, T3 HIT,
  and RUNNER NEXT HIT alert JSON — previously only ENTRY had it
- Enables frontend ATR Level Probability lookups (cascade %, e.g.
  "38.2% GG Open → 80% historical continuation to 50% Mid") keyed off
  the level associated with each milestone, not just T1 at entry
- Backend pass-through for atr_level on these new alert types not yet
  verified — _handle_trade_alert/SSE/Supabase confirmed generic for
  ENTRY; confirm same for T1/T2/T3/Runner-Next before building the
  probability badge UI
```

---

## Prioritized Feature Backlog

### Do next — in order

1. **Run the 3 pending Supabase ALTER TABLE statements** (process_review,
   stop_loss_premium, grade_factors columns) — code is complete and
   waiting on this single manual step.
2. **Confirm whether ChallengeDayDrawer notes buttons save to the backend**
   (the "add" empty-state buttons) — verify explicitly, don't assume.
3. Once R-multiple + grade_factors are flowing with real data — build the
   Grade Breakdown popup (5-factor radar + 10-day grade history bar chart).
   Day Detail Drawer is already live; the full popup is the remaining screen.
4. **Mobile breakpoints for the Challenge page** — not addressed this session;
   calendar + drawer need responsive treatment.
5. user_sessions write fix — on_conflict upsert not writing to Supabase;
   remove on_conflict param (PK is user_id+session_id, auto-resolves)
6. Signal read/unread visual — unread cards should have subtle accent vs read cards
7. Backend atr_level pass-through verification — confirm T1/T2/T3/
   Runner-Next alerts carry atr_level through \_handle_trade_alert →
   SSE → Supabase tv_alerts without field whitelisting
8. ATR Level Probability badge — frontend lookup table (Tezak/@tesrak
   cascade data) + inline badge on Signal Stream cards (depends on #7)
9. SessionBar real data — wire to /journal/stats, show today's P&L + trades
10. Full TV Charting Library embed — when TradingView approves
11. WEEKLY REVIEW wired to Supabase

### After that

- Header.tsx / Desk / Analyzer / Journal shell redesign (top-nav +
  icon-rail) — once the Challenge page shell pattern has been live and
  stable for a while; deliberately NOT done in the same pass as Challenge,
  since Desk is the live trading view and higher-risk to touch casually
- Real "End Challenge" / "Finish Challenge" button — status change (not
  row deletion) so challenge history is preserved; deferred, hand-editing
  Supabase status field is fine for current testing phase
- Intraday/hourly equity price tracking — separate, bigger project; real
  granular price history storage, needed for the future Day Detail popup's
  intraday curve; explicitly not bundled into Challenge page work
- Agent (LangGraph) — 6 tools, /agent endpoint, proactive alerts
- Unusual Whales API v2 — auto-fetch live flow data
- RAG knowledge base — Voyage AI + pgvector
- Earnings scanner
- Mobile push notifications (PWA)

---

## Key Learnings & Blocked Approaches

- **challenge_entries is a THIN LINKING TABLE only** — never duplicate
  trade_journal fields into it; always JOIN back to trade_journal via
  source_entry_id. All trade data lives in trade_journal.
- **After Supabase insert, always capture result.data[0]["id"]** as the
  real UUID — never use a locally-generated uuid.uuid4() as source_entry_id
  since Supabase assigns its own UUID on insert.
- **@import "tailwindcss" in globals.css breaks custom CSS class resolution**
  in Next.js dev mode — never add this import.
- **\_JOURNAL_EXTRACT_SYSTEM prompt must explicitly list every field** to
  extract; unlisted fields get dumped into "notes" by Haiku regardless of
  how clearly they appear in the user message.
- **on_conflict parameter in Supabase Python upsert is unnecessary** when
  upserting on the primary key — omit it; the client resolves on PK
  automatically.
- **maybe_single().execute() returns None (not a result object) when no row
  exists** in supabase==2.7.4 — always guard with `if row and row.data:`
  not just `if row.data:`.
- **Saty 90-Day Challenge context** — the challenge is about proving
  consistency across different market conditions before sizing up, not about
  hitting a P&L target. Process grade (did you follow the system) is the
  primary metric, not win/loss. Reference: Saty Mahajan's X post.
- **"Day number" must have exactly ONE source of truth across an entire
  page.** When a value like "Day X of 90" is computed independently in
  multiple places (a hero banner, a streak grid, a per-day endpoint), they
  will eventually disagree with each other even if each individual
  calculation is locally correct — the bug is the duplication itself, not
  any one calculation. Compute once, pass down, never recompute the same
  derived value in a second location.
- **When a Claude Code report says a task is "done," verify before
  building on top of it** — this session hit the same failure mode twice
  (the calendar mock-data wiring, and the SVG-to-public-folder move) where
  a reported completion turned out not to have actually happened. The fix
  that worked both times: force the next prompt to require actual command
  output / screenshots / grep results as proof, not a restated intention.
- **Hand-calculated "ground truth" numbers used to verify the app are not
  automatically correct just because a human wrote them.** This session's
  own hand math for a 5-trade P&L check was wrong once (summed only the
  winning trades, forgot to subtract losses) and was mistaken for a real
  backend bug until double-checked. When app output and hand-calculation
  disagree, re-verify the hand-calculation before assuming the app is wrong.
- **.gitignore corruption fix** — the line `*.pyc` was merged with `design-reference/` into one broken entry `*.pycdesign-reference/`, breaking both ignore rules. Fixed by splitting back onto two separate lines. The PR diff shows `*.pyc` appearing twice in .gitignore — harmless duplicate, clean up when convenient. **Status: fixed in PR #1.**
- **SQL multi-statement blocks (e.g. WITH ... AS (...) INSERT ...
  SELECT ... FROM ...) must be run as one complete selection in the
  Supabase SQL Editor** — using "Run selected" on a partial highlight
  (e.g. just the WITH clause) produces "syntax error at end of input."
  Always select the full statement, end to end, including the trailing
  semicolon, before running.
- **Date math ambiguity in test SQL inserts** — using
  current_date - interval 'N days' for what's intended to be N distinct
  calendar dates can silently collapse onto fewer actual dates than
  expected. Prefer explicit literal dates (date '2026-06-11') for test
  data where exact date-spread matters for verifying calendar/streak UI.
- **A page built mockup-first with invented mock data, then has real data
  bolted on column-by-column (calendar → streak → equity → stats), will
  keep surfacing one-section-at-a-time misalignments** as each new column
  reveals it was reading from a different assumption than its neighbors.
  Where possible, design the real end-to-end data shape for a page before
  building its visual mockup, rather than reconciling them after the fact.
- **Challenge feature module is the established pattern for new UI work.**
  All new Challenge-related components go in `ui/features/challenge/components/`,
  styles in `ui/features/challenge/styles/*.module.css`, shared types in
  `lib/types.ts`, utilities in `lib/helpers.ts`. Do NOT add new challenge CSS
  to globals.css. Do NOT add new challenge components to `ui/app/components/`.
- **CSS modules, not globals.css, for all new feature work.** The challenge
  refactor moved all challenge styles into scoped CSS modules. Follow this
  pattern for any new pages/features — globals.css is for app-wide tokens
  and resets only.
- **page.tsx is a thin orchestrator, not a feature file.** It fetches data
  and routes to feature components. Business logic, sub-components, types,
  and styles all live in the feature module. page.tsx should stay under
  ~100 lines.
- **Two structurally different page designs can both be locally
  "correct" and "good"** — the choice between a narrative-sequence layout
  (e.g. the "fused journey" Challenge design) and a familiar-shape
  dashboard layout (e.g. "calendar-first") is a real product decision
  about what question the page should answer fastest, not a question with
  an objectively right answer. Worth deciding deliberately and writing the
  decision down (see Challenge Page Redesign section) rather than
  re-litigating it every time a new reference image arrives.

---

_Single source of truth. Update after every build session. Any Claude session must read this before touching any code._
