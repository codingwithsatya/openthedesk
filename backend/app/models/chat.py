from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    atr: Optional[float] = None


class RefreshRequest(BaseModel):
    session_id: str = "default"
