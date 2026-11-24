"""Office 365 OpenID Connect client (authorisation-code flow + PKCE) for the NaUKMA tenant (ADR-005).

Provider tokens stay on the server: only validated ID-token claims leave this module.
"""

from functools import lru_cache
from typing import Any

import requests
from authlib.integrations.requests_client import OAuth2Session
from authlib.jose import JsonWebKey, JsonWebToken
from authlib.jose.errors import JoseError

from app.config import settings

SCOPE = "openid profile email"
HTTP_TIMEOUT_SECONDS = 10
CLOCK_SKEW_SECONDS = 120

# Only the algorithm Entra uses for ID tokens; rules out "none" and HMAC key confusion
_jwt = JsonWebToken(["RS256"])


class OidcError(Exception):
    """Any provider, transport or token-validation failure; the message is for server logs only."""


class OidcProvider:
    def __init__(self, client_id: str, client_secret: str, authority: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        # Single-tenant authority; the issuer must equal it, which locks sign-in to the NaUKMA tenant
        self.authority = authority.rstrip("/")
        self.redirect_uri = redirect_uri
        self._metadata: dict[str, Any] | None = None
        self._jwks: dict[str, Any] | None = None

    def _get_json(self, url: str) -> dict[str, Any]:
        try:
            response = requests.get(url, timeout=HTTP_TIMEOUT_SECONDS)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            raise OidcError(f"cannot fetch {url}: {error}") from error

    def metadata(self) -> dict[str, Any]:
        if self._metadata is None:
            self._metadata = self._get_json(f"{self.authority}/.well-known/openid-configuration")
        return self._metadata

    def jwks(self, refresh: bool = False) -> dict[str, Any]:
        if self._jwks is None or refresh:
            self._jwks = self._get_json(self.metadata()["jwks_uri"])
        return self._jwks

    def _client(self) -> OAuth2Session:
        return OAuth2Session(
            self.client_id,
            self.client_secret,
            scope=SCOPE,
            redirect_uri=self.redirect_uri,
            code_challenge_method="S256",
            token_endpoint_auth_method="client_secret_post",
        )

    def authorization_url(self, state: str, nonce: str, code_verifier: str) -> str:
        url, _ = self._client().create_authorization_url(
            self.metadata()["authorization_endpoint"],
            state=state,
            nonce=nonce,
            code_verifier=code_verifier,
            response_mode="query",
        )
        return url

    def exchange_code(self, code: str, code_verifier: str) -> str:
        """Redeem the authorisation code server-to-server; returns the raw ID token."""
        try:
            token = self._client().fetch_token(
                self.metadata()["token_endpoint"],
                code=code,
                code_verifier=code_verifier,
                timeout=HTTP_TIMEOUT_SECONDS,
            )
        except Exception as error:  # Authlib raises OAuthError and requests errors
            raise OidcError(f"code exchange failed: {error}") from error
        id_token = token.get("id_token")
        if not id_token:
            raise OidcError("token response has no id_token")
        return id_token

    def _decode(self, id_token: str, nonce: str, jwks: dict[str, Any]) -> dict[str, Any]:
        claims = _jwt.decode(
            id_token,
            JsonWebKey.import_key_set(jwks),
            claims_options={
                "iss": {"essential": True, "value": self.authority},
                "aud": {"essential": True, "value": self.client_id},
                "exp": {"essential": True},
                "nonce": {"essential": True, "value": nonce},
            },
        )
        claims.validate(leeway=CLOCK_SKEW_SECONDS)
        return dict(claims)

    def validate_id_token(self, id_token: str, nonce: str) -> dict[str, Any]:
        """Check signature, issuer, audience, expiry and nonce; returns the claims."""
        try:
            try:
                return self._decode(id_token, nonce, self.jwks())
            except ValueError:
                # Unknown signing key (kid): Entra rotated its keys, refetch the key set once
                return self._decode(id_token, nonce, self.jwks(refresh=True))
        except (JoseError, ValueError) as error:
            raise OidcError(f"invalid id_token: {error!r}") from error


@lru_cache
def _default_provider() -> OidcProvider:
    return OidcProvider(
        settings.oidc_client_id,
        settings.oidc_client_secret,
        settings.oidc_authority,
        settings.oidc_redirect_uri,
    )


def get_oidc_provider() -> OidcProvider:
    """FastAPI dependency; tests override it with a fake identity provider."""
    return _default_provider()
