import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.auth.models import Session, User
from app.config import settings
from app.organisations.models import Organization

UNIVERSITY_DOMAIN = "ukma.edu.ua"
DEFAULT_RETURN_TO = "/events"
# Bounds the writes caused by sliding the inactivity window on every request
LAST_SEEN_RESOLUTION = timedelta(minutes=5)


class SignInRejected(Exception):
    """Callback outcome that must not create a session; `code` is the api-contracts.md §4 error code."""

    def __init__(self, code: str, reason: str):
        super().__init__(reason)
        self.code = code


@dataclass(frozen=True)
class Identity:
    identity_provider: str
    provider_subject: str
    email: str


def safe_return_to(value: str | None) -> str:
    """Accept only a same-origin relative path (api-contracts.md §4); anything else gets the default page."""
    if not value or not value.startswith("/") or value.startswith(("//", "/\\")):
        return DEFAULT_RETURN_TO
    if any(ord(char) < 0x20 or char == "\\" for char in value):
        return DEFAULT_RETURN_TO
    return value


def eligible_identity(claims: dict[str, Any]) -> Identity:
    """Map validated ID-token claims to a member identity (database-schema.md §3.1, D-08).

    The issuer is already pinned to the NaUKMA tenant, whose ukma.edu.ua domain is verified,
    so the tenant-issued address is trusted; any other domain is rejected.
    """
    tenant, subject = claims.get("tid"), claims.get("oid")
    if not tenant or not subject:
        raise SignInRejected("AUTHENTICATION_FAILED", "id_token lacks tid or oid")
    email = str(claims.get("email") or claims.get("preferred_username") or "").strip().lower()
    local, _, domain = email.rpartition("@")
    if not local or domain != UNIVERSITY_DOMAIN:
        raise SignInRejected("UNIVERSITY_ACCOUNT_REQUIRED", "account email is not in the university domain")
    return Identity(identity_provider=f"entra:{tenant}", provider_subject=str(subject), email=email)


def upsert_user(db: DbSession, identity: Identity, now: datetime) -> User:
    """First sign-in creates the member record (A-16); later sign-ins refresh email and last_login_at."""
    user = db.scalars(
        select(User).where(
            User.identity_provider == identity.identity_provider,
            User.provider_subject == identity.provider_subject,
        )
    ).first()
    owner = db.scalars(select(User).where(User.email == identity.email)).first()
    if owner is not None and owner is not user:
        # Identity is never derived from the email alone (database-schema.md §3.1)
        raise SignInRejected("AUTHENTICATION_FAILED", "email already belongs to another provider subject")
    if user is None:
        user = User(**vars(identity), created_at=now, last_login_at=now)
        db.add(user)
    else:
        user.email = identity.email
        user.last_login_at = now
    db.flush()
    return user


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: DbSession, user: User, now: datetime) -> str:
    """Stores only the token hash; returns the opaque token for the cookie."""
    token = secrets.token_urlsafe(32)
    db.add(
        Session(
            token_hash=hash_token(token),
            user_id=user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(days=settings.session_max_age_days),
        )
    )
    db.flush()
    return token


def resolve_session(db: DbSession, token: str | None, now: datetime) -> Session | None:
    """Valid iff not revoked, not expired and not idle (database-schema.md §3.2); slides last_seen_at."""
    if not token:
        return None
    session = db.scalars(select(Session).where(Session.token_hash == hash_token(token))).first()
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        return None
    if session.last_seen_at + timedelta(days=settings.session_idle_days) <= now:
        return None
    if now - session.last_seen_at >= LAST_SEEN_RESOLUTION:
        session.last_seen_at = now
        db.commit()
    return session


def revoke_session(db: DbSession, session: Session, now: datetime) -> None:
    session.revoked_at = now
    db.flush()


def csrf_token(session_token: str) -> str:
    """Derived from the session token with the server secret; never stored (database-schema.md §3.2)."""
    return hmac.new(settings.session_secret.encode(), session_token.encode(), hashlib.sha256).hexdigest()


def csrf_matches(session_token: str, presented: str | None) -> bool:
    if not presented:
        return False
    # Bytes: compare_digest rejects non-ASCII str, and header values are arbitrary client input
    return hmac.compare_digest(csrf_token(session_token).encode(), presented.encode())


def managed_organization(db: DbSession, user: User) -> Organization | None:
    """C-02: the user manages the organisation whose registered address equals their verified email."""
    return db.scalars(select(Organization).where(Organization.registered_email == user.email)).first()


def revoke_token(db: DbSession, token: str | None, now: datetime) -> None:
    """Revoke whatever live session this token belongs to (session rotation at sign-in)."""
    if not token:
        return
    session = db.scalars(select(Session).where(Session.token_hash == hash_token(token))).first()
    if session is not None and session.revoked_at is None:
        revoke_session(db, session, now)
