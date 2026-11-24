import time
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from authlib.jose import JsonWebKey, JsonWebToken
from sqlalchemy import select

from app.auth.dependencies import SESSION_COOKIE
from app.auth.models import Session as UserSession
from app.auth.models import User
from app.auth.oidc import OidcProvider, get_oidc_provider
from app.auth.service import hash_token
from app.main import app
from tests.conftest import make_organization, make_user, sign_in

AUTHORITY = "https://login.example.test/test-tenant/v2.0"
CLIENT_ID = "test-client-id"
_jwt = JsonWebToken(["RS256"])


class FakeProvider(OidcProvider):
    """Stands in for Office 365: no network, ID tokens signed with a key generated per test."""

    def __init__(self):
        super().__init__(CLIENT_ID, "test-secret", AUTHORITY, "http://testserver/api/auth/callback")
        self.key = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "test-kid"})
        self.published_keys = [self.key]
        self.id_token: str | None = None
        self.jwks_refreshes = 0

    def metadata(self):
        return {
            "authorization_endpoint": "https://login.example.test/authorize",
            "token_endpoint": "https://login.example.test/token",
            "jwks_uri": "https://login.example.test/keys",
        }

    def jwks(self, refresh=False):
        self.jwks_refreshes += refresh
        return {"keys": [key.as_dict(is_private=False) for key in self.published_keys]}

    def exchange_code(self, code, code_verifier):
        assert code == "test-code" and code_verifier
        return self.id_token

    def sign(self, claims, key=None):
        return _jwt.encode({"alg": "RS256", "kid": "test-kid"}, claims, key or self.key).decode()


@pytest.fixture
def provider():
    fake = FakeProvider()
    app.dependency_overrides[get_oidc_provider] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_oidc_provider, None)


def _claims(expected_nonce, **overrides):
    now = int(time.time())
    email = f"student-{uuid.uuid4().hex[:8]}@ukma.edu.ua"
    claims = {
        "iss": AUTHORITY,
        "aud": CLIENT_ID,
        "iat": now,
        "nbf": now,
        "exp": now + 3600,
        "nonce": expected_nonce,
        "tid": "test-tenant",
        "oid": str(uuid.uuid4()),
        "email": email,
        "preferred_username": email,
    }
    claims.update(overrides)
    return {key: value for key, value in claims.items() if value is not None}


def _start(client, return_to="/events/abc"):
    """GET /auth/login; returns the authorisation URL's query parameters."""
    response = client.get("/api/auth/login", params={"returnTo": return_to}, follow_redirects=False)
    assert response.status_code == 302
    return {key: values[0] for key, values in parse_qs(urlsplit(response.headers["location"]).query).items()}


def _finish(client, provider, params, state=None, **claim_overrides):
    provider.id_token = provider.sign(_claims(params["nonce"], **claim_overrides))
    return client.get(
        "/api/auth/callback",
        params={"code": "test-code", "state": state or params["state"]},
        follow_redirects=False,
    )


def _session_count(db):
    return len(db.scalars(select(UserSession)).all())


# --- GET /api/auth/login -----------------------------------------------------


def test_login_redirects_to_provider_with_state_nonce_and_pkce(client, provider):
    response = client.get("/api/auth/login", params={"returnTo": "/events/1"}, follow_redirects=False)

    assert response.status_code == 302
    url = urlsplit(response.headers["location"])
    params = {key: values[0] for key, values in parse_qs(url.query).items()}
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://login.example.test/authorize"
    assert params["client_id"] == CLIENT_ID
    assert params["response_type"] == "code"
    assert params["scope"] == "openid profile email"
    assert params["redirect_uri"] == "http://testserver/api/auth/callback"
    assert params["code_challenge_method"] == "S256"
    assert params["state"] and params["nonce"] and params["code_challenge"]
    cookie = response.headers["set-cookie"]
    assert "almamater_oidc=" in cookie
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api/auth" in cookie


@pytest.mark.parametrize(
    ("return_to", "landing"),
    [
        ("/events/123?x=1", "/events/123?x=1"),
        ("https://evil.example/", "/events"),
        ("//evil.example/", "/events"),
        ("/\\evil.example", "/events"),
        ("events", "/events"),
        (None, "/events"),
    ],
)
def test_callback_lands_only_on_local_return_to(client, db, provider, return_to, landing):
    params = _start(client, return_to)

    response = _finish(client, provider, params)

    assert response.status_code == 302
    assert response.headers["location"] == landing


# --- GET /api/auth/callback --------------------------------------------------


def test_callback_creates_user_and_session(client, db, provider):
    params = _start(client)

    response = _finish(client, provider, params, email="Mixed.Case@UKMA.edu.ua", preferred_username=None)

    assert response.status_code == 302
    assert response.headers["location"] == "/events/abc"
    user = db.scalars(select(User).where(User.email == "mixed.case@ukma.edu.ua")).one()
    assert user.identity_provider == "entra:test-tenant"
    token = client.cookies.get(SESSION_COOKIE)
    session = db.scalars(select(UserSession).where(UserSession.token_hash == hash_token(token))).one()
    assert session.user_id == user.id and session.revoked_at is None
    assert session.expires_at - session.created_at == timedelta(days=30)
    cookies = response.headers.get_list("set-cookie")
    session_cookie = next(cookie for cookie in cookies if cookie.startswith(f"{SESSION_COOKIE}="))
    assert "HttpOnly" in session_cookie and "SameSite=lax" in session_cookie and "Path=/" in session_cookie
    assert "Secure" not in session_cookie
    # The one-time transaction cookie is cleared
    assert any(cookie.startswith('almamater_oidc=""') for cookie in cookies)
    # Provider tokens never reach the browser
    assert provider.id_token not in str(response.headers)


def test_second_sign_in_updates_user_and_rotates_session(client, db, provider):
    oid = str(uuid.uuid4())
    _finish(client, provider, _start(client), oid=oid, email="repeat@ukma.edu.ua")
    first_token = client.cookies.get(SESSION_COOKIE)
    user = db.scalars(select(User).where(User.email == "repeat@ukma.edu.ua")).one()
    user.last_login_at = datetime(2026, 1, 1, tzinfo=UTC)
    db.flush()

    _finish(client, provider, _start(client), oid=oid, email="repeat@ukma.edu.ua")

    db.expire_all()
    assert len(db.scalars(select(User).where(User.provider_subject == oid)).all()) == 1
    assert db.get(User, user.id).last_login_at > datetime(2026, 1, 1, tzinfo=UTC)
    old = db.scalars(select(UserSession).where(UserSession.token_hash == hash_token(first_token))).one()
    assert old.revoked_at is not None
    assert client.cookies.get(SESSION_COOKIE) != first_token


def test_preferred_username_is_used_without_email_claim(client, db, provider):
    _finish(client, provider, _start(client), email=None, preferred_username="upn-only@ukma.edu.ua")

    assert db.scalars(select(User).where(User.email == "upn-only@ukma.edu.ua")).one()


def _assert_rejected(response, db, sessions_before, code="AUTHENTICATION_FAILED"):
    assert response.status_code == 302
    assert response.headers["location"] == f"/sign-in?error={code}"
    assert _session_count(db) == sessions_before


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "https://login.example.test/other-tenant/v2.0"},
        {"aud": "another-client"},
        {"exp": int(time.time()) - 3600, "nbf": int(time.time()) - 7200},
        {"nonce": "replayed-nonce"},
        {"oid": None},
    ],
)
def test_callback_rejects_invalid_id_token(client, db, provider, overrides):
    before = _session_count(db)

    response = _finish(client, provider, _start(client), **overrides)

    _assert_rejected(response, db, before)


def test_callback_rejects_bad_signature(client, db, provider):
    params = _start(client)
    forger = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "test-kid"})
    provider.id_token = provider.sign(_claims(params["nonce"]), key=forger)
    before = _session_count(db)

    response = client.get(
        "/api/auth/callback", params={"code": "test-code", "state": params["state"]}, follow_redirects=False
    )

    _assert_rejected(response, db, before)


def test_callback_refetches_keys_once_after_rotation(client, db, provider):
    params = _start(client)
    provider.published_keys = []
    provider.id_token = provider.sign(_claims(params["nonce"]))

    original_jwks = provider.jwks

    def rotating_jwks(refresh=False):
        if refresh:
            provider.published_keys = [provider.key]
        return original_jwks(refresh)

    provider.jwks = rotating_jwks
    response = client.get(
        "/api/auth/callback", params={"code": "test-code", "state": params["state"]}, follow_redirects=False
    )

    assert response.headers["location"] == "/events/abc"
    assert provider.jwks_refreshes == 1


def test_callback_rejects_state_mismatch(client, db, provider):
    before = _session_count(db)

    response = _finish(client, provider, _start(client), state="forged-state")

    _assert_rejected(response, db, before)


def test_callback_without_transaction_cookie_is_rejected(client, db, provider):
    params = _start(client)
    client.cookies.clear()
    before = _session_count(db)

    response = _finish(client, provider, params)

    _assert_rejected(response, db, before)


def test_callback_with_provider_error_is_rejected(client, db, provider):
    params = _start(client)
    before = _session_count(db)

    response = client.get(
        "/api/auth/callback",
        params={"error": "access_denied", "state": params["state"]},
        follow_redirects=False,
    )

    _assert_rejected(response, db, before)


@pytest.mark.parametrize("email", ["student@gmail.com", "student@ukma.edu.ua.evil.test", "student@sub.ukma.edu.ua"])
def test_non_university_account_is_rejected(client, db, provider, email):
    before = _session_count(db)

    response = _finish(client, provider, _start(client), email=email, preferred_username=email)

    _assert_rejected(response, db, before, code="UNIVERSITY_ACCOUNT_REQUIRED")
    assert db.scalars(select(User).where(User.email == email)).first() is None


def test_email_owned_by_another_subject_is_rejected(client, db, provider):
    make_user(db, email="taken@ukma.edu.ua")
    before = _session_count(db)

    response = _finish(client, provider, _start(client), email="taken@ukma.edu.ua")

    _assert_rejected(response, db, before)


# --- GET /api/auth/me ----------------------------------------------------------


def test_me_for_member_without_organisation(client, db):
    user = make_user(db)
    csrf = sign_in(client, db, user)

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": user.email,
        "organization": None,
        "canPublish": False,
        "csrfToken": csrf,
    }


def test_me_for_registered_organisation_address(client, db):
    org = make_organization(db)
    sign_in(client, db, make_user(db, email=org.registered_email))

    body = client.get("/api/auth/me").json()

    assert body["organization"] == {"id": str(org.id), "name": org.name}
    assert body["canPublish"] is True
    assert body["csrfToken"] == client.get("/api/auth/me").json()["csrfToken"]


# --- Session validity and logout ------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"expires_at": datetime.now(UTC) - timedelta(minutes=1)},
        {"last_seen_at": datetime.now(UTC) - timedelta(days=7, minutes=1)},
        {"revoked_at": datetime.now(UTC)},
    ],
)
def test_expired_idle_or_revoked_session_is_401(client, db, overrides):
    sign_in(client, db, make_user(db), **overrides)

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"


def test_activity_slides_last_seen(client, db):
    stale = datetime.now(UTC) - timedelta(days=1)
    sign_in(client, db, make_user(db), last_seen_at=stale)

    assert client.get("/api/auth/me").status_code == 200

    token = client.cookies.get(SESSION_COOKIE)
    session = db.scalars(select(UserSession).where(UserSession.token_hash == hash_token(token))).one()
    db.refresh(session)
    assert session.last_seen_at > stale


def test_logout_revokes_session(client, db):
    sign_in(client, db, make_user(db))

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert f'{SESSION_COOKIE}=""' in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("csrf", [None, "wrong-token", "ünïcode"])
def test_logout_requires_csrf(client, db, csrf):
    sign_in(client, db, make_user(db))
    client.headers.pop("X-CSRF-Token")
    # Bytes: lets a non-ASCII value reach the server instead of failing in the HTTP client
    headers = {"X-CSRF-Token": csrf.encode()} if csrf else {}

    response = client.post("/api/auth/logout", headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "INVALID_CSRF_TOKEN"
    assert client.get("/api/auth/me").status_code == 200


# --- Members-only API (US-55b) ---------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/auth/me"),
        ("POST", "/api/auth/logout"),
        ("GET", "/api/organizations"),
        ("GET", "/api/topics"),
        ("GET", "/api/faculties"),
        ("GET", "/api/events"),
        ("GET", "/api/events?topicId=not-a-uuid"),
        ("GET", f"/api/events/{uuid.uuid4()}"),
        ("GET", "/api/events/not-a-uuid"),
        ("POST", "/api/events"),
        ("PATCH", f"/api/events/{uuid.uuid4()}"),
    ],
)
def test_protected_routes_require_session(client, method, path):
    response = client.request(method, path, json={} if method in ("POST", "PATCH") else None)

    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "NOT_AUTHENTICATED"
    assert body["details"] == []


def test_health_stays_anonymous(client):
    assert client.get("/api/health").status_code == 200
