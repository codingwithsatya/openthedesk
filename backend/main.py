import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.lifecycle import _keep_alive
from backend.app.routers import health, desk, analyzer, webhook, challenge, journal

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(desk.router)
app.include_router(analyzer.router)
app.include_router(webhook.router)
app.include_router(challenge.router)
app.include_router(journal.router)


@app.on_event("startup")
async def startup():
    asyncio.create_task(_keep_alive())


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
