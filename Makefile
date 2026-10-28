COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up down restart logs ps backend-shell migrate migration test smoke check frontend-lock db-shell db-reset

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-15s %s\n", $$1, $$2}'

.env:
	cp .env.example .env

up: .env ## Build and start the stack (frontend, backend, db, migrate)
	$(COMPOSE) up --build --detach --renew-anon-volumes

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

migration: .env ## Create an Alembic revision; requires name=<slug>
	@test -n "$(name)" || (echo "usage: make migration name=<slug>" && exit 1)
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(name)"

test: .env ## Run backend tests against PostgreSQL; args= passed to pytest
	$(COMPOSE) run --rm backend pytest $(args)

smoke: ## Call /api/health through the frontend proxy (stack must be up)
	$(COMPOSE) exec frontend wget -qO- http://127.0.0.1:5173/api/health
	@echo

check: test smoke ## Run all walking-skeleton checks

frontend-lock: .env ## Regenerate frontend/package-lock.json
	$(COMPOSE) run --rm --no-deps frontend npm install --package-lock-only

db-shell: ## Open psql in the db container
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-reset: ## DESTRUCTIVE: drop the DB volume and re-run migrations
	$(COMPOSE) down --volumes
	$(COMPOSE) up --build --detach --renew-anon-volumes
