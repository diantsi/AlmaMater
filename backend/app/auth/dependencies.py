from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session as DbSession

from app.auth.models import Session, User
from app.auth.service import csrf_matches, resolve_session
from app.db.session import get_db
from app.errors import ApiError

SESSION_COOKIE = "almamater_session"


@dataclass(frozen=True)
class AuthContext:
    user: User
    session: Session
    token: str


def require_member(request: Request, db: DbSession = Depends(get_db)) -> AuthContext:
    """Every /api route except health, auth/login and auth/callback (api-contracts.md §2)."""
    token = request.cookies.get(SESSION_COOKIE)
    session = resolve_session(db, token, datetime.now(UTC))
    if session is None:
        # Checked before any resource lookup, so callers learn nothing about what exists
        raise ApiError(401, "NOT_AUTHENTICATED", "Sign-in is required.")
    return AuthContext(user=session.user, session=session, token=token)


def require_csrf(
    auth: AuthContext = Depends(require_member),
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> AuthContext:
    """State-changing requests must echo the session-bound token from GET /api/auth/me."""
    if not csrf_matches(auth.token, csrf_header):
        raise ApiError(403, "INVALID_CSRF_TOKEN", "Security token is missing or invalid; reload the page.")
    return auth
