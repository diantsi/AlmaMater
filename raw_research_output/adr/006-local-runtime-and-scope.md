# ADR-006 — Docker Compose for Local Execution

- Date: 2026-10-28
- Status: Selected by the requester
- Context: [team constraints](../../prompts/4.2_architecture_decisions.md)

## Selected decision

**Use Docker Compose as the standard local startup environment.** It replaces the earlier optional-Docker and manual Python/Node setup. Application, database, migration job, and notification worker are configured together.

## Context and rationale

Six team members need a consistent environment under a semester deadline. Compose centralises service configuration and PostgreSQL setup. The accepted cost is a compatible container runtime and Compose installation on each computer, plus image build/download time and memory use.

## Target services

| Service | Role |
|---|---|
| `frontend` | React/Vite development server and `/api` proxy to `backend` |
| `backend` | FastAPI served by an ASGI server |
| `db` | PostgreSQL with a named persistent volume |
| `migrate` | One-shot Alembic migration job from the backend image |
| `worker` | Outbox delivery process from the same backend image |

Keep PostgreSQL on the internal Compose network by default. Expose the frontend on localhost. The browser uses localhost URLs; service names such as `backend` and `db` are for container-to-container traffic. Register the browser-visible Office 365 callback, not an internal container hostname.

Use a database health check, wait for it before migration, and start the API/worker after successful migration. Dependency order alone does not establish readiness: [Compose startup documentation](https://docs.docker.com/compose/how-tos/startup-order/).

Pin compatible dependencies and image versions. Commit Dockerfiles, `compose.yaml`, lockfiles, and `.env.example`; exclude real environment files, secrets, and database contents. Normal container recreation must retain the volume. Document explicit backup/restore and destructive volume-reset procedures separately.

## Runtime boundaries

The target startup entry point is `docker compose up --build` after local configuration. This describes the intended workflow; no Compose file or working command is delivered by this documentation task. The migration job should run `alembic upgrade head` in the configured backend environment.

The application runs locally, but Office 365 sign-in and email delivery need internet and authorised credentials. A console mailbox or simulated identity is for development only. External registration links also require internet. A localhost shared event link works only on that computer until a reachable deployment is configured.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Manual Python venv + Node.js + database installation | Fewer container tools, but greater environment drift |
| Cloud hosting/BaaS | Adds hosting/account dependencies beyond the local zero-budget requirement |

## Consequences and validation

Compose standardises setup while retaining responsibility for configuration, migrations, and data protection. Verify clean startup, failed-database behaviour, migration failures, persistence after recreation, API/worker operation, and a real sign-in/email scenario. Confirm that the team's chosen container tooling and external services fit the zero budget. No moderation, automatic social posting, chat, or recommendation engine is added.

Revisit only if hardware limits or deployment requirements prevent this agreed workflow.
