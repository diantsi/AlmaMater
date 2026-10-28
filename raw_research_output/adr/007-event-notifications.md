# ADR-007 — PostgreSQL Outbox and Notification Worker

- Date: 2026-10-28
- Status: Implementation proposal for confirmed notification scope
- Context: [team constraints](../../prompts/4.2_architecture_decisions.md)

## Selected implementation direction

**Store notification intent in PostgreSQL and process it with a Compose worker sharing the FastAPI backend code.** Use SQLAlchemy for both the event transaction and delivery records. This supports US-45a subscriptions, US-45b change emails, and US-45c cancellation emails without an external queue service.

## Context and rationale

A committed event change must not lose its email work when the provider fails or a process restarts. An outbox keeps event state and delivery intent consistent. Office 365 sign-in does not automatically grant email-sending permission; choose an authorised transport through a provider adapter.

## Trigger rules

| Committed operation | Email behaviour |
|---|---|
| Change to date, start time, format, venue/meeting link, participation method, or its applicable field | Notify subscribers of the change |
| First cancellation transition | Notify subscribers of cancellation |
| Only other fields change, including title, description, topic, or registration deadline | No change email |
| No effective change, rejected update, rollback, or repeated cancellation | No new notification |

Compare normalised values. A multi-field edit produces one change notification per subscriber; cancellation produces its distinct message. Editing an irrelevant participation field does not trigger an email. Subscription is explicit and does not register attendance in external systems.

## Processing design

Save the event revision and outbox rows in one SQLAlchemy transaction. Use a unique `(event, revision, kind, subscriber)` key and a unique member/event subscription. Snapshot eligible recipients at commit; reconcile lifecycle rules with the authoritative digest before implementation.

Proposed delivery states are `pending`, `sending`, `sent`, and `failed`. Claim work in short transactions, use expiring claims for crash recovery, and make network requests outside the transaction. Retry transient errors with configurable limits/backoff. Preserve per-event recipient revision order. These are engineering proposals, not a reconstruction of the missing product-owner state specification.

A provider-accepted message may still be duplicated if the worker crashes before recording success. Use provider idempotency where available; do not promise exactly-once inbox delivery. Failure must retain recoverable work without undoing the event update. Emails must not expose other subscribers' addresses, and event URLs still require member sign-in.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Send inside the update request | Couples response time to the provider and risks lost intent |
| Redis/external message broker | Additional infrastructure without a demonstrated MVP need |

## Consequences and validation

The design adds database records, worker operation, and retry logic, but reuses the selected PostgreSQL/Compose environment. Verify uniqueness, trigger exclusions, rollback, cancellation, restart recovery, retries, recipient privacy, and actual provider delivery. Import exact subscription states, timing targets, retention, and unsubscribe rules from the full digest before implementation acceptance. Revisit the worker design only if measured throughput or reliability requirements warrant it.
