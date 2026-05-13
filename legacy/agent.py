import os
import anthropic
from dotenv import load_dotenv
from context import fetch_live_context

load_dotenv()

client = anthropic.Anthropic()


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


def run_desk():
    """Main agent loop."""
    print("\n" + "="*60)
    print("  OpenTheDesk — Loading...")
    print("="*60)

    # Fetch live context once per session
    print("\n📡 Fetching live trading context...")
    live_context = fetch_live_context()

    system_prompt = build_system_prompt(live_context)
    conversation_history = []

    print("\n✅ Desk is ready. Type 'Open the Desk' to begin.")
    print("   Type 'exit' to close.\n")
    print("="*60 + "\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nClosing the desk. Good trading.")
            break

        if not user_input:
            continue

        if user_input.lower() in ["exit", "quit", "close"]:
            print("\nClosing the desk. Good trading.")
            break

        # Add to history
        conversation_history.append({
            "role": "user",
            "content": user_input
        })

        # Call Claude
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=[{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }],
            messages=conversation_history
        )

        reply = response.content[0].text

        # Add to history
        conversation_history.append({
            "role": "assistant",
            "content": reply
        })

        print(f"\nDesk: {reply}\n")


if __name__ == "__main__":
    run_desk()
