# backend/ — FastAPI API

## Purpose

- Python + FastAPI API with SQLAlchemy persistence and Alembic migrations (ADR-003, ADR-004)
- Current state: walking skeleton plus read-only catalog API (`organizations`, `topics`, `faculties`, `events`); no auth, users, mutations or notifications yet

## Ownership

- Owns everything under `backend/`: `app/`, `alembic/`, `alembic.ini`, `tests/`, `pyproject.toml`, `Dockerfile`
- API and data contracts are owned by `docs/` (`api-contracts.md`, `database-schema.md`); this folder implements them

## Local Contracts

- Layout: `app/main.py` (FastAPI app; routers mounted under `/api`, error handlers registered), `app/config.py` (`Settings` from env, `DATABASE_URL` required), `app/db/` (`base.py` DeclarativeBase, `session.py` engine + `SessionLocal` + `get_db` request dependency), one folder per module per ADR-003:
  - `app/health/` — `GET /api/health`
  - `app/organisations/` — `Organization` model, `GET /api/organizations`
  - `app/dictionaries/` — `Topic`, `Faculty` models, `GET /api/topics`, `GET /api/faculties`
  - `app/events/` — `Event` model + status/format/method `StrEnum`s, `GET /api/events` (§6.1 filters), `GET /api/events/{eventId}`
  - future `auth/`, `notifications/`
- Each module keeps SQLAlchemy models in `models.py`, routes in `router.py` and Pydantic DTOs in `schemas.py`
- `app/schemas.py`: `ApiModel` base (camelCase aliases, `from_attributes`) and `UtcDateTime` (serialises as UTC `…Z`); all response DTOs use them
- `app/errors.py`: `ApiError` + handlers producing the `api-contracts.md` §7 envelope; request validation errors map to `400 MALFORMED_REQUEST`, unhandled ones to `500 INTERNAL_ERROR`
- DB CHECK constraints are named `ck_<table>_<rule>`; enum values live only in `app/events/models.py`
- No seed data: dictionaries and organisations stay empty until the team supplies them
- No `__init__.py` files (namespace packages); always use full-path imports such as `from app.health.schemas import HealthResponse`
- `GET /api/health` is anonymous liveness only and returns `{"status": "ok", "service": "almamater-api"}` (`api-contracts.md` §8); it must not claim to check the DB
- Migrations live in `alembic/versions/` named `<rev>_<slug>.py`; `0001_initial` is the empty baseline, `0002_catalog_tables` creates `organizations`, `topics`, `faculties`, `events`. New model modules must be imported in `alembic/env.py` before autogenerating (`make migration name=<slug> rev=<id>`)
- Synchronous SQLAlchemy in synchronous handlers (ADR-003)
- Dependencies are pinned exactly in `pyproject.toml`; the image installs them and the source is bind-mounted at `/app`
- Runs only inside Compose (`backend` service, `migrate` one-shot job) via `make` targets

## Temporary Deviations From docs/ Contracts

`docs/api-contracts.md` and `docs/database-schema.md` remain the target; these gaps are intentional until auth lands and must be removed then:

- No `users` / `sessions` tables; `events` has no `created_by_user_id` or `cancelled_by_user_id`, and `ck_events_cancellation` checks only `cancelled_at`
- All catalog routes are anonymous (no `401 NOT_AUTHENTICATED`)
- `EventDetailResponse.canManage` and `subscribed` are always `false`

## Work Guidance

## Verification

- `make test` runs pytest against the Compose PostgreSQL (DB must be migrated to head):
  - `tests/conftest.py` — `db` fixture (outer transaction rolled back per test), `client` fixture (overrides `get_db`), `make_*` factories for test-only rows
  - `tests/test_health.py` (health contract), `tests/test_db.py` (`SELECT 1`, `alembic_version == "0002"`)
  - `tests/test_organisations.py`, `tests/test_dictionaries.py`, `tests/test_events.py` (filters, Kyiv date range, lifecycle visibility, error envelope)

## Child DOX Index

No child AGENTS.md.
