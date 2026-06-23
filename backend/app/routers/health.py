from datetime import datetime, timezone

from fastapi import APIRouter

import backend.app.core.state as _state

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "context_loaded": len(_state.LIVE_CONTEXT) > 0}


@router.get("/me")
def me():
    """Auth probe — confirms backend is reachable by an authenticated client."""
    return {"status": "authenticated"}


@router.get("/ping")
def ping():
    return {"status": "alive", "ts": datetime.now(timezone.utc).isoformat()}
