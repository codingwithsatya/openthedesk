import os
import base64
import anthropic
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse as FastAPIStreaming
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from context import fetch_live_context
from market_data import get_market_summary
from tradier import get_0dte_snapshot, format_options_context

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic()

# Load context once at startup
print("📡 Loading live trading context...")
LIVE_CONTEXT = fetch_live_context()
print("✅ Context loaded")


def build_system_prompt(live_context: str) -> str:
    return f"""You are the OpenTheDesk trading agent for Satya Pramod.

    You are a professional 0DTE options trading desk agent, personal trading coach,
    and risk manager — the most disciplined voice in the room.

    Your core philosophy:
    - You analyze, react, and trade — you never predict or speculate
    - Process grade is always separate from P&L outcome
    - A perfectly executed losing trade is better than a lucky winning one
    - Zero tolerance for: revenge trading, FOMO, invented stops, averaging down, oversizing, chasing
    - Be direct and accurate — not soft, not harsh
    - If a trade has no edge: NO TRADE — Edge Not Present
    - The market doesn't care about you. Respect it.

    LIVE TRADING CONTEXT (fetched fresh today):
    ================================================================
    {live_context}
    ================================================================

    SHORTCUT COMMANDS — respond in exact format when triggered:
    - "Open the Desk" → Full session opener with TD number, account, gap to $3,000, Phase 2 rules, session ready
    - "PTR-FAST" → 3-gate quick check, all must be YES or SKIP IT
    - "PTR-FULL" → 12-point full audit
    - "PREMARKET" → 5-step morning plan
    - "TRADE IDEA" → 6-point analysis
    - "IN TRADE" → Real-time management
    - "TRADE REVIEW" → 4-dimension scorecard
    - "EOD" → End of day session review
    - "GRADE" → Single setup quality grade
    - "PATTERN CHECK" → Psychology audit
    - "MARKET REGIME" → Classify today's environment
    - "SETUP LIBRARY [name]" → Reference for any setup
    - "CAPITAL PROTECTION" → Emergency protocol
    - "BLUNT FEEDBACK" → Direct critique, zero softening
    - "WEEKLY REVIEW" → Full weekly summary
    - "WIRE OUT" → Calculate wire-out amount

    Always read the live context fully before responding to anything.
    Never give trade recommendations — only diagnosis, analysis, and coaching.
    Human-in-the-loop always — you analyze, Satya decides."""


# Store per-session conversation history
# Key: session_id, Value: list of messages
sessions: dict[str, list[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    atr: Optional[float] = None


class RefreshRequest(BaseModel):
    session_id: str = "default"


@app.get("/health")
def health():
    return {"status": "ok", "context_loaded": len(LIVE_CONTEXT) > 0}


@app.post("/chat")
async def chat(request: ChatRequest):
    global LIVE_CONTEXT

    # Get or create session history
    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

    # Add user message
    history.append({"role": "user", "content": request.message})

    # Call Claude
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=[{
            "type": "text",
            "text": build_system_prompt(LIVE_CONTEXT),
            "cache_control": {"type": "ephemeral"}
        }],
        messages=history
    )

    reply = response.content[0].text

    # Add assistant reply to history
    history.append({"role": "assistant", "content": reply})

    return {
        "reply": reply,
        "session_id": request.session_id,
        "turns": len(history) // 2
    }


@app.post("/analyze-chart")
async def analyze_chart(
    file: UploadFile = File(...),
    context: str = "TRADE IDEA",
    session_id: str = "default"
):
    global LIVE_CONTEXT

    image_data = await file.read()
    base64_image = base64.standard_b64encode(image_data).decode("utf-8")
    media_type = file.content_type or "image/jpeg"

    if session_id not in sessions:
        sessions[session_id] = []
    history = sessions[session_id]

    # Smart model routing
    model = "claude-haiku-4-5-20251001" if context in [
        "PTR-FAST", "PTR-FULL", "GRADE"] else "claude-sonnet-4-6"

    user_message = {
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_image
                }
            },
            {
                "type": "text",
                "text": f"""{context}

                    Analyze this Saty Mahajan system chart carefully.

                    CRITICAL — Ribbon color reading rules:
                    The ribbon has TWO components — read them separately:
                    1. The CLOUD/BANDS (the filled area behind candles) — this is the ribbon color
                    2. The CANDLE color — gray/white candles can appear INSIDE a green ribbon during compression

                    Green/teal/blue cloud = GREEN ribbon = calls eligible
                    Red/orange cloud = RED ribbon = puts eligible  
                    White/thin/nearly invisible cloud = WHITE ribbon = chop, no trade

                    Do NOT confuse gray compression candles with red ribbon.
                    The cloud color behind the candles determines the ribbon state.

                    Then analyze in order:
                    1. Ribbon cloud color (not candle color)
                    2. ATR levels from chart overlay
                    3. Internals panel — TRIN, VOLD, ADD, TICK, VIX, PCC
                    4. Phase Oscillator state
                    5. Setup structure and final verdict"""
            }
        ]
    }

    history.append(user_message)

    def stream():
        full_reply = ""
        with client.messages.stream(
            model=model,
            max_tokens=2048,
            system=[{
                "type": "text",
                "text": build_system_prompt(LIVE_CONTEXT),
                "cache_control": {"type": "ephemeral"}
            }],
            messages=history
        ) as stream:
            for text in stream.text_stream:
                full_reply += text
                yield text

        # Store in history after streaming completes
        history[-1] = {"role": "user", "content": f"[Chart] {context}"}
        history.append({"role": "assistant", "content": full_reply})

    return FastAPIStreaming(stream(), media_type="text/plain")


@app.get("/market-data")
async def market_data(atr: float = None):
    """Get live SPX + VIX + ATR levels + 0DTE options chain."""
    summary = get_market_summary(atr_override=atr)
    snapshot = get_0dte_snapshot(atr=atr)
    summary["options"] = snapshot
    summary["options_context"] = format_options_context(snapshot)
    return summary


@app.post("/premarket")
async def premarket(request: ChatRequest):
    """Run PREMARKET with live market data injected."""
    global LIVE_CONTEXT

    # Fetch live data
    market = get_market_summary(atr_override=request.atr)

    # Build market context string
    spx = market.get("spx", {})
    vix = market.get("vix", {})
    levels = market.get("atr_levels", {})

    # Fetch live options data
    snapshot = get_0dte_snapshot()
    options_text = format_options_context(snapshot)

    market_context = f"""
    LIVE MARKET DATA (auto-fetched at {__import__('datetime').datetime.now().strftime('%H:%M ET')}):
    SPX Last: {spx.get('last')} | PDC: {spx.get('pdc')} | Today H: {spx.get('high')} | Today L: {spx.get('low')}
    VIX: {vix.get('vix')} | VIX High: {vix.get('vix_high')} | VIX Low: {vix.get('vix_low')}

    ATR LEVELS — PDC {levels.get('PDC')} | ATR {levels.get('ATR')} pts ({market.get('atr_source', 'approx')}):
    +100% Full ATR:      {levels.get('full_atr_call')}
    +61.8% GG Complete:  {levels.get('gg_complete_call')}
    +50.0% Mid:          {levels.get('gg_50_call')}
    +38.2% GG Open:      {levels.get('gg_open_call')}
    +23.6% Call Trigger: {levels.get('call_trigger')}
    PDC Pivot:           {levels.get('PDC')}
    -23.6% Put Trigger:  {levels.get('put_trigger')}
    -38.2% GG Open:      {levels.get('gg_open_put')}
    -50.0% Mid:          {levels.get('gg_50_put')}
    -61.8% GG Complete:  {levels.get('gg_complete_put')}
    -100% Full ATR:      {levels.get('full_atr_put')}

    {options_text}
    """

    # Add to session history
    session_id = request.session_id
    if session_id not in sessions:
        sessions[session_id] = []

    history = sessions[session_id]
    history.append({
        "role": "user",
        "content": f"PREMARKET\n\n{market_context}\n\nRun the full 5-step pre-market plan for today."
    })

    # Stream response
    def stream():
        full_reply = ""
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=[{
                "type": "text",
                "text": build_system_prompt(LIVE_CONTEXT),
                "cache_control": {"type": "ephemeral"}
            }],
            messages=history
        ) as s:
            for text in s.text_stream:
                full_reply += text
                yield text
        history.append({"role": "assistant", "content": full_reply})

    return FastAPIStreaming(stream(), media_type="text/plain")


@app.post("/refresh-context")
async def refresh_context(request: RefreshRequest):
    """Fetch fresh context from Google Doc and clear session."""
    global LIVE_CONTEXT
    LIVE_CONTEXT = fetch_live_context()
    sessions.pop(request.session_id, None)
    return {"status": "refreshed", "chars": len(LIVE_CONTEXT)}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear conversation history for a session."""
    sessions.pop(session_id, None)
    return {"cleared": session_id}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
