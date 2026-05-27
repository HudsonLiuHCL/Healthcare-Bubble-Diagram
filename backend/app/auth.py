"""Google Sign-In for the Bubble Diagram API.

The web app signs the user in with Google and sends the resulting ID token as a
``Authorization: Bearer <token>`` header. :func:`get_current_user` verifies it
and returns the user's :class:`Identity`; routes that must know who the user is
(currently /publish) depend on it. Other endpoints stay open for now.

The Google call is isolated in ``_verify`` (lazy ``google-auth`` import) so the
rest of the app imports without the dependency and tests can stub it.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException


@dataclass
class Identity:
    sub: str
    email: str | None = None
    name: str | None = None


def _verify(token: str, client_id: str | None) -> dict:
    """Verify the ID token against Google's public keys; return its claims."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(
        token, google_requests.Request(), audience=client_id or None
    )


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Identity:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Google bearer token")
    token = authorization.split(" ", 1)[1].strip()
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    try:
        claims = _verify(token, client_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
    return Identity(sub=sub, email=claims.get("email"), name=claims.get("name"))
