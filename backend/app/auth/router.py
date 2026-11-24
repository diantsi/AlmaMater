import logging
import secrets
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session as DbSession

from app.auth.dependencies import (
    SESSION_COOKIE,
    AuthContext,
    require_csrf,
    require_member,
)
from app.auth.oidc import OidcError, OidcProvider, get_oidc_provider
from app.auth.schemas import MeOrganization, MeResponse
from app.auth.service import (
    SignInRejected,
    create_session,
    csrf_token,
    eligible_identity,
    managed_organization,
    revoke_session,
    revoke_token,
    safe_return_to,
    upsert_user,
)
from app.config import settings
from app.db.session import get_db

logger = logging.getLogger("almamater.auth")

router = APIRouter(tags=["auth"])

# Short-lived signed cookie holding state, nonce, PKCE verifier and returnTo between login and callback
TRANSACTION_COOKIE = "almamater_oidc"
TRANSACTION_PATH = "/api/auth"
TRANSACTION_MAX_AGE_SECONDS = 600
# Safe local page the frontend renders for failed sign-ins (api-contracts.md §4)
SIGN_IN_PAGE = "/sign-in"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="almamater-oidc-transaction")


def _cookie_flags() -> dict[str, Any]:
    return {"httponly": True, "samesite": "lax", "secure": settings.cookie_secure}


def _sign_in_failed(code: str) -> RedirectResponse:
    response = RedirectResponse(f"{SIGN_IN_PAGE}?error={code}", status_code=302)
    response.delete_cookie(TRANSACTION_COOKIE, path=TRANSACTION_PATH, **_cookie_flags())
    return response


# api-contracts.md §4: start the authorisation-code flow
@router.get("/auth/login", status_code=302, response_class=RedirectResponse)
def login(
    return_to: Annotated[str | None, Query(alias="returnTo")] = None,
    provider: OidcProvider = Depends(get_oidc_provider),
) -> RedirectResponse:
    transaction = {
        "state": secrets.token_urlsafe(32),
        "nonce": secrets.token_urlsafe(32),
        "verifier": secrets.token_urlsafe(48),
        "returnTo": safe_return_to(return_to),
    }
    try:
        url = provider.authorization_url(transaction["state"], transaction["nonce"], transaction["verifier"])
    except OidcError as error:
        logger.warning("sign-in could not start: %s", error)
        return _sign_in_failed("AUTHENTICATION_FAILED")
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(
        TRANSACTION_COOKIE,
        _serializer().dumps(transaction),
        max_age=TRANSACTION_MAX_AGE_SECONDS,
        path=TRANSACTION_PATH,
        **_cookie_flags(),
    )
    return response


def _load_transaction(raw: str | None, state: str | None) -> dict[str, str]:
    if not raw:
        raise SignInRejected("AUTHENTICATION_FAILED", "missing sign-in transaction cookie")
    try:
        transaction = _serializer().loads(raw, max_age=TRANSACTION_MAX_AGE_SECONDS)
    except BadSignature as error:
        raise SignInRejected("AUTHENTICATION_FAILED", f"bad sign-in transaction cookie: {error}") from error
    if not state or not secrets.compare_digest(transaction["state"].encode(), state.encode()):
        raise SignInRejected("AUTHENTICATION_FAILED", "state mismatch")
    return transaction


# api-contracts.md §4: validate the provider response, create the member session, redirect
@router.get("/auth/callback", status_code=302, response_class=RedirectResponse)
def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: DbSession = Depends(get_db),
    provider: OidcProvider = Depends(get_oidc_provider),
) -> RedirectResponse:
    try:
        transaction = _load_transaction(request.cookies.get(TRANSACTION_COOKIE), state)
        if error:
            raise SignInRejected("AUTHENTICATION_FAILED", f"provider returned error={error}")
        if not code:
            raise SignInRejected("AUTHENTICATION_FAILED", "callback without code")
        id_token = provider.exchange_code(code, transaction["verifier"])
        identity = eligible_identity(provider.validate_id_token(id_token, transaction["nonce"]))
        now = datetime.now(UTC)
        user = upsert_user(db, identity, now)
        # Session rotation: a session this browser already held never survives a new sign-in
        revoke_token(db, request.cookies.get(SESSION_COOKIE), now)
        token = create_session(db, user, now)
        db.commit()
    except (SignInRejected, OidcError) as rejection:
        db.rollback()
        code_ = rejection.code if isinstance(rejection, SignInRejected) else "AUTHENTICATION_FAILED"
        logger.info("sign-in rejected code=%s reason=%s", code_, rejection)
        return _sign_in_failed(code_)

    response = RedirectResponse(transaction["returnTo"], status_code=302)
    response.delete_cookie(TRANSACTION_COOKIE, path=TRANSACTION_PATH, **_cookie_flags())
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_max_age_days * 24 * 3600,
        path="/",
        **_cookie_flags(),
    )
    return response


# api-contracts.md §4
@router.get("/auth/me", response_model=MeResponse)
def me(auth: AuthContext = Depends(require_member), db: DbSession = Depends(get_db)) -> MeResponse:
    organization = managed_organization(db, auth.user)
    return MeResponse(
        id=auth.user.id,
        email=auth.user.email,
        organization=MeOrganization(id=organization.id, name=organization.name) if organization else None,
        can_publish=organization is not None,
        csrf_token=csrf_token(auth.token),
    )


# api-contracts.md §4: revoke the session and clear its cookie
@router.post("/auth/logout", status_code=204, response_class=Response)
def logout(auth: AuthContext = Depends(require_csrf), db: DbSession = Depends(get_db)) -> Response:
    revoke_session(db, auth.session, datetime.now(UTC))
    db.commit()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/", **_cookie_flags())
    return response
