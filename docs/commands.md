# AlmaMater — Running Commands via `make`

**Related:** [`../Makefile`](../Makefile), [ADR-006 — Docker Compose for local execution](../raw_research_output/adr/006-local-runtime-and-scope.md)

## 1. Rule

All executive commands — starting/stopping the stack, running servers, migrations, tests, linters, formatters, database resets — are run through `make` targets defined in the root `Makefile`.

- Run `make <target>` instead of calling `docker compose`, `uvicorn`, `alembic`, `npm`, `pytest` etc. directly
- If the needed target does not exist, add it to the `Makefile` first, then run it through `make`
- Every target is listed in §3 of this file; keep the table and the `Makefile` in sync
- Destructive targets (dropping volumes, resetting the database) must be clearly named (e.g. `db-reset`) and are run only after explicit user confirmation

Why: one entry point keeps local commands identical for every team member and agent, and hides Docker Compose service names, env files and flags behind stable names.

## 2. Makefile conventions

- Declare every target in `.PHONY`
- Provide `make help` as the default goal, printing each target with a one-line description (`## description` comment after the target)
- Wrap Docker Compose in a single variable, e.g. `COMPOSE := docker compose`, so flags/files change in one place
- Commands that run inside containers use `$(COMPOSE) exec <service> …` or `$(COMPOSE) run --rm <service> …`; no host-only toolchain is assumed (ADR-006)
- Pass arguments through variables, e.g. `make migration name=add_events`, `make test args="-k events"`
- Keep recipes short; move complex logic to a script and call it from the target

## 3. Targets

Services live in the root `compose.yaml`: `frontend`, `backend`, `db` and `migrate`. The ADR-006 `worker` (notification outbox sender, US-45b/c) is in the MVP but not yet in Compose: the walking skeleton has no business logic, so the service is added together with the notifications module. Only `frontend` is published on localhost (`FRONTEND_PORT`, default 5173). `backend` and `db` stay on the internal Compose network, and the browser reaches the API through the Vite `/api` proxy. Targets that need configuration depend on `.env`, which is copied from `.env.example` when missing.

| Target | Action | Status |
|---|---|---|
| `help` | List available targets (default goal) | implemented |
| `up` | Build and start the stack (`frontend`, `backend`, `db`, `migrate`) detached | implemented |
| `down` | Stop the stack, keep the DB volume | implemented |
| `restart` | `down` + `up` | implemented |
| `logs` | Follow logs; `service=<name>` to filter | implemented |
| `ps` | Show service status, including the exited `migrate` job | implemented |
| `backend-shell` | Shell inside the `backend` container | implemented |
| `migrate` | Run `alembic upgrade head` via the `migrate` job | implemented |
| `migration` | Create an Alembic revision (autogenerate); requires `name=<slug>` | implemented |
| `test` | Run backend pytest against PostgreSQL; `args=` passed through | implemented |
| `smoke` | Call `/api/health` through the frontend proxy; stack must be up | implemented |
| `check` | `test` + `smoke`: all walking-skeleton checks | implemented |
| `frontend-lock` | Regenerate `frontend/package-lock.json` inside the container | implemented |
| `lint` | Run linters for backend and frontend | planned (no linter chosen yet) |
| `format` | Run formatters | planned (no formatter chosen yet) |
| `db-shell` | Open `psql` in the `db` container | implemented |
| `db-reset` | **Destructive:** drop the DB volume and re-run migrations | implemented |
