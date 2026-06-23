import asyncio
import os
from datetime import datetime

from backend.app.core.state import _ET


async def _keep_alive():
    """Ping /ping every 10 min on weekdays 09:00–16:00 ET to prevent Railway idle."""
    import httpx
    port = int(os.environ.get("PORT", 8000))
    async with httpx.AsyncClient() as http:
        while True:
            await asyncio.sleep(600)
            now = datetime.now(_ET)
            if now.weekday() < 5 and 9 <= now.hour < 16:
                try:
                    await http.get(f"http://localhost:{port}/ping")
                except Exception:
                    pass
