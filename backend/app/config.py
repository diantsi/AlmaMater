from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str

    # Office 365 OIDC client for the NaUKMA tenant (ADR-005, api-contracts.md §10.1)
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_authority: str = ""
    oidc_redirect_uri: str = ""

    # HMAC key for CSRF tokens and the signed OIDC transaction cookie
    session_secret: str
    # api-contracts.md §10.4: absolute lifetime and inactivity timeout
    session_max_age_days: int = 30
    session_idle_days: int = 7
    # False only for local HTTP development (ADR-005 localhost exception); true on HTTPS
    cookie_secure: bool = False

    # Notification worker (ADR-007): base of the event links in emails
    app_public_url: str = "http://localhost:5173"
    # True: the worker logs each finished email instead of sending it through Microsoft Graph;
    # set false once a mailbox is signed in with `make mail-login`
    mail_dry_run: bool = True


settings = Settings()
