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

**Status:** the `Makefile` is currently empty and no `compose.yaml` exists. The targets below are the planned set derived from ADR-006; mark each as implemented when it is added.

| Target | Action | Status |
|---|---|---|
| `help` | List available targets | planned |
| `up` | Build and start the full stack (`frontend`, `backend`, `db`, `migrate`, `worker`) | planned |
| `down` | Stop the stack, keep the DB volume | planned |
| `restart` | `down` + `up` | planned |
| `logs` | Follow logs; `service=<name>` to filter | planned |
| `ps` | Show service status | planned |
| `backend-shell` | Shell inside the `backend` container | planned |
| `migrate` | Run `alembic upgrade head` via the `migrate` job | planned |
| `migration` | Create an Alembic revision; requires `name=<slug>` | planned |
| `test` | Run backend tests; `args=` passed through | planned |
| `lint` | Run linters for backend and frontend | planned |
| `format` | Run formatters | planned |
| `db-shell` | Open `psql` in the `db` container | planned |
| `db-reset` | **Destructive:** drop the DB volume and re-run migrations | planned |
