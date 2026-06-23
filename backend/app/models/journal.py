from typing import Optional
from pydantic import BaseModel


class JournalEntryPayload(BaseModel):
    date: str
    ticker: str
    setup: str
    direction: str
    entry_price: float
    entry_premium: Optional[float] = None
    exit_price: Optional[float] = None
    exit_premium: Optional[float] = None
    stop_loss_premium: Optional[float] = None
    contracts: int = 1
    pnl: Optional[float] = None
    grade: Optional[str] = None
    process_grade: Optional[str] = None
    notes: Optional[str] = None
    status: str = "open"


class JournalUpdatePayload(BaseModel):
    exit_price: Optional[float] = None
    exit_premium: Optional[float] = None
    entry_premium: Optional[float] = None
    stop_loss_premium: Optional[float] = None
    pnl: Optional[float] = None
    grade: Optional[str] = None
    process_grade: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
