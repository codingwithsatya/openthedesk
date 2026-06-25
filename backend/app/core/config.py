import os
from dotenv import load_dotenv

load_dotenv()

TV_WEBHOOK_SECRET: str = os.getenv("TV_WEBHOOK_SECRET", "dev-secret")

_sb = None
try:
    _sb_url = os.getenv("SUPABASE_URL", "")
    _sb_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if _sb_url and _sb_key:
        from supabase import create_client
        _sb = create_client(_sb_url, _sb_key)
        print("✅ Supabase connected")
    else:
        print("⚠️  Supabase not configured — using in-memory fallback")
except Exception as _e:
    print(f"⚠️  Supabase init failed: {_e} — using in-memory fallback")
