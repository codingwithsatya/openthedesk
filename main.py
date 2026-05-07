import os
import anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from context import fetch_live_context

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
