from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    ticker: str
    trading_mode: str = "day"


class QuickAnalyzeRequest(BaseModel):
    ticker: str
    price: float
    ribbon_state: str
    compression: bool
    po_value: float
    call_trigger: float
    put_trigger: float
    gg_open_call: float
    gg_open_put: float
    atr_14: float
    change_pct: float
