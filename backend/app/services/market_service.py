import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.app.core.clients import client, HAIKU
from backend.app.core.utils import with_retry


async def _fetch_market_news() -> dict:
    """Fetch economic calendar + gap movers + catalyst news via Claude web search."""
    today = datetime.now(ZoneInfo("America/New_York")).strftime("%B %d %Y")

    results = {"economic_calendar": "", "gap_movers": "", "catalyst_news": ""}

    async def _search(query: str) -> str:
        try:
            r = await asyncio.to_thread(lambda: client.messages.create(
                model=HAIKU,
                max_tokens=512,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": query}],
            ))
            text_parts = []
            for block in r.content:
                if hasattr(block, "type") and block.type == "text":
                    text_parts.append(block.text)
            return "\n".join(text_parts)
        except Exception as e:
            print(f"[WARN] news fetch failed: {e}")
            return ""

    cal, movers, news = await asyncio.gather(
        _search(
            f"economic calendar today {today} high impact USD events "
            f"time ET forecast previous — list only HIGH and MEDIUM impact"
        ),
        _search(
            f"premarket gap ups gap downs stocks today {today} "
            f"biggest movers percentage change reason"
        ),
        _search(
            f"stock market catalyst news today {today} "
            f"earnings reactions Fed speakers macro events SPX"
        ),
    )

    results["economic_calendar"] = cal
    results["gap_movers"] = movers
    results["catalyst_news"] = news
    return results
