# backend/ — FastAPI API

## Purpose

- Python + FastAPI API with SQLAlchemy persistence and Alembic migrations (ADR-003, ADR-004)
- Current state: walking skeleton plus catalog API (`organizations`, `topics`, `faculties`, `events`) with event create/update; no auth, users, cancellation, subscriptions or notifications yet

## Ownership

- Owns everything under `backend/`: `app/`, `alembic/`, `seed/`, `alembic.ini`, `tests/`, `pyproject.toml`, `Dockerfile`
- API and data contracts are owned by `docs/` (`api-contracts.md`, `database-schema.md`); this folder implements them

## Local Contracts

- Layout: `app/main.py` (FastAPI app; routers mounted under `/api`, error handlers registered), `app/config.py` (`Settings` from env, `DATABASE_URL` required), `app/db/` (`base.py` DeclarativeBase, `session.py` engine + `SessionLocal` + `get_db` request dependency), one folder per module per ADR-003:
  - `app/health/` — `GET /api/health`
  - `app/organisations/` — `Organization` model, `GET /api/organizations`
  - `app/dictionaries/` — `Topic`, `Faculty` models, `GET /api/topics`, `GET /api/faculties`
  - `app/events/` — `Event` model + status/format/method `StrEnum`s, `GET /api/events` (§6.1 filters), `GET /api/events/{eventId}`, `POST /api/events` (§6.3), `PATCH /api/events/{eventId}` (§6.4); write logic in `service.py`
  - `app/seed/` — `seeder.py` (CLI behind `make seed`) + `schemas.py` (`SeedFile` validation); no routes
  - future `auth/`, `notifications/`
- Each module keeps SQLAlchemy models in `models.py`, routes in `router.py` and Pydantic DTOs in `schemas.py`; write/business logic goes in an optional `service.py`, routers stay thin
- `app/schemas.py`: `ApiModel` base (camelCase aliases, `from_attributes`) and `UtcDateTime` (serialises as UTC `…Z`) for all response DTOs; `ApiRequest` base (camelCase only, `extra="forbid"`) for request DTOs
- Event mutations: request DTOs check syntax/types only (strict types, offset-aware date-times); failures are `400 MALFORMED_REQUEST` via `service.parse_body`. `service.validate_event` then checks the complete (merged) event against `database-schema.md` §3.5 rules 1–3, 5–7 and returns every violation in one `422 VALIDATION_ERROR`. Text is trimmed before validation and storage. PATCH order: no editable field `400` → `404` → cancelled/past `409 EVENT_NOT_EDITABLE` → stale `revision` `409 EVENT_REVISION_CONFLICT` → `422`; the row is locked `FOR UPDATE`; an edit with no effective change keeps `revision` and `updated_at`
- `app/errors.py`: `ApiError` + handlers producing the `api-contracts.md` §7 envelope; request validation errors map to `400 MALFORMED_REQUEST`, unhandled ones to `500 INTERNAL_ERROR`
- DB CHECK constraints are named `ck_<table>_<rule>`; enum values live only in `app/events/models.py`
- Seed data: `make seed [file=<path>]` upserts organisations (by `slug`), topics and faculties (by `code`) and events (by explicit `id`) from `seed/data.json` (path relative to `backend/`) in one transaction; rows absent from the file are never deleted
- Seed validation (`app/seed/schemas.py`): emails lowercased; duplicate keys and unknown fields rejected; events reference `organization` slug / `topic` code / `faculty` code (unknown refs abort the run) and must satisfy `database-schema.md` §3.5 conditional constraints 1–4, 6, 7 (future `starts_at` is not required). Re-seeding an event keeps `published_at` and `revision`, sets `updated_at` to now
- `seed/data.json` holds only team-supplied real values and does not exist until they arrive; `seed/data.example.json` holds fake dev data (3 rows per table, `Example`/`example.test` names) for `make seed file=seed/data.example.json` and must never be treated as real data
- No `__init__.py` files (namespace packages); always use full-path imports such as `from app.health.schemas import HealthResponse`
- `GET /api/health` is anonymous liveness only and returns `{"status": "ok", "service": "almamater-api"}` (`api-contracts.md` §8); it must not claim to check the DB
- Migrations live in `alembic/versions/` named `<rev>_<slug>.py`; `0001_initial` is the empty baseline, `0002_catalog_tables` creates `organizations`, `topics`, `faculties`, `events`. New model modules must be imported in `alembic/env.py` before autogenerating (`make migration name=<slug> rev=<id>`)
- Synchronous SQLAlchemy in synchronous handlers (ADR-003)
- Dependencies are pinned exactly in `pyproject.toml`; the image installs them and the source is bind-mounted at `/app`
- Runs only inside Compose (`backend` service, `migrate` one-shot job) via `make` targets

## Temporary Deviations From docs/ Contracts

`docs/api-contracts.md` and `docs/database-schema.md` remain the target; these gaps are intentional until auth lands and must be removed then:

- No `users` / `sessions` tables; `events` has no `created_by_user_id` or `cancelled_by_user_id`, and `ck_events_cancellation` checks only `cancelled_at`
- All catalog routes, including `POST`/`PATCH /api/events`, are anonymous: no `401 NOT_AUTHENTICATED`, no `403 ORGANIZATION_ACCESS_DENIED` ownership check, no CSRF check
- `POST /api/events` takes the owning organisation from a temporary `organizationId` body field (must exist, else `422`) instead of the session; `PATCH` rejects it (`400`)
- `PATCH /api/events/{eventId}` writes no `CHANGED` notification deliveries (no `event_subscriptions` / `notification_deliveries` tables yet); `POST /api/events/{eventId}/cancel` is not implemented
- `EventDetailResponse.canManage` and `subscribed` are always `false`

## Work Guidance

## Verification

- `make test` runs pytest against the Compose PostgreSQL (DB must be migrated to head):
  - `tests/conftest.py` — `db` fixture (outer transaction rolled back per test), `client` fixture (overrides `get_db`), `make_*` factories for test-only rows
  - `tests/test_health.py` (health contract), `tests/test_db.py` (`SELECT 1`, `alembic_version == "0002"`)
  - `tests/test_seed.py` (upsert, idempotency, event ref resolution, seed file validation, example file validity)
  - `tests/test_organisations.py`, `tests/test_dictionaries.py`, `tests/test_events.py` (filters, Kyiv date range, lifecycle visibility, error envelope)
  - `tests/test_events_write.py` (create/update: 201 + `Location`, all-errors-at-once 422, conditional fields, 400 for unknown/immutable fields and bad syntax, revision bump, no-op edit, 409 stale revision / not editable, 404)

## Child DOX Index

No child AGENTS.md.
