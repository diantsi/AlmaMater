# ADR-003 — Python + FastAPI + SQLAlchemy

- Date: 2026-10-28
- Status: Selected by the requester
- Context: [team constraints](../../prompts/4.2_architecture_decisions.md)

## Selected decision

**Use Python + FastAPI for the API and business logic, with SQLAlchemy for persistence.** Use Pydantic request/response schemas, a PostgreSQL driver, and Alembic migrations. No Django application or Django ORM is included.

## Context and rationale

The team reports Python experience. FastAPI supports an API-focused implementation with typed schemas, while SQLAlchemy keeps persistence explicit. The main trade-off is that authentication, session storage, authorisation, and migrations must be assembled separately. FastAPI does not require a particular ORM: [FastAPI database guidance](https://fastapi.tiangolo.com/tutorial/sql-databases/).

## Module responsibilities

| Module | Responsibility |
|---|---|
| `auth` | Office 365 callback, member identity, server-side sessions, access dependencies |
| `organisations` | Registered publishing account and ownership checks |
| `events` | Validation, catalog queries, publication, editing, cancellation |
| `notifications` | Subscriptions, outbox creation, email delivery |
| `db` | SQLAlchemy engine/session configuration and shared model infrastructure |

Routes parse requests and invoke services; services enforce business rules and transaction boundaries. Schemas validate shape and field relationships but do not replace ownership checks or database constraints. Use a scoped SQLAlchemy session per request/job, close it reliably, and roll back failed transactions. For the initial implementation, synchronous SQLAlchemy calls belong in synchronous handlers/services rather than blocking an async event loop. Sessions must not be shared across concurrent tasks: [SQLAlchemy session guidance](https://docs.sqlalchemy.org/en/20/orm/session_basics.html).

## API and business rules

Provide event list/detail, create/edit/cancel, current-member, and subscription operations. Protect all event reads and writes with a member-session dependency; writes additionally require the organisation's registered identity. Define a consistent JSON field-error format before frontend integration.

Catalog queries apply OR within categorical selections and AND between filters. Validate date bounds and IDs. Event updates compare normalised old/new values and create relevant notification intent in the same transaction. A failed mail request must not undo a committed event change. See [ADR-007](007-event-notifications.md).

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Django + DRF | More bundled infrastructure, but FastAPI is the selected backend |
| Node.js + Express | Shares the frontend language, but the chosen backend uses Python |
| Java + Spring Boot | Viable with strong Spring experience, but not the selected stack |

## Consequences and validation

Typed API schemas and explicit service boundaries support parallel frontend/backend work. Integration effort for identity and migrations is accepted. Verify schema errors, organisation isolation, transaction rollback, filter combinations, and the full sign-in → publish → discover flow. Review implementation complexity before adding further abstraction layers.
