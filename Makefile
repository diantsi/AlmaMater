COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up frontend-up down restart logs ps backend-shell migrate migration seed switch-org mail-login test frontend-test test-all smoke frontend-build check frontend-lock db-shell db-reset backend-lint frontend-lint frontend-typecheck

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-15s %s\n", $$1, $$2}'

.env:
	cp .env.example .env

up: .env ## Build and start the stack (frontend, backend, db, migrate, worker)
	$(COMPOSE) up --build --detach --renew-anon-volumes

frontend-up: .env ## Start only the frontend dev server (no backend, db or worker; /api calls fail)
	$(COMPOSE) up --build --detach --renew-anon-volumes --no-deps frontend

down: ## Stop the stack, keep the DB volume
	$(COMPOSE) down

restart: down up ## down + up

logs: ## Follow logs; service=<name> to filter
	$(COMPOSE) logs --follow $(service)

ps: ## Show service status
	$(COMPOSE) ps --all

backend-shell: ## Shell inside the backend container
	$(COMPOSE) exec backend sh

migrate: .env ## Run alembic upgrade head via the migrate job
	$(COMPOSE) run --rm migrate

migration: .env ## Create an Alembic revision; requires name=<slug>, optional rev=<id>
	@test -n "$(name)" || (echo "usage: make migration name=<slug> [rev=<id>]" && exit 1)
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(name)" $(if $(rev),--rev-id "$(rev)")

seed: .env ## Apply a seed file (default seed/data.json): organisations, topics, faculties, organiser accounts, events; optional file=<path>
	$(COMPOSE) run --rm backend python -m app.seed.seeder $(if $(file),--file "$(file)")

switch-org: .env ## Dev only: flip organiser rights of email=<all|email> listed in `accounts` of backend/seed/data.example.json
	@test -n "$(email)" || (echo "usage: make switch-org email=<all|email|login> (run from the repo root)" && exit 1)
	$(COMPOSE) run --rm backend python -m app.seed.seeder --switch "$(email)" $(if $(file),--file "$(file)")

mail-login: .env ## Sign the sending mailbox in to Microsoft Graph once (device code); kept in the mail-cache volume
	$(COMPOSE) run --rm worker python -m app.notifications.mailer --login

test: .env ## Run backend tests against PostgreSQL; args= passed to pytest
	$(COMPOSE) run --rm backend pytest $(args)

frontend-test: .env ## Run frontend unit tests with Vitest (rebuilds the image); args= passed to vitest
	$(COMPOSE) run --rm --build --no-deps frontend npm run test -- $(args)

test-all: test frontend-test ## Run every automated test: backend pytest, then frontend Vitest

backend-lint: .env ## Check backend Python code with Ruff
	$(COMPOSE) run --rm --build --no-deps backend ruff check . $(args)

frontend-lint: .env ## Check frontend JavaScript and React with ESLint
	$(COMPOSE) run --rm --build --no-deps frontend npm run lint

frontend-typecheck: .env ## Check frontend JavaScript types
	$(COMPOSE) run --rm --build --no-deps frontend npm run typecheck

smoke: ## Call /api/health through the frontend proxy (stack must be up)
	$(COMPOSE) exec frontend wget -qO- http://127.0.0.1:5173/api/health
	@echo

frontend-build: .env ## Build the frontend bundle (rebuilds the image; output discarded)
	$(COMPOSE) run --rm --build --no-deps frontend npm run build -- --outDir /tmp/dist --emptyOutDir

check: backend-lint frontend-lint frontend-typecheck test frontend-test smoke frontend-build ## Run all guardrails, tests and build

# Empties the container-only node_modules first so the lock lists every platform's optional binaries (npm/cli#4828)
frontend-lock: .env ## Regenerate frontend/package-lock.json
	$(COMPOSE) run --rm --no-deps frontend sh -c 'rm -rf node_modules/* node_modules/.[!.]* && npm install --package-lock-only'

db-shell: ## Open psql in the db container
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-reset: ## DESTRUCTIVE: drop the DB volume and re-run migrations
	$(COMPOSE) down --volumes
	$(COMPOSE) up --build --detach --renew-anon-volumes
