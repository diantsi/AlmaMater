"""Sends one email through Microsoft Graph from the signed-in team mailbox (delegated Mail.Send).

`python -m app.notifications.mailer --login` (behind `make mail-login`) signs that mailbox in once
with a device code; the token cache lives in the `mail-cache` volume and is refreshed on every send.
"""

import argparse
import logging
from pathlib import Path

import msal
import requests

from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = ["Mail.Send"]
TOKEN_CACHE = Path("/mail/token_cache.json")
SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail"


class MailError(Exception):
    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        # Seconds Graph asked us to wait (429/503 Retry-After)
        self.retry_after = retry_after


def _app() -> tuple[msal.PublicClientApplication, msal.SerializableTokenCache]:
    cache = msal.SerializableTokenCache()
    if TOKEN_CACHE.exists():
        cache.deserialize(TOKEN_CACHE.read_text())
    # MSAL wants the tenant authority without the OIDC "/v2.0" suffix
    authority = settings.oidc_authority.removesuffix("/v2.0")
    return msal.PublicClientApplication(settings.oidc_client_id, authority=authority, token_cache=cache), cache


def _save(cache: msal.SerializableTokenCache) -> None:
    if cache.has_state_changed:
        TOKEN_CACHE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_CACHE.write_text(cache.serialize())


def _access_token() -> str:
    app, cache = _app()
    accounts = app.get_accounts()
    result = app.acquire_token_silent(SCOPES, account=accounts[0]) if accounts else None
    _save(cache)
    if not result or "access_token" not in result:
        raise MailError("Mailbox is not signed in or its sign-in expired; run `make mail-login`.")
    return result["access_token"]


def send(to: str, subject: str, body: str) -> None:
    if settings.mail_dry_run:
        logger.info("MAIL_DRY_RUN email\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return

    message = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            # One recipient per message: nobody sees other subscribers (api-contracts.md §6.8)
            "toRecipients": [{"emailAddress": {"address": to}}],
        },
        "saveToSentItems": False,
    }

    try:
        response = requests.post(
            SEND_URL, json=message, headers={"Authorization": f"Bearer {_access_token()}"}, timeout=30
        )
    except requests.RequestException as exc:
        raise MailError(f"Graph request failed: {exc}") from exc

    if response.status_code == 202:
        return
    retry_after = response.headers.get("Retry-After")
    raise MailError(
        f"Graph sendMail returned {response.status_code}: {response.text[:500]}",
        float(retry_after) if retry_after and retry_after.isdigit() else None,
    )


def login() -> None:
    app, cache = _app()
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        raise SystemExit(f"Could not start the device sign-in: {flow.get('error_description', flow)}")
    print(flow["message"], flush=True)
    result = app.acquire_token_by_device_flow(flow)
    if "access_token" not in result:
        raise SystemExit(f"Sign-in failed: {result.get('error_description', result)}")
    _save(cache)
    print(f"Signed in as {result.get('id_token_claims', {}).get('preferred_username', 'the mailbox')}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", action="store_true", help="sign the sending mailbox in with a device code")
    if parser.parse_args().login:
        login()
    else:
        parser.print_help()
