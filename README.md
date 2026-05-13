# OpenTheDesk

An AI-powered 0DTE trading desk agent for SPX/SPXW options. Built on your personal trading system — Saty Mahajan's framework — with live market data, chart vision analysis, and all 14 trading shortcuts.

**🔗 Frontend:** https://openthedesk.vercel.app

**⚙️ Backend:** https://openthedesk-production.up.railway.app

![Claude API](https://img.shields.io/badge/Built%20with-Claude%20API-blue) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green) ![Next.js](https://img.shields.io/badge/Frontend-Next.js-black)

---

## What it does

OpenTheDesk is your personal trading intelligence platform. Say **"Open the Desk"** to begin each session — the agent loads your full trading system from a live Google Doc and runs every analysis against your actual rules.

**Core capabilities:**

- **Session opener** — TD number, account balance, gap to $3,000, Phase 2 rules, key levels for the day
- **Chart vision analysis** — paste any TradingView screenshot, get PTR-FAST/TRADE IDEA analysis in 2-3 seconds
- **Live market data** — SPX close, VIX, and all Saty ATR levels auto-calculated each morning
- **PREMARKET** — full 5-step morning plan with live SPX data injected automatically
- **14 shortcuts** — PTR-FAST, PTR-FULL, TRADE IDEA, IN TRADE, TRADE REVIEW, EOD, and more

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

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| Frontend          | Next.js 16, TypeScript, Tailwind CSS           |
| Backend           | Python, FastAPI, Uvicorn                       |
| AI — Generation   | Claude API (claude-sonnet-4-6)                 |
| AI — Quick checks | Claude Haiku (PTR-FAST, PTR-FULL, GRADE)       |
| Market Data       | Tradier API (SPX, VIX, ATR levels, 0DTE chain) |
| Knowledge Base    | Google Doc (live context, fetched fresh daily) |
| Deployment        | Vercel (frontend) + Railway (backend)          |

---

## Architecture

### Two-layer knowledge base

```
Layer 1 — Live Google Doc (fetched every session)
  → Personal rules (Rules 1-31+)
  → Confirmed patterns (Patterns 1-32+)
  → Account state, Phase 2 rules
  → Recent lessons learned

Layer 2 — System prompt (Saty's framework)
  → All 15 playbook setups
  → ATR level math and probabilities
  → Market internals decision matrix
  → GEX interpretation framework
```

### Chart analysis pipeline

```
TradingView screenshot
  → Image compression (1280px max)
  → Claude Vision reads:
     1. Ribbon cloud color (not candle color)
     2. ATR levels from Saty overlay
     3. Internals panel (TRIN/VOLD/ADD/TICK/VIX/PCC)
     4. Phase Oscillator state
     5. Setup structure
  → Streaming response (first text in 2-3 seconds)
  → PTR-FAST / TRADE IDEA verdict
```

### PREMARKET pipeline

```
Click PREMARKET button
  → yfinance fetches SPX + VIX (live)
  → calculate_atr_levels(PDC, ATR) runs
  → All 8 Saty levels calculated automatically
  → Injected into Claude message as structured context
  → Full 5-step morning plan streams back
```

---

## Project Structure

```
openthedesk/
├── main.py              # FastAPI backend
│   ├── POST /chat           # Main conversation endpoint
│   ├── POST /analyze-chart  # Chart vision analysis (streaming)
│   ├── POST /premarket      # PREMARKET with live data (streaming)
│   ├── GET  /market-data    # Live SPX + VIX + ATR levels
│   ├── POST /refresh-context # Re-fetch Google Doc
│   └── DELETE /session/{id}  # Clear conversation history
├── context.py           # Google Doc fetcher with retry
├── market_data.py       # Tradier SPX/VIX + ATR calculator
├── tradier.py           # Tradier API — quotes, 0DTE chain, snapshot
├── requirements.txt
├── nixpacks.toml        # Railway deployment config
├── .env                 # API keys (not committed)
├── ui/                  # Next.js frontend
│   ├── app/
│   │   └── page.tsx     # Dashboard — shortcuts + levels panel + chat
│   └── vercel.json
└── legacy/              # Archived files (not in active use)
    ├── agent.py         # Original CLI agent (pre-FastAPI)
    └── index.html       # Prototype HTML UI
```

---

## Running Locally

**Backend**

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Add to .env:
# ANTHROPIC_API_KEY=...
# GOOGLE_DOC_ID=your_google_doc_id

uvicorn main:app --reload
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

## Google Doc Setup

The agent loads your trading context from a Google Doc on every session:

1. Create a Google Doc with your trading rules, patterns, and system
2. Share it: **Anyone with the link → Viewer**
3. Copy the Doc ID from the URL: `https://docs.google.com/document/d/YOUR_DOC_ID/edit`
4. Add to `.env`: `GOOGLE_DOC_ID=YOUR_DOC_ID`

The doc is fetched fresh on every "Refresh Context" click — add a new rule tonight, it's live tomorrow morning.

---

## Deployment

**Backend → Railway**

- Set env vars: `ANTHROPIC_API_KEY`, `GOOGLE_DOC_ID`
- `nixpacks.toml` handles Python start command
- Generate Domain under Networking settings

**Frontend → Vercel**

- Root Directory: `ui`
- Env var: `NEXT_PUBLIC_API_URL` = Railway backend URL (not Sensitive)
- Auto-deploys on every push to main

---

## Trading System

Built around Saty Mahajan's 0DTE SPX framework:

- **Indicators:** Pivot Ribbon (8/13/21/48/200 EMAs), ATR Levels, Phase Oscillator
- **Setups:** Golden Gate, Bilbo GG (90.2% bear completion), Flag Into Ribbon, VOMY, iVOMY, ORB, Bilbo Box, and 8 more
- **Filters:** TRIN / VOLD / ADD / TICK / 1H PO — all 5 must confirm
- **Rules:** 31 hard rules, 32 confirmed psychological patterns
- **Human-in-the-loop always** — agent analyzes, you decide, nothing executes

---

## Built as part of a 6-month AI Engineering curriculum

This is the Month 3 portfolio project — an AI agent with tool use, vision, live data, and streaming responses.

Follow the journey: [@codingwithsatya](https://github.com/codingwithsatya)
