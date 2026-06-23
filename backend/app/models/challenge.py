from pydantic import BaseModel


class StartChallengePayload(BaseModel):
    name: str = "90-Day Challenge"
    start_balance: float = 500
    monthly_target: float = 1000


class AlertReadPayload(BaseModel):
    read_ids: list[str]
