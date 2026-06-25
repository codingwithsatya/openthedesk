import os
import anthropic

_LS_ENABLED = False
try:
    if os.getenv("LANGSMITH_API_KEY"):
        from langsmith.wrappers import wrap_anthropic as _ls_wrap
        _LS_ENABLED = True
except ImportError:
    pass

_raw_client = anthropic.Anthropic(timeout=60.0)
_raw_stream_client = anthropic.Anthropic(timeout=120.0)

if _LS_ENABLED:
    client = _ls_wrap(_raw_client)
    stream_client = _ls_wrap(_raw_stream_client)
else:
    client = _raw_client
    stream_client = _raw_stream_client

print(f"🔍 LangSmith tracing: {'enabled → project=openthedesk' if _LS_ENABLED else 'disabled (LANGSMITH_API_KEY not set)'}")

SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"

_HAIKU_COMMANDS = {
    "PTR-FAST", "PTR-FULL", "GRADE", "PATTERN CHECK",
    "MARKET REGIME", "CAPITAL PROTECTION", "WIRE OUT",
    "TRADE REVIEW", "EOD",
}
