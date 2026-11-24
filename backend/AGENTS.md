# backend/ — FastAPI API

## Purpose

- Python + FastAPI API with SQLAlchemy persistence and Alembic migrations (ADR-003, ADR-004)
- Current state: walking skeleton, Office 365 sign-in with server-side sessions (`users`, `sessions`), and the members-only catalog API (`organizations`, `topics`, `faculties`, `events`) with event create/update by the owning organisation; no cancellation, subscriptions or notifications yet

## Ownership

- Owns everything under `backend/`: `app/`, `alembic/`, `seed/`, `alembic.ini`, `tests/`, `pyproject.toml`, `Dockerfile`, `todo-user-stories.md`
- `todo-user-stories.md` is the list of user stories whose backend part is unfinished; update it whenever backend story work lands or new backend gaps are found (frontend gaps belong in `frontend/AGENTS.md`)
- API and data contracts are owned by `docs/` (`api-contracts.md`, `database-schema.md`); this folder implements them

## Local Contracts

- Layout: `app/main.py` (FastAPI app; routers mounted under `/api`, error handlers registered), `app/config.py` (`Settings` from env: `DATABASE_URL` and `SESSION_SECRET` required; `OIDC_*`, `SESSION_MAX_AGE_DAYS`, `SESSION_IDLE_DAYS`, `COOKIE_SECURE`), `app/db/` (`base.py` DeclarativeBase, `session.py` engine + `SessionLocal` + `get_db` request dependency), one folder per module per ADR-003:
  - `app/health/` — `GET /api/health`
  - `app/auth/` — `User`, `Session` models; `GET /api/auth/login`, `GET /api/auth/callback`, `GET /api/auth/me`, `POST /api/auth/logout`; `oidc.py` (`OidcProvider`: discovery, JWKS, PKCE code flow, ID-token validation; `get_oidc_provider` dependency), `service.py` (eligibility, users, sessions, CSRF, `managed_organization`), `dependencies.py` (`require_member`, `require_csrf`, `AuthContext`)
  - `app/organisations/` — `Organization` model, `GET /api/organizations`
  - `app/dictionaries/` — `Topic`, `Faculty` models, `GET /api/topics`, `GET /api/faculties`
  - `app/events/` — `Event` model + status/format/method `StrEnum`s, `GET /api/events` (§6.1 filters), `GET /api/events/{eventId}`, `POST /api/events` (§6.3), `PATCH /api/events/{eventId}` (§6.4); catalog query and write logic in `service.py`
  - `app/seed/` — `seeder.py` (CLI behind `make seed`) + `schemas.py` (`SeedFile` validation); no routes
  - future `notifications/`
- Each module keeps SQLAlchemy models in `models.py`, routes in `router.py` and Pydantic DTOs in `schemas.py`; write/business logic goes in an optional `service.py`, routers stay thin
- `app/schemas.py`: `ApiModel` base (camelCase aliases, `from_attributes`) and `UtcDateTime` (serialises as UTC `…Z`) for all response DTOs; `ApiRequest` base (camelCase only, `extra="forbid"`) for request DTOs
- Auth (ADR-005, `api-contracts.md` §2, §4):
  - Single-tenant NaUKMA Entra app; the ID token must pass RS256 signature (JWKS, refetched once on an unknown `kid`), `iss == OIDC_AUTHORITY`, `aud == OIDC_CLIENT_ID`, `exp`/`nbf` (120 s leeway) and `nonce`. Identity is `identity_provider = "entra:<tid>"` + `provider_subject = oid`; email is `email` or `preferred_username`, lowercased, and must be exactly `@ukma.edu.ua` (else `UNIVERSITY_ACCOUNT_REQUIRED`). An email held by another subject is `AUTHENTICATION_FAILED`
  - `login` stores `state`, `nonce`, PKCE verifier and validated `returnTo` in the signed cookie `almamater_oidc` (itsdangerous, `SESSION_SECRET`, path `/api/auth`, 10 min); `callback` checks `state`, redeems the code server-side, upserts the user, revokes any session the browser already held (rotation), sets `almamater_session` and redirects to `returnTo` (default `/events`). Every failure redirects to `/sign-in?error=<code>` and creates nothing; the reason is logged
  - Sessions: cookie carries `secrets.token_urlsafe(32)`, DB stores its SHA-256 hex; valid iff not revoked, `expires_at > now` (absolute `SESSION_MAX_AGE_DAYS`) and `last_seen_at` within `SESSION_IDLE_DAYS`; `last_seen_at` slides at most every 5 min. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` only when `COOKIE_SECURE=true` (local HTTP exception)
  - CSRF token = HMAC-SHA256(`SESSION_SECRET`, session token), returned by `me`, never stored; `require_csrf` compares `X-CSRF-Token` in constant time (`403 INVALID_CSRF_TOKEN`)
  - `organisations`, `dictionaries` and `events` routers carry router-level `Depends(require_member)`, so `401 NOT_AUTHENTICATED` precedes ID/query validation and lookups; only `health`, `auth/login` and `auth/callback` are anonymous
  - Organisation management is `managed_organization(db, user)` (C-02 email match), re-checked on every mutation; `canManage` is computed per request in `app/events/router.py`
  - Tests replace `get_oidc_provider` with a fake that signs ID tokens with a per-test RSA key; real Office 365 accounts are still needed for acceptance (ADR-005)
- Event mutations: request DTOs check syntax/types only (strict types, offset-aware date-times); failures are `400 MALFORMED_REQUEST` via `service.parse_body`. `service.validate_event` then checks the complete (merged) event against `database-schema.md` §3.5 rules 1–3, 5–7 and returns every violation in one `422 VALIDATION_ERROR`. Text is trimmed before validation and storage. POST order: `401` → `403 INVALID_CSRF_TOKEN` → `403 ORGANIZATION_ACCESS_DENIED` (not a registered address) → `400` → `422`; the organisation comes from the session and `organizationId` in the body is an unknown field (`400`); `created_by_user_id` is the session user. PATCH order: `401` → `403` CSRF → no editable field `400` → `404` → `403 ORGANIZATION_ACCESS_DENIED` (not the owning organisation) → cancelled/past `409 EVENT_NOT_EDITABLE` → stale `revision` `409 EVENT_REVISION_CONFLICT` → `422`; the row is locked `FOR UPDATE`; an edit with no effective change keeps `revision` and `updated_at`
- `app/errors.py`: `ApiError` + handlers producing the `api-contracts.md` §7 envelope; request validation errors map to `400 MALFORMED_REQUEST`, unhandled ones to `500 INTERNAL_ERROR`; every error's `requestId` is logged (logging configured at INFO in `app/main.py`), and 500 tracebacks carry it
- DB CHECK constraints are named `ck_<table>_<rule>`; enum values live only in `app/events/models.py`
- Seed data: `make seed [file=<path>]` upserts organisations (by `slug`), topics and faculties (by `code`) from `seed/data.json` (path relative to `backend/`) in one transaction; rows absent from the file are never deleted. Events are not seeded: each needs the signed-in user who published it (`created_by_user_id`), so they are created through `POST /api/events`
- Seed validation (`app/seed/schemas.py`): emails lowercased; duplicate keys and unknown fields (including `events`) rejected
- `seed/data.json` holds only team-supplied real values and does not exist until they arrive; `seed/data.example.json` holds fake dev data (3 organisations, topics and faculties, `Example`/`example.test` names) for `make seed file=seed/data.example.json` and must never be treated as real data
- No `__init__.py` files (namespace packages); always use full-path imports such as `from app.health.schemas import HealthResponse`
- `GET /api/health` is anonymous liveness only and returns `{"status": "ok", "service": "almamater-api"}` (`api-contracts.md` §8); it must not claim to check the DB
- Migrations live in `alembic/versions/` named `<rev>_<slug>.py`; `0001_initial` is the empty baseline, `0002_catalog_tables` creates `organizations`, `topics`, `faculties`, `events`, `0003_auth_users_sessions` creates `users`, `sessions`, deletes existing (dev-only) events and adds `events.created_by_user_id` (NOT NULL) / `cancelled_by_user_id` with the full `ck_events_cancellation` rule. New model modules must be imported in `alembic/env.py` before autogenerating (`make migration name=<slug> rev=<id>`)
- Synchronous SQLAlchemy in synchronous handlers (ADR-003)
- Dependencies are pinned exactly in `pyproject.toml`; the image installs them and the source is bind-mounted at `/app`
- Runs only inside Compose (`backend` service, `migrate` one-shot job) via `make` targets

## Temporary Deviations From docs/ Contracts

`docs/api-contracts.md` and `docs/database-schema.md` remain the target; these gaps are intentional until cancellation and subscriptions land and must be removed then:

- `PATCH /api/events/{eventId}` writes no `CHANGED` notification deliveries (no `event_subscriptions` / `notification_deliveries` tables yet); `POST /api/events/{eventId}/cancel` and the subscription routes are not implemented
- `EventDetailResponse.subscribed` is always `false`

## Work Guidance

## Verification

- `make backend-lint` runs Ruff with the rules configured in `pyproject.toml` (`E4`, `E7`, `E9`, `F`, `I`); `make backend-lint args=--fix` applies automatic fixes, which must be reviewed before committing.
- `make test` runs pytest against the Compose PostgreSQL (DB must be migrated to head):
  - `tests/conftest.py` — `db` fixture (outer transaction rolled back per test), anonymous `client` (overrides `get_db`), `member_client` / `manager_client` + `manager_org` (signed in, CSRF header set), `sign_in()` / `new_client()` helpers, `make_*` factories for test-only rows (`make_user`, `make_event(created_by=…)`)
  - `tests/test_health.py` (health contract), `tests/test_db.py` (`SELECT 1`, `alembic_version == "0003"`)
  - `tests/test_auth.py` (fake provider: login redirect + PKCE, `returnTo` safety, callback success and rotation, invalid signature/issuer/audience/expiry/nonce/state, provider error, non-university email, `me`, expired/idle/revoked sessions, logout + CSRF, 401 on every protected route)
  - `tests/test_seed.py` (upsert, idempotency, seed file validation, example file validity)
  - `tests/test_organisations.py`, `tests/test_dictionaries.py`, `tests/test_events.py` (filters, Kyiv date range, lifecycle visibility, error envelope)
  - `tests/test_events_write.py` (create/update: 201 + `Location`, all-errors-at-once 422, conditional fields, 400 for unknown/immutable fields and bad syntax, revision bump, no-op edit, 409 stale revision / not editable, 404, creator + session organisation, 403 for non-managers / other organisations / bad CSRF, `canManage`)

## Child DOX Index

No child AGENTS.md.
