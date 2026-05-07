import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

DOC_ID = os.environ["GOOGLE_DOC_ID"]


def fetch_live_context() -> str:
    """Fetch the live trading context from Google Doc with retry."""
    url = f"https://docs.google.com/document/d/{DOC_ID}/export?format=txt"

    for attempt in range(3):
        try:
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            content = response.text.strip()
            if len(content) > 100:  # sanity check — real content
                print(f"   ✓ Live context loaded ({len(content)} chars)")
                return content
        except Exception as e:
            print(f"   ⚠️ Attempt {attempt + 1} failed: {e}")
            if attempt < 2:
                time.sleep(2)

    # Fallback — return a minimal context so app still works
    print("   ⚠️ Using fallback context")
    return """TRADING CONTEXT UNAVAILABLE — Google Doc could not be reached.
Core rules still apply:
- No trade without a named setup
- Ribbon color must align with direction
- Max loss -$150 per session
- Max 1 contract, max $3-4 premium
- Message before every trade
- Dollar stop = premium paid minus $1.00
Please refresh context when Google Doc is accessible."""


if __name__ == "__main__":
    content = fetch_live_context()
    print(f"\nFirst 300 chars:\n{content[:300]}")
