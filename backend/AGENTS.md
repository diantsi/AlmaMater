# backend/ — FastAPI API

## Purpose

- Python + FastAPI API with SQLAlchemy persistence and Alembic migrations (ADR-003, ADR-004)
- Current state: Practice 4 walking skeleton. Only `GET /api/health` and the DB/migration plumbing exist; no business modules yet

## Ownership

- Owns everything under `backend/`: `app/`, `alembic/`, `alembic.ini`, `tests/`, `pyproject.toml`, `Dockerfile`
- API and data contracts are owned by `docs/` (`api-contracts.md`, `database-schema.md`); this folder implements them

## Local Contracts

- Layout: `app/main.py` (FastAPI app; routers mounted under `/api`), `app/config.py` (`Settings` from env, `DATABASE_URL` required), `app/db/` (`base.py` DeclarativeBase, `session.py` engine + `SessionLocal`), one folder per module (`app/health/`; future `auth/`, `organisations/`, `events/`)
- Each module keeps routes in `router.py` and Pydantic DTOs in `schemas.py`
- No `__init__.py` files (namespace packages); always use full-path imports such as `from app.health.schemas import HealthResponse`
- `GET /api/health` is anonymous liveness only and returns `{"status": "ok", "service": "almamater-api"}` (`api-contracts.md` §8); it must not claim to check the DB
- Migrations live in `alembic/versions/` named `<rev>_<slug>.py`; `0001_initial` is the empty baseline. New models must be imported where `alembic/env.py` sees `Base.metadata` before autogenerating
- Synchronous SQLAlchemy in synchronous handlers (ADR-003)
- Dependencies are pinned exactly in `pyproject.toml`; the image installs them and the source is bind-mounted at `/app`
- Runs only inside Compose (`backend` service, `migrate` one-shot job) via `make` targets

## Work Guidance

## Verification

- `make test` runs pytest against the Compose PostgreSQL: `tests/test_health.py` (health contract), `tests/test_db.py` (`SELECT 1`, `alembic_version == "0001"`)

## Child DOX Index

No child AGENTS.md.
