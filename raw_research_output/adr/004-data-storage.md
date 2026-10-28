# ADR-004 — PostgreSQL + SQLAlchemy

- Date: 2026-10-28
- Status: Selected by the requester; ORM clarified explicitly
- Context: [team constraints](../team-context.md)

## Selected decision

**Use PostgreSQL as the relational database and SQLAlchemy as the ORM. Use Alembic for migrations.**

The initial list paired PostgreSQL with Django ORM while also selecting FastAPI + SQLAlchemy. The requester explicitly confirmed **FastAPI + PostgreSQL + SQLAlchemy**. PostgreSQL remains selected; Django ORM is not used. This avoids maintaining two ORM configurations and migration systems.

## Context and rationale

Members, organisations, events, subscriptions, and notification deliveries have explicit relationships. PostgreSQL provides a common database for the web process and worker. SQLAlchemy maps the relational model without bringing in a Django runtime. Alembic is specifically designed for SQLAlchemy schema migrations: [Alembic documentation](https://alembic.sqlalchemy.org/en/latest/).

## Data model and integrity

- `Member`: stable Office 365 tenant/subject identity and eligible account address; no local university-password storage.
- `Session`: an opaque session identifier stored as a hash, member reference, expiry, and revocation information.
- `Organisation`: name and one registered publishing address/account; ordinary members cannot self-assign this identity.
- `Topic`, `Faculty`: reference data used by events and filters.
- `Event`: organisation, author, structured details, start timestamp, format/location, participation method and its field, status, and revision.
- `EventSubscription`: unique `(member_id, event_id)` relationship.
- `NotificationDelivery`: event revision, kind, recipient, delivery state, and retry metadata, with a unique transition/recipient key.

Use foreign keys, unique constraints, and suitable indexes for status, time, and filtering relationships. Store timestamps in UTC and interpret date filters in `Europe/Kyiv`. Translate an inclusive date range into an inclusive start and exclusive start of the day after the final date; respect timezone transitions and omit missing bounds.

Categorical multi-selection affects search predicates, not the number of topics/faculties attached to each event. The chosen participation method's field is required. The complete product-owner field matrix must be imported from the missing digest rather than inferred.

## Migrations and transactions

Version Alembic migrations alongside code and review generated changes before applying them. Use explicit SQLAlchemy transactions for event updates and outbox creation. Run migrations once through a dedicated Compose job before the API and worker start. Use PostgreSQL in integration tests rather than assuming SQLite has identical behaviour.

Keep data in a named Compose volume. Provide seed data without real credentials and document a PostgreSQL backup/restore procedure. A persistent volume is not a backup.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| PostgreSQL + Django ORM | Original candidate; replaced by explicitly confirmed SQLAlchemy for FastAPI |
| SQLite + SQLAlchemy | Easier standalone setup, but PostgreSQL is selected for the shared process environment |
| MongoDB | Document flexibility offers no clear benefit for these relational entities |
| JSON files | Would require custom integrity and concurrent-update handling |

## Consequences and validation

The benefits are relational integrity and one shared database environment. Separate database administration and migration discipline are accepted costs, with Compose standardising setup. Verify clean migrations, existing-data upgrades, rollback on errors, uniqueness, persistence across container recreation, and backup restoration. Revisit only if observed workload or operating constraints justify a different database.
