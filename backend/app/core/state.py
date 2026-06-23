import asyncio
from zoneinfo import ZoneInfo

from context import fetch_live_context

_ET = ZoneInfo("America/New_York")

FLOW_CONTEXT: str = ""
INTERNALS_CACHE: dict = {"trin": None, "add": None, "vold": None,
                         "pcc": None, "bias": None, "ts": None}

TV_ALERTS: list[dict] = []
ALERT_SUBSCRIBERS: set[asyncio.Queue] = set()

print("📡 Loading live trading context...")
LIVE_CONTEXT: str = fetch_live_context()
print("✅ Context loaded")
