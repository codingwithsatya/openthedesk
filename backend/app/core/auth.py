import jwt as pyjwt
from fastapi import Header, HTTPException


async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract user_id from Clerk JWT. Never trusts request body for identity."""
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = pyjwt.decode(
            token, options={"verify_signature": False}, algorithms=["RS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
