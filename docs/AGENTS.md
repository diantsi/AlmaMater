# docs/ — Requirements and Technical Contracts

## Purpose

- Canonical source of truth for AlmaMater MVP scope, user stories, requirement analysis, HTTP API contract and data model
- No application code exists yet; future `frontend/` and `backend/` work is implemented against these docs

## Ownership

- Owns everything under `docs/`, including `user-stories/` and `analysis/` (no nested AGENTS.md; this file is their contract)
- Technology decisions (ADRs) are not owned here; they live in `raw_research_output/adr/` (see root AGENTS.md)

## Local Contracts

### When to read docs/

- Read docs/ when the user's question requires extensive knowledge of the project as a whole, including the business perspective (product goals, personas, scope, user journey, why a feature exists)
- Read docs/ before creating or changing a FastAPI route, Pydantic schema, SQLAlchemy model or migration, or frontend code that calls the API
- Do not read every user story up front; open only the US files the task references

### Routing

| Task touches… | Read first |
|---|---|
| Whether a feature is in the MVP | `requirements.md` §3 (Scope + "Scope changes" log) |
| Behaviour of one feature / acceptance criteria | matching `user-stories/us-XX-*.md` (index: `requirements.md` §4 or `user-stories/README.md`) |
| Open questions, ambiguities, product-owner decisions | `analysis/requirements-digest.md` |
| HTTP routes, DTOs, validation, error codes, auth/CSRF/session | `api-contracts.md` |
| Tables, columns, constraints, migrations, event lifecycle | `database-schema.md` |
| Running servers, Docker, migrations, tests, any executive command | `commands.md` |

### Precedence

- When docs conflict: user-story file > `requirements.md` > `analysis/requirements-digest.md` decisions > `api-contracts.md` / `database-schema.md`
- Contracts follow requirements, never the reverse
- Report any conflict found to the user; do not silently pick a side

### Maintenance

- Each story has exactly one file in `user-stories/`; change story details only there
- Story IDs are stable; update `requirements.md` §3/§4 tables and `user-stories/README.md` only when a story's scope, ID, journey step or file name changes
- A scope change gets a dated entry under "Scope changes of …" in `requirements.md`, then the digest and both contracts are aligned
- `api-contracts.md` and `database-schema.md` are a pair: changes to field names, nullability, enums, required fields or lifecycle rules update both in the same change
- API JSON uses `camelCase`; DB columns use `snake_case`; all JSON errors use the envelope in `api-contracts.md` §7
- Never invent seed data (topics, faculties, organisations, organiser emails); the docs mark these as pending team input

## Work Guidance

## Verification

## Child DOX Index

No child AGENTS.md. Direct contents owned by this file:

- `requirements.md` — user journey, story map, MVP In/Out of Scope, scope-change log, MVP story index
- `user-stories/` — one canonical file per MVP story (statement, dependencies, Given/When/Then acceptance criteria); `README.md` is the catalogue by journey step
- `analysis/requirements-digest.md` — requirements analysis, product-owner decisions, gaps and open questions
- `api-contracts.md` — MVP HTTP API contract (routes, DTOs, validation, errors)
- `database-schema.md` — MVP PostgreSQL data model, constraints, event lifecycle
- `commands.md` — `make`/`Makefile` convention for executive commands and the target list
