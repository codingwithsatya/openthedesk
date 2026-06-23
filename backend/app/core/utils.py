import time
import anthropic

from backend.app.core.clients import SONNET, HAIKU, _HAIKU_COMMANDS


def route_model(message: str) -> str:
    """Return the cheapest model that can handle this command well."""
    return HAIKU if message.strip().upper() in _HAIKU_COMMANDS else SONNET


def log_trace(
    command: str,
    model: str,
    session_id: str,
    endpoint: str,
    tokens_in: int,
    tokens_out: int,
) -> None:
    """Log exact token usage to Railway console after each Claude call."""
    model_short = "haiku" if "haiku" in model else "sonnet"
    print(
        f"[TRACE] command={command!r}  model={model_short}"
        f"  tokens_in={tokens_in:,}  tokens_out={tokens_out:,}"
        f"  session={session_id}  endpoint={endpoint}"
    )


def with_retry(fn, max_attempts=3):
    """Retry fn on OverloadedError or APIStatusError 529 with exponential backoff."""
    for attempt in range(max_attempts):
        try:
            return fn()
        except (anthropic.OverloadedError, anthropic.APIStatusError) as e:
            if isinstance(e, anthropic.APIStatusError) and e.status_code != 529:
                raise
            if attempt == max_attempts - 1:
                raise
            time.sleep(2 ** attempt)
