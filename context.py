import os
import requests
from dotenv import load_dotenv

load_dotenv()

DOC_ID = os.environ["GOOGLE_DOC_ID"]


def fetch_live_context() -> str:
    """Fetch the live trading context from Google Doc."""
    url = f"https://docs.google.com/document/d/{DOC_ID}/export?format=txt"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content = response.text.strip()
        print(f"   ✓ Live context loaded ({len(content)} chars)")
        return content
    except Exception as e:
        print(f"   ⚠️ Could not load Google Doc: {e}")
        return "Context unavailable — check Google Doc sharing settings."


if __name__ == "__main__":
    content = fetch_live_context()
    print("\nFirst 500 chars:")
    print(content[:500])
